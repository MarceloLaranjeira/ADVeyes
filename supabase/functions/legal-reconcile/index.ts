// Reconciliação das fontes monitoradas.
// Executa a cada dez minutos por agendamento e também atende à sincronização
// manual de um escritório. O trabalho é dividido por escritório e por fonte:
// a falha de uma fonte nunca interrompe as demais.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  json,
  resolveTenantLegalAccess,
  type TenantLegalAccess,
} from "../_shared/tenant-auth.ts";
import { describeError, postgrestErrorCode } from "../_shared/error-mapping.ts";
import { normalizeDataJudAuthorization } from "../_shared/datajud-auth.ts";
import {
  DataJudApiError,
  discoverProcessesByOab,
  fetchDataJudProcess,
} from "../_shared/datajud-client.ts";
import {
  DjenApiError,
  fetchDjenPublications,
  groupDjenReferences,
  type DjenFetchResult,
} from "../_shared/djen-client.ts";
import {
  discoverLawyerProcesses,
  EscavadorApiError,
  fetchEscavadorProcessCover,
  fetchEscavadorProcessMovements,
  fetchEscavadorProcessSummary,
  fetchEscavadorProcessSummaryStatus,
  fetchEscavadorPublicDocuments,
  requestEscavadorProcessSummary,
} from "../_shared/escavador-client.ts";
import {
  createPublicationReviewTasks,
  createPublicationHearingCandidates,
  indexProcessesByNumber,
  ingestMovements,
  ingestProcessMetadata,
  ingestProcessParties,
  reconcileProcessContacts,
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
  normalizeEscavadorProcessParties,
  normalizeProcessDiscoveryParties,
  normalizeEscavadorMovement,
  normalizeEscavadorPublicDocument,
  RECONCILIATION_INTERVAL_MS,
} from "../_shared/legal-normalization.ts";
import { getEscavadorToken } from "../_shared/provider-secrets.ts";
import {
  autoImportDiscoveries,
  resolveRegistrationActor,
} from "../_shared/legal-auto-import.ts";
import {
  assertProviderBudget,
  ProviderBudgetError,
  recordProviderUsage,
} from "../_shared/provider-quota.ts";
import { selectFairLegalSources } from "../_shared/legal-source-scheduling.ts";

const CNJ_PATTERN = /^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$/;
const DEFAULT_BATCH = 40;
const MAX_BATCH = 200;
// A importação é durável e continua no cron seguinte. Limitar cada passagem
// evita que uma OAB com centenas de processos esgote a vida útil do worker e
// deixe a execução presa em "running".
const AUTO_IMPORT_BATCH = 200;
const DJEN_INITIAL_LOOKBACK_DAYS = 7;
const DJEN_OVERLAP_DAYS = 1;

