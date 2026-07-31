// Reconciliação das fontes monitoradas.
// Executa a cada seis horas por agendamento e também atende à sincronização
// manual de um escritório. O trabalho é dividido por escritório e por fonte:
// a falha de uma fonte nunca interrompe as demais.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/tenant-auth.ts";
import { normalizeDataJudAuthorization } from "../_shared/datajud-auth.ts";
import { DataJudApiError, fetchDataJudProcess } from "../_shared/datajud-client.ts";
import {
  EscavadorApiError,
  fetchLawyerPublications,
} from "../_shared/escavador-client.ts";
import {
  indexProcessesByNumber,
  ingestMovements,
  ingestPublications,
  type IngestionResult,
  type ProcessReference,
} from "../_shared/legal-ingestion.ts";
import {
  formatCnj,
  nextAttemptDelayMs,
  normalizeDataJudMovements,
  normalizeEscavadorPublication,
  RECONCILIATION_INTERVAL_MS,
} from "../_shared/legal-normalization.ts";

const DEFAULT_BATCH = 40;
const MAX_BATCH = 200;

/** Falhas que não se resolvem com retentativa e exigem ação humana. */
const PERMANENT_FAILURES = new Set([
  "escavador_unauthorized",
  "escavador_insufficient_balance",
  "datajud_unauthorized",
  "datajud_court_not_supported",
]);

interface SyncSource {
  id: string;
  tenant_id: string;
  source_kind: "oab" | "process";
  provider: "escavador" | "datajud";
  process_id: string | null;
  reference: string;
  failure_count: number;
  last_success_at: string | null;
  sync_cursor: string | null;
}

interface ReconcileContext {
  admin: SupabaseClient;
  mode: "scheduled" | "manual";
  actorId: string | null;
  escavadorToken: string | null;
  dataJudAuthorization: string | null;
}

function errorCode(error: unknown): string {
  if (error instanceof EscavadorApiError) return error.code;
  if (error instanceof DataJudApiError) return error.code;
  if (error instanceof Error && /^[a-z0-9_]+$/.test(error.message)) {
    return error.message;
  }
  return "provider_error";
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "operation_failed";
  return raw.slice(0, 500);
}

async function authenticate(
  request: Request,
): Promise<
  | { mode: "scheduled"; admin: SupabaseClient; tenantId: null; userId: null }
  | { mode: "manual"; admin: SupabaseClient; tenantId: string; userId: string }
  | Response
> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "server_configuration_error" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const receivedSecret = request.headers.get("x-cron-secret");
  if (receivedSecret) {
    if (!cronSecret || receivedSecret !== cronSecret) {
      return json({ error: "unauthorized" }, 401);
    }
    return { mode: "scheduled", admin, tenantId: null, userId: null };
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getUser(
    authorization.slice("Bearer ".length).trim(),
  );
  if (error || !data.user) return json({ error: "unauthorized" }, 401);

  let body: { tenantId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  const tenantId = body.tenantId?.trim();
  if (!tenantId) return json({ error: "invalid_payload" }, 400);

  const { data: membership, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "operation_failed" }, 500);
  if (!membership) return json({ error: "permission_denied" }, 403);

  return { mode: "manual", admin, tenantId, userId: data.user.id };
}

async function reconcileOabSource(
  context: ReconcileContext,
  source: SyncSource,
): Promise<IngestionResult> {
  if (!context.escavadorToken) {
    throw new Error("integration_not_configured");
  }

  const [oabNumber, oabState] = source.reference.split("/");
  const publications = await fetchLawyerPublications({
    token: context.escavadorToken,
    oabNumber,
    oabState,
  });

  const { data: processes, error } = await context.admin
    .from("processos")
    .select("id, numero, cliente_nome, user_id")
    .eq("tenant_id", source.tenant_id);
  if (error) throw error;

  const receivedAt = new Date().toISOString();
  return await ingestPublications(context.admin, {
    tenantId: source.tenant_id,
    provider: "escavador",
    fallbackUserId: context.actorId,
    processByNumber: indexProcessesByNumber(
      (processes ?? []) as Array<ProcessReference & { numero: string }>,
      formatCnj,
    ),
    publications: publications.map((publication) =>
      normalizeEscavadorPublication(publication, { receivedAt })
    ),
  });
}

async function reconcileProcessSource(
  context: ReconcileContext,
  source: SyncSource,
): Promise<IngestionResult> {
  if (!context.dataJudAuthorization) {
    throw new Error("integration_not_configured");
  }
  if (!source.process_id) {
    throw new Error("source_without_process");
  }

  const { data: process, error } = await context.admin
    .from("processos")
    .select("id, numero")
    .eq("tenant_id", source.tenant_id)
    .eq("id", source.process_id)
    .maybeSingle();
  if (error) throw error;
  if (!process) throw new Error("process_not_found");

  // `processos` não guarda a sigla do tribunal; o índice público é derivado
  // do segmento e do código do próprio número CNJ.
  const found = await fetchDataJudProcess({
    authorization: context.dataJudAuthorization,
    cnj: source.reference,
  });
  if (!found) return { received: 0, created: 0, ignored: 0 };

  return await ingestMovements(context.admin, {
    tenantId: source.tenant_id,
    processId: source.process_id,
    provider: "datajud",
    movements: normalizeDataJudMovements(found),
  });
}

