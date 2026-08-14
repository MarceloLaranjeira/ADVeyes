import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { complete, resolveProvider } from "../_shared/llm.ts";
import {
  assessIntelligence,
  buildIntelligencePrompt,
  parseSemanticSuggestion,
  PROCESS_INTELLIGENCE_SYSTEM_PROMPT,
  type IntelligenceEvent,
} from "../_shared/process-intelligence.ts";
import {
  authenticateTenantRequest,
  corsHeaders,
  json,
  resolveTenantLegalAccess,
} from "../_shared/tenant-auth.ts";

interface RequestBody {
  action?: "analyze" | "correct" | "work" | "backfill";
  tenantId?: string;
  processId?: string;
  limit?: number;
  correction?: Record<string, unknown>;
  justification?: string;
}

const allowedPhases = new Set(["conhecimento", "recursal", "cumprimento_execucao", "suspenso_sobrestado", "arquivado_encerrado", "nao_identificada"]);
const allowedStages = new Set(["distribuicao", "citacao", "defesa", "instrucao", "pericia", "alegacoes_finais", "sentenca", "preparacao_recurso", "contrarrazoes", "remessa", "julgamento", "transito_julgado", "liquidacao", "cobranca", "penhora", "expropriacao", "pagamento", "suspenso", "arquivado", "nao_identificada"]);
const allowedWaiting = new Set(["escritorio", "cliente", "parte_contraria", "juizo_tribunal", "orgao_externo", "nao_identificado"]);

function serverAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function eventRows(input: { movements: Record<string, unknown>[]; publications: Record<string, unknown>[]; manual: Record<string, unknown>[] }): IntelligenceEvent[] {
  return [
    ...input.movements.map(row => ({ id: `movement:${row.id}`, kind: "movement" as const, occurredAt: row.occurred_at as string | null, title: String(row.title ?? row.document_type ?? row.movement_type ?? "Andamento"), content: [row.content, row.description, row.notes].filter(Boolean).join("\n") })),
    ...input.publications.map(row => ({ id: `publication:${row.id}`, kind: "publication" as const, occurredAt: row.data_publicacao as string | null, title: String(row.tipo ?? "Publicação"), content: String(row.conteudo_simplificado ?? row.conteudo ?? "") })),
    ...input.manual.map(row => ({ id: `manual:${row.id}`, kind: "manual" as const, occurredAt: row.data_andamento as string | null, title: String(row.tipo ?? "Andamento manual"), content: String(row.descricao ?? "") })),
  ].sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime());
}