/** Falhas que não se resolvem com retentativa e exigem ação humana. */
const PERMANENT_FAILURES = new Set([
  "escavador_unauthorized",
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
  lawyer_registration_id: string | null;
  reference: string;
  failure_count: number;
  last_success_at: string | null;
  sync_cursor: string | null;
  next_sync_at: string;
  created_at: string;
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
  | {
    mode: "manual";
    admin: SupabaseClient;
    tenantId: string;
    userId: string;
    access: TenantLegalAccess;
  }
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

  let access: TenantLegalAccess | null;
  try {
    access = await resolveTenantLegalAccess(admin, data.user.id, tenantId);
  } catch {
    return json({ error: "operation_failed" }, 500);
  }
  if (!access || !access.canMutate) {
    return json({ error: "permission_denied" }, 403);
  }

  return { mode: "manual", admin, tenantId, userId: data.user.id, access };
}

async function pendingCandidateIds(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    registrationId: string;
    provider: "datajud" | "djen" | "escavador";
    processNumbers: string[];
  },
): Promise<string[]> {
  if (!input.processNumbers.length) return [];
  const { data, error } = await admin.from("process_discoveries")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("lawyer_registration_id", input.registrationId)
    .eq("provider", input.provider)
    .eq("state", "candidate")
    .in("numero_cnj", input.processNumbers)
    .limit(AUTO_IMPORT_BATCH);
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

function djenRecipientName(
  recipients: Array<Record<string, unknown>>,
  side: "A" | "P",
): string | null {
  const recipient = recipients.find((item) => item.polo === side);
  return typeof recipient?.nome === "string" && recipient.nome.trim()
    ? recipient.nome.trim()
    : null;
}

/**
 * Uma publicação oficial também é evidência da existência do processo. Ao
 * materializá-la como descoberta, o fluxo transacional existente cria o
 * processo, os vínculos da OAB e as fontes de monitoramento sem duplicatas.
 */
async function materializeDjenProcesses(
  context: ReconcileContext,
  source: SyncSource,
  publications: ReturnType<typeof normalizeDjenPublication>[],
): Promise<number> {
  if (!source.lawyer_registration_id) return 0;

  const byNumber = new Map<string, (typeof publications)[number]>();
  for (const publication of publications) {
    if (publication.numeroProcesso && CNJ_PATTERN.test(publication.numeroProcesso)) {
      byNumber.set(publication.numeroProcesso, publication);
    }
  }
  if (!byNumber.size) return 0;

  const rows = [...byNumber.values()].map((publication) => ({
    tenant_id: source.tenant_id,
    lawyer_registration_id: source.lawyer_registration_id,
    numero_cnj: publication.numeroProcesso!,
    provider: "djen",
    state: "candidate",
    title_active_party: djenRecipientName(publication.recipients, "A"),
    title_passive_party: djenRecipientName(publication.recipients, "P"),
    tribunal: publication.tribunal,
    court_unit: publication.courtBody,
    last_movement_at: publication.publishedAt,
    provider_fetched_at: new Date().toISOString(),
    provider_payload: publication.payload,
  }));

  const { error } = await context.admin.from("process_discoveries").upsert(rows, {
    onConflict: "tenant_id,lawyer_registration_id,numero_cnj,provider",
    ignoreDuplicates: true,
  });
  if (error) throw error;

  const candidateIds = await pendingCandidateIds(context.admin, {
    tenantId: source.tenant_id,
    registrationId: source.lawyer_registration_id,
    provider: "djen",
    processNumbers: [...byNumber.keys()],
  });
  const imported = await autoImportDiscoveries(context.admin, {
    tenantId: source.tenant_id,
    candidateIds,
  });
  return imported.imported;
}

async function importStoredCandidates(
  context: ReconcileContext,
  tenantId: string,
  registrationId: string,
): Promise<void> {
  const { data, error } = await context.admin.from("process_discoveries")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("lawyer_registration_id", registrationId)
    .eq("state", "candidate")
    .limit(AUTO_IMPORT_BATCH);
  if (error) throw error;
  await autoImportDiscoveries(context.admin, {
    tenantId,
    candidateIds: (data ?? []).map((row) => row.id),
  });
}

async function reconcileOabSource(
  context: ReconcileContext,
  source: SyncSource,
): Promise<IngestionResult> {
  // O Escavador não expõe consulta de diários por OAB sob demanda: publicações
  // vêm do DJEN. A descoberta por OAB é importada automaticamente.
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
  await importStoredCandidates(context, source.tenant_id, registration.id);
  if (!context.escavadorToken) {
    throw new Error("integration_not_configured");
  }

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
    return { received: result.processes.length, created: 0, ignored: 0, createdIds: [] };
  }

  const { error: saveError } = await context.admin
    .from("process_discoveries")
    .upsert(rows, {
      onConflict: "tenant_id,lawyer_registration_id,numero_cnj,provider",
      ignoreDuplicates: true,
    });
  if (saveError) throw saveError;

  const candidateIds = await pendingCandidateIds(context.admin, {
    tenantId: source.tenant_id,
    registrationId: registration.id,
    provider: "escavador",
    processNumbers: rows.map((row) => row.numero_cnj),
  });
  const imported = await autoImportDiscoveries(context.admin, {
    tenantId: source.tenant_id,
    candidateIds,
  });
  return {
    received: result.processes.length,
    created: imported.imported,
    ignored: result.processes.length - imported.imported,
    createdIds: imported.processes.map((process) => process.processId),
  };
}

