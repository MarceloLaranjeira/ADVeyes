// Reconciliação das fontes monitoradas.
// Executa a cada dez minutos por agendamento e também atende à sincronização
// manual de um escritório. O trabalho é dividido por escritório e por fonte:
// a falha de uma fonte nunca interrompe as demais.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/tenant-auth.ts";
import { describeError, postgrestErrorCode } from "../_shared/error-mapping.ts";
import { normalizeDataJudAuthorization } from "../_shared/datajud-auth.ts";
import { DataJudApiError, fetchDataJudProcess } from "../_shared/datajud-client.ts";
import {
  DjenApiError,
  fetchDjenPublications,
  groupDjenReferences,
  type DjenFetchResult,
} from "../_shared/djen-client.ts";
import {
  discoverLawyerProcesses,
  EscavadorApiError,
} from "../_shared/escavador-client.ts";
import {
  createPublicationReviewTasks,
  indexProcessesByNumber,
  ingestMovements,
  ingestProcessMetadata,
  ingestProcessParties,
  ingestPublications,
  notifyNewPublications,
  type IngestionResult,
  type ProcessReference,
} from "../_shared/legal-ingestion.ts";
import {
  formatCnj,
  DJEN_RECONCILIATION_INTERVAL_MS,
  nextAttemptDelayMs,
  normalizeDataJudMovements,
  normalizeDataJudParties,
  normalizeDataJudProcessMetadata,
  normalizeDjenPublication,
  RECONCILIATION_INTERVAL_MS,
} from "../_shared/legal-normalization.ts";
import { getEscavadorToken } from "../_shared/provider-secrets.ts";
import {
  assertProviderBudget,
  ProviderBudgetError,
  recordProviderUsage,
} from "../_shared/provider-quota.ts";

const CNJ_PATTERN = /^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$/;
const DEFAULT_BATCH = 40;
const MAX_BATCH = 200;
const DJEN_INITIAL_LOOKBACK_DAYS = 7;
const DJEN_OVERLAP_DAYS = 1;

/** Falhas que não se resolvem com retentativa e exigem ação humana. */
const PERMANENT_FAILURES = new Set([
  "escavador_unauthorized",
  "escavador_insufficient_balance",
  "datajud_unauthorized",
  "datajud_court_not_supported",
  "djen_invalid_reference",
]);

interface SyncSource {
  id: string;
  tenant_id: string;
  source_kind: "oab" | "process";
  provider: "djen" | "escavador" | "datajud";
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
  if (error instanceof ProviderBudgetError) return error.code;
  if (error instanceof EscavadorApiError) return error.code;
  if (error instanceof DataJudApiError) return error.code;
  if (error instanceof DjenApiError) return error.code;
  if (error instanceof Error && /^[a-z0-9_]+$/.test(error.message)) {
    return error.message;
  }
  return postgrestErrorCode(error) ?? "provider_error";
}