async function reconcileSource(
  context: ReconcileContext,
  source: SyncSource,
): Promise<{ status: string; code: string | null }> {
  const startedAt = new Date().toISOString();
  const { data: run } = await context.admin.from("legal_sync_runs").insert({
    tenant_id: source.tenant_id,
    source_id: source.id,
    provider: source.provider,
    sync_kind: "reconciliation",
    trigger_type: context.mode === "manual" ? "manual" : "scheduled",
    status: "running",
    started_at: startedAt,
    created_by: context.actorId,
    metadata: { source_kind: source.source_kind, reference: source.reference },
  }).select("id").maybeSingle();

  try {
    const result = source.source_kind === "oab"
      ? await reconcileOabSource(context, source)
      : await reconcileProcessSource(context, source);

    const finishedAt = new Date().toISOString();
    await context.admin.from("legal_sync_sources").update({
      failure_count: 0,
      last_attempt_at: finishedAt,
      last_success_at: finishedAt,
      last_error_code: null,
      last_error_message: null,
      paused_reason: null,
      next_sync_at: new Date(Date.now() + RECONCILIATION_INTERVAL_MS)
        .toISOString(),
    }).eq("id", source.id).eq("tenant_id", source.tenant_id);

    if (run?.id) {
      await context.admin.from("legal_sync_runs").update({
        status: "succeeded",
        records_received: result.received,
        records_created: result.created,
        records_ignored: result.ignored,
        finished_at: finishedAt,
      }).eq("id", run.id).eq("tenant_id", source.tenant_id);
    }

    return { status: "succeeded", code: null };
  } catch (error) {
    const code = errorCode(error);
    const finishedAt = new Date().toISOString();
    // Uma integração ainda não configurada não é falha do escritório:
    // a fonte permanece ativa e volta a ser tentada na próxima janela.
    const pending = code === "integration_not_configured";
    const permanent = !pending && PERMANENT_FAILURES.has(code);
    const delay = pending || permanent
      ? null
      : nextAttemptDelayMs(source.failure_count);
    const exhausted = !pending && !permanent && delay === null;
    const stopped = permanent || exhausted;

    await context.admin.from("legal_sync_sources").update({
      failure_count: pending
        ? source.failure_count
        : source.failure_count + 1,
      last_attempt_at: finishedAt,
      last_error_code: code,
      last_error_message: errorMessage(error),
      active: !stopped,
      paused_reason: permanent ? code : exhausted ? "max_retries" : null,
      next_sync_at: new Date(
        Date.now() + (delay ?? RECONCILIATION_INTERVAL_MS),
      ).toISOString(),
    }).eq("id", source.id).eq("tenant_id", source.tenant_id);

    if (run?.id) {
      await context.admin.from("legal_sync_runs").update({
        // Integração ainda não configurada é estado parcial, não falha.
        status: pending ? "partial" : "failed",
        error_code: code,
        error_message: errorMessage(error),
        finished_at: finishedAt,
      }).eq("id", run.id).eq("tenant_id", source.tenant_id);
    }

    return { status: pending ? "pending" : "failed", code };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;

  let dataJudAuthorization: string | null = null;
  try {
    dataJudAuthorization = normalizeDataJudAuthorization(
      Deno.env.get("DATAJUD_API_KEY"),
    );
  } catch {
    dataJudAuthorization = null;
  }

  const context: ReconcileContext = {
    admin: auth.admin,
    mode: auth.mode,
    actorId: auth.mode === "manual" ? auth.userId : null,
    escavadorToken: Deno.env.get("ESCAVADOR_API_TOKEN") ?? null,
    dataJudAuthorization,
  };

  let query = auth.admin
    .from("legal_sync_sources")
    .select(
      "id, tenant_id, source_kind, provider, process_id, reference, failure_count, last_success_at, sync_cursor",
    )
    .eq("active", true)
    .order("next_sync_at", { ascending: true })
    .limit(auth.mode === "manual" ? MAX_BATCH : DEFAULT_BATCH);

  if (auth.mode === "manual") {
    // A sincronização manual ignora o agendamento do escritório atual.
    query = query.eq("tenant_id", auth.tenantId);
  } else {
    query = query.lte("next_sync_at", new Date().toISOString());
  }

  const { data: sources, error } = await query;
  if (error) return json({ error: "operation_failed" }, 500);

  const results = { processed: 0, succeeded: 0, failed: 0, pending: 0 };
  const failures: Array<{ reference: string; code: string }> = [];

  for (const source of (sources ?? []) as SyncSource[]) {
    const outcome = await reconcileSource(context, source);
    results.processed += 1;
    if (outcome.status === "succeeded") {
      results.succeeded += 1;
      continue;
    }
    if (outcome.status === "pending") {
      results.pending += 1;
      continue;
    }
    results.failed += 1;
    if (outcome.code) {
      failures.push({ reference: source.reference, code: outcome.code });
    }
  }

  return json({
    mode: auth.mode,
    ...results,
    failures: failures.slice(0, 20),
    message: results.processed === 0
      ? "Nenhuma fonte monitorada estava pendente."
      : `${results.succeeded} de ${results.processed} fonte(s) reconciliada(s).`,
  });
});