async function reconcileDataJudOabSource(
  context: ReconcileContext,
  source: SyncSource,
): Promise<IngestionResult> {
  const [oabNumber, oabState] = source.reference.split("/");
  const { data: registration, error: registrationError } = await context.admin
    .from("lawyer_registrations")
    .select("id")
    .eq("tenant_id", source.tenant_id)
    .eq("oab_number", oabNumber)
    .eq("oab_state", oabState)
    .maybeSingle();
  if (registrationError) throw registrationError;
  if (!registration) throw new Error("registration_not_found");
  await importStoredCandidates(context, source.tenant_id, registration.id);
  if (!context.dataJudAuthorization) {
    throw new Error("integration_not_configured");
  }

  const discovered = await discoverProcessesByOab({
    authorization: context.dataJudAuthorization,
    oabNumber,
    oabState,
  });
  const rows = discovered.flatMap((item) => {
    const processNumber = formatCnj(item.numeroProcesso);
    if (!CNJ_PATTERN.test(processNumber)) return [];
    return [{
      tenant_id: source.tenant_id,
      lawyer_registration_id: registration.id,
      numero_cnj: processNumber,
      provider: "datajud",
      state: "candidate",
      title_active_party: item.poloAtivo,
      title_passive_party: item.poloPassivo,
      tribunal: item.tribunal,
      court_unit: item.orgaoJulgador,
      process_status: null,
      last_movement_at: item.ultimaAtualizacao,
      provider_fetched_at: new Date().toISOString(),
      provider_payload: item,
    }];
  });

  if (rows.length) {
    const { error } = await context.admin.from("process_discoveries").upsert(
      rows,
      {
        onConflict: "tenant_id,lawyer_registration_id,numero_cnj,provider",
        ignoreDuplicates: true,
      },
    );
    if (error) throw error;
  }

  const candidateIds = await pendingCandidateIds(context.admin, {
    tenantId: source.tenant_id,
    registrationId: registration.id,
    provider: "datajud",
    processNumbers: rows.map((row) => row.numero_cnj),
  });
  const imported = await autoImportDiscoveries(context.admin, {
    tenantId: source.tenant_id,
    candidateIds,
  });

  await context.admin.from("lawyer_registrations").update({
    last_discovery_at: new Date().toISOString(),
  }).eq("tenant_id", source.tenant_id).eq("id", registration.id);

  return {
    received: discovered.length,
    created: imported.imported,
    ignored: discovered.length - imported.imported,
    createdIds: imported.processes.map((process) => process.processId),
  };
}