function errorMessage(error: unknown): string {
  return describeError(error);
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

  // O Escavador não expõe consulta de diários por OAB sob demanda: publicações
  // vêm do DJEN. O que a OAB rende aqui é a descoberta de processos novos,
  // registrados como candidatos para confirmação humana.
  const [oabNumber, oabState] = source.reference.split("/");
  const { data: registration, error: registrationError } = await context.admin
    .from("lawyer_registrations")
    .select("id, oab_type")
    .eq("tenant_id", source.tenant_id)
    .eq("oab_number", oabNumber)
    .eq("oab_state", oabState)
    .maybeSingle();
  if (registrationError) throw registrationError;
  if (!registration) throw new Error("registration_not_found");

  // A reconciliação roda sozinha: sem a trava, o custo cresceria sem
  // ninguém perceber. Estourada a cota, o provedor não é chamado.
  await assertProviderBudget(context.admin, {
    tenantId: source.tenant_id,
    provider: "escavador",
    service: "oab_processes",
  });

  const result = await discoverLawyerProcesses({
    token: context.escavadorToken,
    oabNumber,
    oabState,
    oabType: registration.oab_type ?? "ADVOGADO",
  });

  await recordProviderUsage(context.admin, {
    tenantId: source.tenant_id,
    provider: "escavador",
    operation: "oab_discovery",
    service: "oab_processes",
    itemCount: result.processes.length,
    externalReference: registration.id,
    metadata: { pages: result.pages, found: result.processes.length },
  });

  const rows = result.processes
    .filter((item) => CNJ_PATTERN.test(item.numero_cnj))
    .map((item) => ({
      tenant_id: source.tenant_id,
      lawyer_registration_id: registration.id,
      numero_cnj: item.numero_cnj,
      provider: "escavador",
      state: "candidate",
      title_active_party: item.titulo_polo_ativo ?? null,
      title_passive_party: item.titulo_polo_passivo ?? null,
      tribunal: item.unidade_origem?.tribunal_sigla ?? null,
      court_unit: item.unidade_origem?.nome ?? null,
      last_movement_at: item.data_ultima_movimentacao ?? null,
      provider_fetched_at: new Date().toISOString(),
      provider_payload: item,
    }));

  if (!rows.length) {
    return { received: result.processes.length, created: 0, ignored: 0 };
  }

  const { data: saved, error: saveError } = await context.admin
    .from("process_discoveries")
    .upsert(rows, {
      onConflict: "tenant_id,lawyer_registration_id,numero_cnj,provider",
      ignoreDuplicates: true,
    })
    .select("id");
  if (saveError) throw saveError;

  const created = saved?.length ?? 0;
  return {
    received: result.processes.length,
    created,
    ignored: result.processes.length - created,
  };
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
  if (!found) {
    return { received: 0, created: 0, ignored: 0, createdIds: [] };
  }

  await ingestProcessMetadata(context.admin, {
    tenantId: source.tenant_id,
    processId: source.process_id,
    metadata: normalizeDataJudProcessMetadata(found.rawSource),
  });
  const partyResult = await ingestProcessParties(context.admin, {
    tenantId: source.tenant_id,
    processId: source.process_id,
    parties: normalizeDataJudParties(found.rawSource),
  });
  const movementResult = await ingestMovements(context.admin, {
    tenantId: source.tenant_id,
    processId: source.process_id,
    provider: "datajud",
    movements: normalizeDataJudMovements(found),
  });

  return {
    received: partyResult.received + movementResult.received,
    created: partyResult.created + movementResult.created,
    ignored: partyResult.ignored + movementResult.ignored,
    createdIds: movementResult.createdIds,
  };
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
    const result = source.provider === "escavador"
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
    // Integração não configurada e cota esgotada não são falhas do escritório:
    // a fonte permanece ativa e volta a ser tentada na próxima janela. A cota
    // se renova no mês seguinte, então desativar exigiria religar na mão.
    const pending = code === "integration_not_configured" ||
      code === "tenant_budget_exceeded" ||
      code === "platform_budget_exceeded";
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

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function djenStartDate(source: SyncSource, now: Date): string {
  if (!source.last_success_at) {
    return dateOnly(new Date(
      now.getTime() - DJEN_INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ));
  }
  const lastSuccess = new Date(source.last_success_at);
  if (Number.isNaN(lastSuccess.getTime())) {
    return dateOnly(new Date(
      now.getTime() - DJEN_INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ));
  }
  return dateOnly(new Date(
    lastSuccess.getTime() - DJEN_OVERLAP_DAYS * 24 * 60 * 60 * 1000,
  ));
}

async function openDjenRuns(
  context: ReconcileContext,
  sources: SyncSource[],
): Promise<Map<string, string>> {
  const { data, error } = await context.admin.from("legal_sync_runs").insert(
    sources.map((source) => ({
      tenant_id: source.tenant_id,
      source_id: source.id,
      provider: "djen",
      sync_kind: "publication",
      trigger_type: context.mode === "manual" ? "manual" : "scheduled",
      status: "running",
      created_by: context.actorId,
      metadata: {
        source_kind: source.source_kind,
        reference: source.reference,
        grouped_sources: sources.length,
      },
    })),
  ).select("id, source_id");
  if (error) throw error;
  return new Map((data ?? []).map((run) => [run.source_id, run.id]));
}

async function persistDjenForSource(
  context: ReconcileContext,
  source: SyncSource,
  fetched: DjenFetchResult,
  receivedAt: string,
): Promise<{ result: IngestionResult; notificationError: string | null }> {
  const { data: processes, error } = await context.admin
    .from("processos")
    .select("id, numero, cliente_nome, user_id")
    .eq("tenant_id", source.tenant_id);
  if (error) throw error;

  const processRows = (processes ?? []) as Array<
    ProcessReference & { numero: string }
  >;
  const normalized = fetched.items.map((publication) =>
    normalizeDjenPublication(publication, { receivedAt })
  );
  const result = await ingestPublications(context.admin, {
    tenantId: source.tenant_id,
    provider: "djen",
    fallbackUserId: context.actorId,
    processByNumber: indexProcessesByNumber(processRows, formatCnj),
    defaultProcess: source.process_id
      ? processRows.find((process) => process.id === source.process_id) ?? null
      : null,
    publications: normalized,
  });

  let notificationError: string | null = null;
  const taskResult = await createPublicationReviewTasks(context.admin, {
    tenantId: source.tenant_id,
    publicationIds: result.createdIds,
  });
  if (taskResult.failed > 0) {
    notificationError = "publication_task_partial_failure";
  }
  try {
    await notifyNewPublications(context.admin, {
      tenantId: source.tenant_id,
      publicationIds: result.createdIds,
    });
  } catch (error) {
    // A publicação oficial não pode ser descartada por uma falha secundária de
    // alerta. O erro permanece observável nos metadados da execução.
    notificationError = notificationError ?? errorCode(error);
    console.error("DJEN notification failure", {
      tenantId: source.tenant_id,
      sourceId: source.id,
      code: notificationError,
    });
  }

  return { result, notificationError };
}

async function reconcileDjenGroup(
  context: ReconcileContext,
  sources: SyncSource[],
): Promise<Array<{ status: string; code: string | null }>> {
  const now = new Date();
  const receivedAt = now.toISOString();
  const endDate = dateOnly(now);
  const startDate = sources
    .map((source) => djenStartDate(source, now))
    .sort()[0];
  const runs = await openDjenRuns(context, sources);

  try {
    const fetched = await fetchDjenPublications({
      sourceKind: sources[0].source_kind,
      reference: sources[0].reference,
      startDate,
      endDate,
      baseUrl: Deno.env.get("DJEN_PROXY_URL") ?? undefined,
      proxySecret: Deno.env.get("DJEN_PROXY_SECRET") ?? undefined,
    });
    const outcomes: Array<{ status: string; code: string | null }> = [];

    for (const source of sources) {
      try {
        const { result, notificationError } = await persistDjenForSource(
          context,
          source,
          fetched,
          receivedAt,
        );
        const finishedAt = new Date().toISOString();
        await context.admin.from("legal_sync_sources").update({
          failure_count: 0,
          last_attempt_at: finishedAt,
          last_success_at: finishedAt,
          sync_cursor: endDate,
          last_error_code: null,
          last_error_message: null,
          paused_reason: null,
          next_sync_at: new Date(
            Date.now() + DJEN_RECONCILIATION_INTERVAL_MS,
          ).toISOString(),
        }).eq("id", source.id).eq("tenant_id", source.tenant_id);

        const runId = runs.get(source.id);
        if (runId) {
          await context.admin.from("legal_sync_runs").update({
            status: notificationError ? "partial" : "succeeded",
            records_received: result.received,
            records_created: result.created,
            records_ignored: result.ignored,
            cursor_before: source.sync_cursor,
            cursor_after: endDate,
            error_code: notificationError,
            error_message: notificationError,
            metadata: {
              source_kind: source.source_kind,
              reference: source.reference,
              grouped_sources: sources.length,
              pages: fetched.pages,
              total_reported: fetched.totalReported,
              rate_limit: fetched.rateLimit,
              rate_limit_remaining: fetched.rateLimitRemaining,
              notification_error: notificationError,
            },
            finished_at: finishedAt,
          }).eq("id", runId).eq("tenant_id", source.tenant_id);
        }
        outcomes.push({
          status: notificationError ? "partial" : "succeeded",
          code: notificationError,
        });
      } catch (error) {
        const code = errorCode(error);
        const finishedAt = new Date().toISOString();
        const delay = nextAttemptDelayMs(source.failure_count);
        const exhausted = delay === null;
        await context.admin.from("legal_sync_sources").update({
          failure_count: source.failure_count + 1,
          last_attempt_at: finishedAt,
          last_error_code: code,
          last_error_message: errorMessage(error),
          active: !exhausted,
          paused_reason: exhausted ? "max_retries" : null,
          next_sync_at: new Date(
            Date.now() + (delay ?? RECONCILIATION_INTERVAL_MS),
          ).toISOString(),
        }).eq("id", source.id).eq("tenant_id", source.tenant_id);
        const runId = runs.get(source.id);
        if (runId) {
          await context.admin.from("legal_sync_runs").update({
            status: "failed",
            error_code: code,
            error_message: errorMessage(error),
            finished_at: finishedAt,
          }).eq("id", runId).eq("tenant_id", source.tenant_id);
        }
        outcomes.push({ status: "failed", code });
      }
    }
    return outcomes;
  } catch (error) {
    const code = errorCode(error);
    const finishedAt = new Date().toISOString();
    const rateLimited = error instanceof DjenApiError &&
      error.code === "djen_rate_limited";
    const outcomes: Array<{ status: string; code: string | null }> = [];

    for (const source of sources) {
      const permanent = PERMANENT_FAILURES.has(code);
      const delay = rateLimited
        ? (error as DjenApiError).retryAfterMs ?? 60_000
        : permanent
        ? null
        : nextAttemptDelayMs(source.failure_count);
      const stopped = permanent || (!rateLimited && delay === null);
      await context.admin.from("legal_sync_sources").update({
        failure_count: rateLimited
          ? source.failure_count
          : source.failure_count + 1,
        last_attempt_at: finishedAt,
        last_error_code: code,
        last_error_message: errorMessage(error),
        active: !stopped,
        paused_reason: permanent ? code : stopped ? "max_retries" : null,
        next_sync_at: new Date(
          Date.now() + (delay ?? RECONCILIATION_INTERVAL_MS),
        ).toISOString(),
      }).eq("id", source.id).eq("tenant_id", source.tenant_id);
      const runId = runs.get(source.id);
      if (runId) {
        await context.admin.from("legal_sync_runs").update({
          status: rateLimited ? "partial" : "failed",
          error_code: code,
          error_message: errorMessage(error),
          finished_at: finishedAt,
        }).eq("id", runId).eq("tenant_id", source.tenant_id);
      }
      outcomes.push({
        status: rateLimited ? "pending" : "failed",
        code,
      });
    }
    return outcomes;
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
    escavadorToken: await getEscavadorToken(auth.admin),
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

  const results = {
    processed: 0,
    succeeded: 0,
    partial: 0,
    failed: 0,
    pending: 0,
  };
  const failures: Array<{ reference: string; code: string }> = [];

  const typedSources = (sources ?? []) as SyncSource[];
  const legacySources = typedSources.filter((source) =>
    source.provider !== "djen"
  );
  const djenSources = typedSources.filter((source) =>
    source.provider === "djen"
  );

  for (const source of legacySources) {
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

  for (const group of groupDjenReferences(djenSources)) {
    const outcomes = await reconcileDjenGroup(context, group);
    let rateLimited = false;
    outcomes.forEach((outcome, index) => {
      const source = group[index];
      results.processed += 1;
      if (outcome.status === "succeeded") results.succeeded += 1;
      else if (outcome.status === "partial") results.partial += 1;
      else if (outcome.status === "pending") results.pending += 1;
      else results.failed += 1;
      if (outcome.code) {
        failures.push({ reference: source.reference, code: outcome.code });
        if (outcome.code === "djen_rate_limited") rateLimited = true;
      }
    });
    // O limite é por IP. As demais fontes ficam vencidas para a próxima janela,
    // sem produzir chamadas que o CNJ já informou que recusará.
    if (rateLimited) break;
  }

  return json({
    mode: auth.mode,
    ...results,
    failures: failures.slice(0, 20),
    message: results.processed === 0
      ? "Nenhuma fonte monitorada estava pendente."
      : `${results.succeeded + results.partial} de ${results.processed} fonte(s) reconciliada(s).`,
  });
});