async function analyzeOne(admin: SupabaseClient, tenantId: string, processId: string, useSemantic = true) {
  const [processResult, movementsResult, publicationsResult, manualResult, settingsResult, deadlineResult, currentResult] = await Promise.all([
    admin.from("processos").select("id, numero, status, area, tribunal, vara, adjudicating_body").eq("tenant_id", tenantId).eq("id", processId).maybeSingle(),
    admin.from("process_movements").select("id, occurred_at, title, content, description, notes, movement_type, document_type").eq("tenant_id", tenantId).eq("process_id", processId).order("occurred_at", { ascending: false }).limit(100),
    admin.from("publicacoes").select("id, data_publicacao, tipo, conteudo, conteudo_simplificado").eq("tenant_id", tenantId).eq("process_id", processId).order("data_publicacao", { ascending: false }).limit(50),
    admin.from("andamentos").select("id, data_andamento, tipo, descricao").eq("tenant_id", tenantId).eq("processo_id", processId).order("data_andamento", { ascending: false }).limit(50),
    admin.from("process_intelligence_settings").select("office_days, counterparty_days, court_days").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("tarefas").select("data_limite").eq("tenant_id", tenantId).eq("processo_id", processId).neq("status", "concluída").not("data_limite", "is", null).order("data_limite").limit(1).maybeSingle(),
    admin.from("process_intelligence_current").select("id, origin, manual_override, manual_override_by, manual_override_at").eq("tenant_id", tenantId).eq("process_id", processId).maybeSingle(),
  ]);
  if (processResult.error || !processResult.data) throw new Error("process_not_found");
  for (const result of [movementsResult, publicationsResult, manualResult, settingsResult, deadlineResult, currentResult]) if (result.error) throw result.error;

  const events = eventRows({ movements: movementsResult.data ?? [], publications: publicationsResult.data ?? [], manual: manualResult.data ?? [] });
  let semantic = null;
  if (useSemantic && events.length && resolveProvider()) {
    try {
      const completion = await complete({ system: PROCESS_INTELLIGENCE_SYSTEM_PROMPT, prompt: buildIntelligencePrompt(processResult.data, events), maxTokens: 1_200, effort: "low" });
      semantic = parseSemanticSuggestion(completion.text, events);
    } catch (error) {
      console.error("legal-process-intelligence: semantic analysis unavailable", error);
    }
  }
  const settings = settingsResult.data ?? { office_days: 3, counterparty_days: 15, court_days: 30 };
  const manualOverride = currentResult.data?.origin === "manual" ? currentResult.data.manual_override as Record<string, unknown> : null;
  const assessment = assessIntelligence({ process: processResult.data, events, semantic, thresholds: { officeDays: settings.office_days, counterpartyDays: settings.counterparty_days, courtDays: settings.court_days }, dueAt: deadlineResult.data?.data_limite ?? null, manualOverride });
  const payload = {
    tenant_id: tenantId,
    process_id: processId,
    ...assessment,
    origin: manualOverride ? "manual" : "automatico",
    run_status: !useSemantic || semantic || !events.length || !resolveProvider() ? "ready" : "partial",
    classifier_version: semantic ? "rules-v1+semantic-v1" : "rules-v1",
    analyzed_at: new Date().toISOString(),
    manual_override: manualOverride,
    manual_override_by: currentResult.data?.manual_override_by ?? null,
    manual_override_at: currentResult.data?.manual_override_at ?? null,
    last_error_code: null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin.from("process_intelligence_current").upsert(payload, { onConflict: "tenant_id,process_id" }).select("*").single();
  if (error) throw error;
  await admin.from("process_intelligence_queue").update({ status: "completed", locked_at: null, last_error_code: null, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("process_id", processId);
  return data;
}

async function work(admin: SupabaseClient, limit = 8) {
  const { data: jobs, error } = await admin.from("process_intelligence_queue").select("id, tenant_id, process_id, attempts").in("status", ["pending", "retry"]).lte("available_at", new Date().toISOString()).order("priority", { ascending: false }).order("available_at").limit(Math.min(20, Math.max(1, limit)));
  if (error) throw error;
  const result = { processed: 0, failed: 0 };
  for (const job of jobs ?? []) {
    const { data: claimed } = await admin.from("process_intelligence_queue").update({ status: "processing", locked_at: new Date().toISOString(), attempts: job.attempts + 1, updated_at: new Date().toISOString() }).eq("id", job.id).in("status", ["pending", "retry"]).select("id").maybeSingle();
    if (!claimed) continue;
    try {
      await analyzeOne(admin, job.tenant_id, job.process_id, false);
      result.processed += 1;
    } catch (cause) {
      console.error("legal-process-intelligence: job failed", { jobId: job.id, cause });
      const attempts = job.attempts + 1;
      await admin.from("process_intelligence_queue").update({ status: attempts >= 3 ? "failed" : "retry", available_at: new Date(Date.now() + attempts * 60_000).toISOString(), locked_at: null, last_error_code: "analysis_failed", updated_at: new Date().toISOString() }).eq("id", job.id);
      result.failed += 1;
    }
  }
  return result;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: RequestBody;
  try { body = await request.json(); } catch { return json({ error: "invalid_payload" }, 400); }

  const workerSecret = Deno.env.get("CRON_SECRET");
  const isWorker = Boolean(workerSecret && request.headers.get("x-cron-secret") === workerSecret);
  if (isWorker && body.action === "work") {
    const admin = serverAdmin();
    if (!admin) return json({ error: "server_configuration_error" }, 500);
    try { return json(await work(admin, body.limit)); } catch (error) { console.error(error); return json({ error: "operation_failed" }, 500); }
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;
  const tenantId = body.tenantId?.trim();
  if (!tenantId) return json({ error: "invalid_payload" }, 400);
  const access = await resolveTenantLegalAccess(auth.admin, auth.user.id, tenantId);
  if (!access) return json({ error: "permission_denied" }, 403);

  try {
    if (body.action === "backfill") {
      if (!access.canManageAll || !access.canMutate) return json({ error: "permission_denied" }, 403);
      const { data: processes, error } = await auth.admin.from("processos").select("id").eq("tenant_id", tenantId).neq("status", "Arquivado").limit(Math.min(500, Math.max(1, body.limit ?? 200)));
      if (error) throw error;
      if (processes?.length) {
        const { error: queueError } = await auth.admin.from("process_intelligence_queue").upsert(processes.map((process, index) => ({ tenant_id: tenantId, process_id: process.id, reason: "backfill", priority: Math.max(1, 20 - Math.floor(index / 20)), status: "pending", attempts: 0, available_at: new Date().toISOString(), locked_at: null, last_error_code: null, updated_at: new Date().toISOString() })), { onConflict: "tenant_id,process_id" });
        if (queueError) throw queueError;
      }
      return json({ queued: processes?.length ?? 0 });
    }

    const processId = body.processId?.trim();
    if (!processId) return json({ error: "invalid_payload" }, 400);
    const { data: process } = await auth.admin.from("processos").select("id").eq("tenant_id", tenantId).eq("id", processId).maybeSingle();
    if (!process) return json({ error: "process_not_found" }, 404);

    if (body.action === "correct") {
      if (!access.canMutate || !body.correction || (body.justification?.trim().length ?? 0) < 3) return json({ error: "invalid_payload" }, 400);
      const correction = body.correction;
      if (correction.phase && !allowedPhases.has(String(correction.phase))) return json({ error: "invalid_payload" }, 400);
      if (correction.stage && !allowedStages.has(String(correction.stage))) return json({ error: "invalid_payload" }, 400);
      if (correction.waitingOn && !allowedWaiting.has(String(correction.waitingOn))) return json({ error: "invalid_payload" }, 400);
      const manualOverride = { ...correction, justification: body.justification!.trim().slice(0, 600) };
      const update: Record<string, unknown> = { origin: "manual", manual_override: manualOverride, manual_override_by: auth.user.id, manual_override_at: new Date().toISOString(), classifier_version: "manual-v1", updated_at: new Date().toISOString() };
      if (correction.phase) update.phase = correction.phase;
      if (correction.stage) update.stage = correction.stage;
      if (correction.waitingOn) update.waiting_on = correction.waitingOn;
      if ("waitingReason" in correction) update.waiting_reason = correction.waitingReason;
      if ("nextAction" in correction) update.next_action = correction.nextAction;
      const { data, error } = await auth.admin.from("process_intelligence_current").update(update).eq("tenant_id", tenantId).eq("process_id", processId).select("*").single();
      if (error) throw error;
      return json({ intelligence: data });
    }

    if (body.action !== "analyze") return json({ error: "invalid_action" }, 400);
    if (!access.canMutate) return json({ error: "permission_denied" }, 403);
    return json({ intelligence: await analyzeOne(auth.admin, tenantId, processId) });
  } catch (error) {
    console.error("legal-process-intelligence: operation failed", error);
    return json({ error: error instanceof Error && error.message === "process_not_found" ? "process_not_found" : "operation_failed" }, error instanceof Error && error.message === "process_not_found" ? 404 : 500);
  }
});