async function reconcileProcessSource(
  context: ReconcileContext,
  source: SyncSource,
): Promise<IngestionResult> {
  if (!context.dataJudAuthorization && !context.escavadorToken) {
    throw new Error("integration_not_configured");
  }
  if (!source.process_id) {
    throw new Error("source_without_process");
  }

  const { data: process, error } = await context.admin
    .from("processos")
    .select("id, numero, cliente_nome, tribunal, vara, status, legal_summary_status, legal_summary_request_id, legal_summary_requested_at")
    .eq("tenant_id", source.tenant_id)
    .eq("id", source.process_id)
    .maybeSingle();
  if (error) throw error;
  if (!process) throw new Error("process_not_found");

  const partyResult: IngestionResult = { received: 0, created: 0, ignored: 0, createdIds: [] };
  const movementResult: IngestionResult = { received: 0, created: 0, ignored: 0, createdIds: [] };

  // A descoberta por OAB frequentemente já contém a capa completa do
  // Escavador. Reutilizá-la preenche os polos mesmo quando o DataJud omite
  // `partes` e não consome uma nova consulta do provedor complementar.
  const { data: discoveries, error: discoveriesError } = await context.admin
    .from("process_discoveries")
    .select("provider, title_active_party, title_passive_party, provider_payload")
    .eq("tenant_id", source.tenant_id)
    .eq("numero_cnj", formatCnj(process.numero))
    .order("provider_fetched_at", { ascending: false })
    .limit(20);
  if (discoveriesError) throw discoveriesError;
  for (const discovery of discoveries ?? []) {
    if (!["datajud", "djen", "escavador"].includes(discovery.provider)) continue;
    const storedParties = await ingestProcessParties(context.admin, {
      tenantId: source.tenant_id,
      processId: source.process_id,
      parties: normalizeProcessDiscoveryParties({
        provider: discovery.provider as "datajud" | "djen" | "escavador",
        titleActiveParty: discovery.title_active_party,
        titlePassiveParty: discovery.title_passive_party,
        providerPayload: discovery.provider_payload && typeof discovery.provider_payload === "object"
          ? discovery.provider_payload as Record<string, unknown>
          : null,
      }),
    });
    partyResult.received += storedParties.received;
    partyResult.created += storedParties.created;
    partyResult.ignored += storedParties.ignored;
  }
  if (partyResult.received) {
    await reconcileProcessContacts(context.admin, {
      tenantId: source.tenant_id,
      processId: source.process_id,
    });
  }

  // Tenta a reconciliação oficial do DataJud sem bloquear o Escavador se falhar ou não retornar dados.
  if (context.dataJudAuthorization) {
    try {
      const found = await fetchDataJudProcess({
        authorization: context.dataJudAuthorization,
        cnj: source.reference,
      });
      if (found) {
        await ingestProcessMetadata(context.admin, {
          tenantId: source.tenant_id,
          processId: source.process_id,
          metadata: normalizeDataJudProcessMetadata(found.rawSource),
        });
        const djParties = await ingestProcessParties(context.admin, {
          tenantId: source.tenant_id,
          processId: source.process_id,
          parties: normalizeDataJudParties(found.rawSource),
        });
        await reconcileProcessContacts(context.admin, {
          tenantId: source.tenant_id,
          processId: source.process_id,
        });
        partyResult.received += djParties.received;
        partyResult.created += djParties.created;
        partyResult.ignored += djParties.ignored;

        const djMovements = await ingestMovements(context.admin, {
          tenantId: source.tenant_id,
          processId: source.process_id,
          provider: "datajud",
          movements: normalizeDataJudMovements(found),
        });
        movementResult.received += djMovements.received;
        movementResult.created += djMovements.created;
        movementResult.ignored += djMovements.ignored;
        movementResult.createdIds.push(...djMovements.createdIds);
      }
    } catch (dataJudError) {
      console.error("DataJud lookup failed in reconciliation pass", {
        tenantId: source.tenant_id,
        processId: source.process_id,
        code: errorCode(dataJudError),
      });
    }
  }

  // A capa complementar é paga e só é buscada na primeira reconciliação.
  // Depois disso, monitor e webhook mantêm movimentos/documentos atualizados.
  if (context.escavadorToken && source.sync_cursor !== "escavador-cover") {
    try {
      await assertProviderBudget(context.admin, {
        tenantId: source.tenant_id,
        provider: "escavador",
        service: "process_cover",
      });
      const cover = await fetchEscavadorProcessCover({
        token: context.escavadorToken,
        processNumber: process.numero,
      });
      const complementaryParties = await ingestProcessParties(context.admin, {
        tenantId: source.tenant_id,
        processId: source.process_id,
        parties: normalizeEscavadorProcessParties(cover),
      });
      await reconcileProcessContacts(context.admin, {
        tenantId: source.tenant_id,
        processId: source.process_id,
      });
      await recordProviderUsage(context.admin, {
        tenantId: source.tenant_id,
        provider: "escavador",
        operation: "process_lookup",
        service: "process_cover",
        itemCount: complementaryParties.received,
        externalReference: process.numero,
        metadata: { processId: source.process_id },
      });
      await context.admin.from("legal_sync_sources").update({
        sync_cursor: "escavador-cover",
      }).eq("tenant_id", source.tenant_id).eq("id", source.id);
      partyResult.received += complementaryParties.received;
      partyResult.created += complementaryParties.created;
      partyResult.ignored += complementaryParties.ignored;
    } catch (error) {
      // A fonte complementar nunca invalida a reconciliação oficial. Sem o
      // cursor de sucesso, ela será tentada novamente em outro ciclo.
      console.error("Escavador complementary cover failed", {
        tenantId: source.tenant_id,
        processId: source.process_id,
        code: errorCode(error),
      });
    }
  }

  // O Escavador complementa com o histórico paginado e com os documentos públicos, sem sobrescrever dados.
  if (context.escavadorToken) {
    try {
      await assertProviderBudget(context.admin, {
        tenantId: source.tenant_id,
        provider: "escavador",
        service: "process_movements",
      });
      const [movements, documents] = await Promise.all([
        fetchEscavadorProcessMovements({
          token: context.escavadorToken,
          processNumber: process.numero,
        }),
        fetchEscavadorPublicDocuments({
          token: context.escavadorToken,
          processNumber: process.numero,
        }),
      ]);
      const complementaryResult = await ingestMovements(context.admin, {
        tenantId: source.tenant_id,
        processId: source.process_id,
        provider: "escavador",
        movements: [
          ...movements.items.map(normalizeEscavadorMovement),
          ...documents.items.map(normalizeEscavadorPublicDocument),
        ],
      });
      await recordProviderUsage(context.admin, {
        tenantId: source.tenant_id,
        provider: "escavador",
        operation: "process_lookup",
        service: "process_movements",
        itemCount: complementaryResult.received,
        externalReference: process.numero,
        metadata: {
          processId: process.id,
          movementPages: movements.pages,
          documentPages: documents.pages,
          documents: documents.items.length,
        },
      });
      movementResult.received += complementaryResult.received;
      movementResult.created += complementaryResult.created;
      movementResult.ignored += complementaryResult.ignored;
      movementResult.createdIds.push(...complementaryResult.createdIds);
    } catch (complementaryError) {
      console.error("Escavador movements/documents failed", {
        tenantId: source.tenant_id,
        processId: process.id,
        code: errorCode(complementaryError),
      });
    }
  }

  let needsInternalSummary = !context.escavadorToken &&
    process.legal_summary_status !== "ready";
  if (context.escavadorToken && process.legal_summary_status !== "ready") {
    try {
      const requestedAt = process.legal_summary_requested_at
        ? new Date(process.legal_summary_requested_at).getTime()
        : 0;
      const isTimedOut = requestedAt > 0 && (Date.now() - requestedAt > 24 * 60 * 60 * 1000);

      if (
        process.legal_summary_status === "processing" &&
        process.legal_summary_request_id &&
        process.legal_summary_request_id !== "undefined" &&
        !isTimedOut
      ) {
        const job = await fetchEscavadorProcessSummaryStatus({
          token: context.escavadorToken,
          processNumber: process.numero,
          requestId: process.legal_summary_request_id,
        });
        const statusUpper = String(job.status || "").toUpperCase();
        if (["FINALIZADO", "CONCLUIDO", "SUCESSO", "DONE", "READY"].includes(statusUpper)) {
          const summary = await fetchEscavadorProcessSummary({
            token: context.escavadorToken,
            processNumber: process.numero,
          });
          const content = (summary.conteudo || summary.resumo || summary.texto || "").trim();
          await context.admin.from("processos").update({
            legal_summary: content || null,
            legal_summary_status: content ? "ready" : "unavailable",
            legal_summary_provider: "escavador",
            legal_summary_updated_at: summary.atualizado_em ?? new Date().toISOString(),
          }).eq("tenant_id", source.tenant_id).eq("id", process.id);
          needsInternalSummary = !content;
        } else if (["ERRO", "FAILED", "ERROR"].includes(statusUpper)) {
          needsInternalSummary = true;
        }
      } else if (isTimedOut) {
        needsInternalSummary = true;
      } else {
        await assertProviderBudget(context.admin, {
          tenantId: source.tenant_id,
          provider: "escavador",
          service: "process_ai_summary",
        });
        const job = await requestEscavadorProcessSummary({
          token: context.escavadorToken,
          processNumber: process.numero,
        });
        const jobId = String(job.id || "");
        const statusUpper = String(job.status || "").toUpperCase();

        if (["FINALIZADO", "CONCLUIDO", "SUCESSO", "DONE", "READY"].includes(statusUpper) || !jobId) {
          const summary = await fetchEscavadorProcessSummary({
            token: context.escavadorToken,
            processNumber: process.numero,
          });
          const content = (summary.conteudo || summary.resumo || summary.texto || "").trim();
          await context.admin.from("processos").update({
            legal_summary: content || null,
            legal_summary_status: content ? "ready" : "unavailable",
            legal_summary_provider: "escavador",
            legal_summary_updated_at: summary.atualizado_em ?? new Date().toISOString(),
          }).eq("tenant_id", source.tenant_id).eq("id", process.id);
          needsInternalSummary = !content;
        } else {
          await Promise.all([
            context.admin.from("processos").update({
              legal_summary_status: "processing",
              legal_summary_provider: "escavador",
              legal_summary_request_id: jobId,
              legal_summary_requested_at: new Date().toISOString(),
            }).eq("tenant_id", source.tenant_id).eq("id", process.id),
            recordProviderUsage(context.admin, {
              tenantId: source.tenant_id,
              provider: "escavador",
              operation: "process_lookup",
              service: "process_ai_summary",
              externalReference: process.numero,
              metadata: { processId: process.id, requestId: jobId },
            }),
          ]);
        }
      }
    } catch (summaryError) {
      // Resumo é complementar e assíncrono. A reconciliação oficial continua
      // útil e a próxima passagem retoma o estado persistido.
      console.error("Escavador process summary failed", {
        tenantId: source.tenant_id,
        processId: process.id,
        code: errorCode(summaryError),
      });
      needsInternalSummary = true;
    }
  }

  if (needsInternalSummary) {
    const [{ data: parties }, { data: movements }] = await Promise.all([
      context.admin.from("process_parties")
        .select("display_name, side, procedural_role")
        .eq("tenant_id", source.tenant_id)
        .eq("process_id", process.id)
        .order("created_at", { ascending: true })
        .limit(12),
      context.admin.from("process_movements")
        .select("occurred_at, title, content")
        .eq("tenant_id", source.tenant_id)
        .eq("process_id", process.id)
        .order("occurred_at", { ascending: false })
        .limit(3),
    ]);
    const active = (parties ?? []).filter((party) => party.side === "ativo")
      .map((party) => party.display_name);
    const passive = (parties ?? []).filter((party) => party.side === "passivo")
      .map((party) => party.display_name);
    const latest = movements?.[0];
    const parts = [
      `Processo ${process.numero}.`,
      process.status ? `Situação cadastrada: ${process.status}.` : null,
      process.tribunal || process.vara
        ? `Tramitação: ${[process.tribunal, process.vara].filter(Boolean).join(" — ")}.`
        : null,
      active.length ? `Polo ativo: ${active.join(", ")}.` : null,
      passive.length ? `Polo passivo: ${passive.join(", ")}.` : null,
      latest
        ? `Último andamento registrado em ${new Date(latest.occurred_at).toLocaleDateString("pt-BR", { timeZone: "America/Manaus" })}: ${(latest.title || latest.content || "movimentação processual").slice(0, 500)}.`
        : "Ainda não há andamento disponível na fonte consultada.",
    ].filter(Boolean);
    await context.admin.from("processos").update({
      legal_summary: parts.join(" "),
      legal_summary_status: "ready",
      legal_summary_provider: "internal",
      legal_summary_updated_at: new Date().toISOString(),
    }).eq("tenant_id", source.tenant_id).eq("id", process.id);
  }

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
    const result = source.source_kind === "oab"
      ? source.provider === "escavador"
        ? await reconcileOabSource(context, source)
        : await reconcileDataJudOabSource(context, source)
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
      code === "escavador_insufficient_balance" ||
      code === "tenant_budget_exceeded" ||
      code === "platform_budget_exceeded";
    const permanent = !pending && PERMANENT_FAILURES.has(code);
    const delay = pending || permanent
      ? null
      : nextAttemptDelayMs(source.failure_count);
    // Depois da escala curta, falhas transitórias continuam ativas no ritmo
    // normal. O limite antigo desligava a fonte para sempre e obrigava o
    // advogado a sincronizar manualmente.
    const stopped = permanent;

    await context.admin.from("legal_sync_sources").update({
      failure_count: pending
        ? source.failure_count
        : source.failure_count + 1,
      last_attempt_at: finishedAt,
      last_error_code: code,
      last_error_message: errorMessage(error),
      active: !stopped,
      paused_reason: permanent ? code : null,
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

  let processRows = (processes ?? []) as Array<
    ProcessReference & { numero: string }
  >;
  const normalized = fetched.items.map((publication) =>
    normalizeDjenPublication(publication, { receivedAt })
  );
  const importedProcesses = source.source_kind === "oab"
    ? await materializeDjenProcesses(context, source, normalized)
    : 0;
  if (importedProcesses > 0) {
    const { data: refreshedProcesses, error: refreshError } = await context.admin
      .from("processos")
      .select("id, numero, cliente_nome, user_id")
      .eq("tenant_id", source.tenant_id);
    if (refreshError) throw refreshError;
    processRows = (refreshedProcesses ?? []) as Array<
      ProcessReference & { numero: string }
    >;
  }
  const registrationActor = source.lawyer_registration_id
    ? await resolveRegistrationActor(
      context.admin,
      source.tenant_id,
      source.lawyer_registration_id,
    )
    : null;
  const fallbackUserId = context.actorId ?? registrationActor ??
    processRows.find((process) => process.user_id)?.user_id ?? null;
  if (!fallbackUserId) {
    throw new Error("tenant_operational_user_not_found");
  }
  const result = await ingestPublications(context.admin, {
    tenantId: source.tenant_id,
    provider: "djen",
    fallbackUserId,
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
  await createPublicationHearingCandidates(context.admin, {
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
      // Rate limit, timeout e indisponibilidade do CNJ são transitórios. Após
      // a escala curta, a fonte volta ao intervalo normal em vez de ser
      // desligada silenciosamente depois de cinco tentativas.
      const stopped = permanent;
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

async function drainPendingImportQueue(
  context: ReconcileContext,
  tenantId: string | null,
): Promise<{ tenants: number; imported: number; failed: number }> {
  let query = context.admin.from("process_discoveries")
    .select("id, tenant_id")
    .eq("state", "candidate")
    .order("created_at", { ascending: true })
    .limit(2_000);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) throw error;

  const byTenant = new Map<string, string[]>();
  for (const candidate of data ?? []) {
    const ids = byTenant.get(candidate.tenant_id) ?? [];
    if (ids.length < AUTO_IMPORT_BATCH) ids.push(candidate.id);
    byTenant.set(candidate.tenant_id, ids);
  }

  let imported = 0;
  let failed = 0;
  for (const [candidateTenantId, candidateIds] of byTenant) {
    const result = await autoImportDiscoveries(context.admin, {
      tenantId: candidateTenantId,
      candidateIds,
    });
    imported += result.imported;
    failed += result.failed;
  }
  return { tenants: byTenant.size, imported, failed };
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

  // Uma interrupção abrupta do runtime não passa pelos blocos de captura. Na
  // execução seguinte, encerramos registros órfãos antes de abrir novos runs.
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { error: staleRunError } = await auth.admin.from("legal_sync_runs")
    .update({
      status: "failed",
      error_code: "worker_interrupted",
      error_message:
        "A execução anterior foi interrompida; a fonte voltou automaticamente para a fila.",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", staleCutoff);
  if (staleRunError) {
    console.error("legal-reconcile: stale run cleanup failed", staleRunError);
  }

  let queueImport = { tenants: 0, imported: 0, failed: 0 };
  // A fila é consumida em todas as execuções; ela não depende de uma nova
  // consulta paga da OAB. Assim, centenas de descobertas avançam a cada dez
  // minutos até zerar, mesmo que as fontes estejam no intervalo de 6 horas.
  if (auth.mode === "scheduled" || auth.access.canManageAll) {
    try {
      queueImport = await drainPendingImportQueue(
        context,
        auth.mode === "manual" ? auth.tenantId : null,
      );
    } catch (queueError) {
      console.error("legal-reconcile: automatic import queue failed", {
        code: errorCode(queueError),
      });
    }
  }

  const sourceFields =
    "id, tenant_id, source_kind, provider, process_id, lawyer_registration_id, reference, failure_count, last_success_at, sync_cursor, next_sync_at, created_at";
  let sources: SyncSource[] = [];

  if (auth.mode === "manual") {
    // A sincronização manual ignora o agendamento do escritório atual.
    const [processResult, oabResult] = await Promise.all([
      auth.admin.from("legal_sync_sources").select(sourceFields)
        .eq("active", true).eq("tenant_id", auth.tenantId)
        .eq("source_kind", "process")
        .order("next_sync_at", { ascending: true }).limit(MAX_BATCH * 5),
      auth.admin.from("legal_sync_sources").select(sourceFields)
        .eq("active", true).eq("tenant_id", auth.tenantId)
        .eq("source_kind", "oab")
        .order("next_sync_at", { ascending: true }).limit(MAX_BATCH * 5),
    ]);
    if (processResult.error || oabResult.error) {
      return json({ error: "operation_failed" }, 500);
    }
    sources = [
      ...((processResult.data ?? []) as SyncSource[]),
      ...((oabResult.data ?? []) as SyncSource[]),
    ];
  } else {
    const dueAt = new Date().toISOString();
    // Consulta os processos diretamente. Aplicar um limite global antes de
    // separar OABs deixava processos novos escondidos atrás de uma fila grande
    // de descoberta e mantinha o resumo vazio por vários ciclos.
    const { data: processSources, error: processError } = await auth.admin
      .from("legal_sync_sources")
      .select(sourceFields)
      .eq("active", true)
      .eq("source_kind", "process")
      .lte("next_sync_at", dueAt)
      .order("next_sync_at", { ascending: true })
      .limit(DEFAULT_BATCH * 5);
    if (processError) return json({ error: "operation_failed" }, 500);

    const { data: oabSources, error: oabError } = await auth.admin
      .from("legal_sync_sources")
      .select(sourceFields)
      .eq("active", true)
      .eq("source_kind", "oab")
      .lte("next_sync_at", dueAt)
      .order("next_sync_at", { ascending: true })
      .limit(DEFAULT_BATCH * 5);
    if (oabError) return json({ error: "operation_failed" }, 500);
    sources = [
      ...((processSources ?? []) as SyncSource[]),
      ...((oabSources ?? []) as SyncSource[]),
    ];
  }

  let scopedSources = sources;
  if (auth.mode === "manual" && !auth.access.canManageAll) {
    const { data: ownProfessionals, error: professionalError } = await auth.admin
      .from("equipe")
      .select("id")
      .eq("tenant_id", auth.tenantId)
      .eq("user_id", auth.userId)
      .eq("ativo", true);
    if (professionalError) return json({ error: "operation_failed" }, 500);
    const professionalIds = (ownProfessionals ?? []).map((row) => row.id);
    const { data: registrations, error: registrationError } = professionalIds.length
      ? await auth.admin.from("lawyer_registrations").select("id")
        .eq("tenant_id", auth.tenantId).in("professional_id", professionalIds)
      : { data: [], error: null };
    if (registrationError) return json({ error: "operation_failed" }, 500);
    const registrationIds = new Set((registrations ?? []).map((row) => row.id));
    const { data: links, error: linkError } = registrationIds.size
      ? await auth.admin.from("process_lawyers").select("process_id")
        .eq("tenant_id", auth.tenantId)
        .in("lawyer_registration_id", [...registrationIds])
      : { data: [], error: null };
    if (linkError) return json({ error: "operation_failed" }, 500);
    const processIds = new Set((links ?? []).map((row) => row.process_id));
    scopedSources = scopedSources.filter((source) =>
      (source.lawyer_registration_id && registrationIds.has(source.lawyer_registration_id)) ||
      (source.process_id && processIds.has(source.process_id))
    );
  }

  scopedSources = selectFairLegalSources(
    scopedSources.filter((source) => source.source_kind === "process"),
    scopedSources.filter((source) => source.source_kind === "oab"),
    auth.mode === "manual" ? MAX_BATCH : DEFAULT_BATCH,
  );

  const results = {
    processed: 0,
    succeeded: 0,
    partial: 0,
    failed: 0,
    pending: 0,
  };
  const failures: Array<{ reference: string; code: string }> = [];

  const typedSources = scopedSources;
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
    queueImport,
    failures: failures.slice(0, 20),
    message: results.processed === 0
      ? "Nenhuma fonte monitorada estava pendente."
      : `${results.succeeded + results.partial} de ${results.processed} fonte(s) reconciliada(s).`,
  });
});
