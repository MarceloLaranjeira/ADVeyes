/**
 * Espelhamento da carteira no ClickUp.
 *
 * O escritório trabalha no board; a verdade continua no Supabase. Este módulo
 * só empurra — quem decide o que é prazo continua sendo `deadline_suggestions`
 * e a confirmação do advogado, exatamente como antes. Prazo sugerido chega ao
 * ClickUp marcado como sugerido, e é assim que ele fica até alguém conferir.
 *
 * A forma segue `google-calendar.ts`, que já roda em produção: claim da fila
 * por RPC, retry com backoff, hash de payload para não gastar chamada à toa.
 * Duas diferenças que a API do ClickUp impõe:
 *
 *   1. Não existe upsert. Criar e atualizar são endpoints diferentes, então o
 *      vínculo em `clickup_task_links` é o que impede retry de duplicar card.
 *   2. O rate limit é por token, e o token é do escritório. Por isso os jobs
 *      são processados agrupados por tenant, e um 429 pausa aquele tenant sem
 *      travar os demais.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-worker-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const CLICKUP_API = "https://api.clickup.com/api/v2";

/** Campo de conferência do prazo. Nasce sempre em "sugerido". */
const DEADLINE_REVIEW_PENDING = "Sugerido pelo Horus";
const DEADLINE_REVIEW_CONFIRMED = "Conferido";

type EntityType = "processo" | "prazo" | "audiencia" | "movimentacao" | "tarefa";
type QueueOperation = "upsert" | "delete";

interface QueueJob {
  id: string;
  tenant_id: string;
  entity_type: EntityType;
  entity_id: string;
  operation: QueueOperation;
  attempts: number;
}

interface Connection {
  tenant_id: string;
  workspace_id: string;
  space_id: string;
  encrypted_token: string;
  field_map: Record<string, string>;
  list_map: Record<string, string>;
  status: string;
}

interface TaskLink {
  clickup_task_id: string;
  last_payload_hash: string | null;
  last_movement_at: string | null;
}

export class ClickUpError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    code: string,
    status = 500,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ClickUpError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

/**
 * O token é do escritório, não da plataforma — por isso vive cifrado na linha
 * de `clickup_connections` em vez de no Vault global. A chave mestra fica em
 * `CLICKUP_TOKEN_KEY` (32 bytes, base64) e nunca sai daqui.
 */
async function tokenKey(usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const rawKey = Deno.env.get("CLICKUP_TOKEN_KEY");
  if (!rawKey) {
    throw new ClickUpError("Chave de integração ausente", "missing_token_key");
  }
  return await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(rawKey), (c) => c.charCodeAt(0)),
    { name: "AES-GCM" },
    false,
    [usage],
  );
}

export async function encryptToken(plain: string): Promise<string> {
  const key = await tokenKey("encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );

  const payload = new Uint8Array(iv.length + cipher.length);
  payload.set(iv, 0);
  payload.set(cipher, iv.length);

  let binary = "";
  for (const byte of payload) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function decryptToken(encrypted: string): Promise<string> {
  const key = await tokenKey("decrypt");
  const payload = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = payload.slice(0, 12);
  const body = payload.slice(12);

  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body);
    return new TextDecoder().decode(plain);
  } catch {
    throw new ClickUpError("Credencial ilegível", "token_decrypt_failed");
  }
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export async function cuFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const response = await fetch(`${CLICKUP_API}${path}`, {
    ...init,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 429) {
    // O ClickUp diz quando a janela reabre. Backoff cego aqui só desperdiça
    // tentativa e empurra o prazo para mais tarde.
    const reset = Number(response.headers.get("X-RateLimit-Reset") ?? 0);
    const waitSeconds = reset > 0
      ? Math.max(1, reset - Math.floor(Date.now() / 1000))
      : 60;
    throw new ClickUpError("Limite de requisições atingido", "rate_limited", 429, waitSeconds);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const code = response.status === 401 || response.status === 403
      ? "unauthorized"
      : `http_${response.status}`;
    console.error("clickup: request failed", { path, status: response.status, detail });
    throw new ClickUpError("Falha na chamada ao ClickUp", code, response.status);
  }

  if (response.status === 204) return {};
  return await response.json().catch(() => ({}));
}

// ---------------------------------------------------------------------------
// Montagem dos cards
// ---------------------------------------------------------------------------

function customField(
  map: Record<string, string>,
  logicalName: string,
  value: string | number | null | undefined,
): { id: string; value: string } | null {
  const id = map[logicalName];
  if (!id || value === null || value === undefined || value === "") return null;
  return { id, value: String(value) };
}

interface ProcessoFieldValues {
  id?: string;
  numero?: string;
  vara?: string | null;
  area?: string | null;
  cliente_nome?: string | null;
  polo_ativo?: string | null;
  polo_passivo?: string | null;
  percentual_exito?: string | number | null;
  ultima_movimentacao?: string | null;
}

interface PrazoFieldValues {
  disponibilizacao?: string | null;
  publicacao_cpc?: string | null;
  proposed_days?: number | null;
  reason?: string | null;
  evidence?: string | null;
  publication_id?: string;
  status?: string;
}

function processoFields(map: Record<string, string>, processo: ProcessoFieldValues) {
  return [
    customField(map, "numero_cnj", processo.numero),
    customField(map, "vara", processo.vara),
    customField(map, "area", processo.area),
    customField(map, "cliente", processo.cliente_nome),
    customField(map, "polo_ativo", processo.polo_ativo),
    customField(map, "polo_passivo", processo.polo_passivo),
    customField(map, "percentual_exito", processo.percentual_exito),
    customField(map, "ultima_movimentacao", processo.ultima_movimentacao),
    customField(map, "adveyes_id", processo.id),
    customField(
      map,
      "link_adveyes",
      `${Deno.env.get("APP_URL") ?? ""}/processos/${processo.id}`,
    ),
  ].filter((field): field is { id: string; value: string } => field !== null);
}

function prazoFields(map: Record<string, string>, prazo: PrazoFieldValues) {
  return [
    customField(map, "disponibilizacao", prazo.disponibilizacao),
    customField(map, "publicacao_cpc", prazo.publicacao_cpc),
    customField(map, "dias", prazo.proposed_days),
    customField(map, "base_calculo", [prazo.reason, prazo.evidence].filter(Boolean).join("\n\n")),
    customField(map, "publicacao_id", prazo.publication_id),
    customField(
      map,
      "conferencia",
      prazo.status === "confirmed" ? DEADLINE_REVIEW_CONFIRMED : DEADLINE_REVIEW_PENDING,
    ),
  ].filter((field): field is { id: string; value: string } => field !== null);
}

// ---------------------------------------------------------------------------
// Sincronização por entidade
// ---------------------------------------------------------------------------

async function loadLink(
  admin: SupabaseClient,
  job: QueueJob,
): Promise<TaskLink | null> {
  const { data } = await admin
    .from("clickup_task_links")
    .select("clickup_task_id,last_payload_hash,last_movement_at")
    .eq("tenant_id", job.tenant_id)
    .eq("entity_type", job.entity_type)
    .eq("entity_id", job.entity_id)
    .maybeSingle();
  return (data as TaskLink | null) ?? null;
}

async function saveLink(
  admin: SupabaseClient,
  job: QueueJob,
  taskId: string,
  hash: string,
  lastMovementAt?: string | null,
): Promise<void> {
  await admin.from("clickup_task_links").upsert({
    tenant_id: job.tenant_id,
    entity_type: job.entity_type,
    entity_id: job.entity_id,
    clickup_task_id: taskId,
    last_payload_hash: hash,
    ...(lastMovementAt !== undefined ? { last_movement_at: lastMovementAt } : {}),
    last_synced_at: new Date().toISOString(),
  });
}

/**
 * Movimentação entra como comentário, nunca como card. Um processo de seis
 * anos tem centenas delas — viradas em task, o board fica ilegível na primeira
 * semana e o escritório abandona o produto.
 */
async function pushNewMovements(
  admin: SupabaseClient,
  token: string,
  job: QueueJob,
  taskId: string,
  since: string | null,
): Promise<string | null> {
  let query = admin
    .from("process_movements")
    .select("occurred_at,title,content,source_name")
    .eq("tenant_id", job.tenant_id)
    .eq("process_id", job.entity_id)
    .order("occurred_at", { ascending: true })
    .limit(50);

  if (since) query = query.gt("occurred_at", since);

  const { data: movements } = await query;
  if (!movements?.length) return since;

  let watermark = since;
  for (const movement of movements) {
    const header = [movement.occurred_at?.slice(0, 10), movement.title]
      .filter(Boolean)
      .join(" · ");
    const body = [
      header ? `**${header}**` : null,
      movement.content,
      movement.source_name ? `_Fonte: ${movement.source_name}_` : null,
    ].filter(Boolean).join("\n\n");

    await cuFetch(token, `/task/${taskId}/comment`, {
      method: "POST",
      body: JSON.stringify({ comment_text: body, notify_all: false }),
    });

    if (movement.occurred_at && (!watermark || movement.occurred_at > watermark)) {
      watermark = movement.occurred_at;
    }
  }
  return watermark;
}

async function syncProcesso(
  admin: SupabaseClient,
  connection: Connection,
  token: string,
  job: QueueJob,
): Promise<void> {
  const { data: processo } = await admin
    .from("processos")
    .select("id,numero,area,status,vara,cliente_nome,polo_ativo,polo_passivo,percentual_exito,descricao")
    .eq("tenant_id", job.tenant_id)
    .eq("id", job.entity_id)
    .maybeSingle();

  if (!processo) return;

  const { data: lastMovement } = await admin
    .from("process_movements")
    .select("occurred_at")
    .eq("tenant_id", job.tenant_id)
    .eq("process_id", job.entity_id)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshot = {
    ...processo,
    ultima_movimentacao: lastMovement?.occurred_at?.slice(0, 10) ?? null,
  };
  const hash = await sha256(JSON.stringify(snapshot));
  const link = await loadLink(admin, job);

  const fields = processoFields(connection.field_map, snapshot);
  const body = {
    name: `${processo.numero} — ${processo.cliente_nome ?? "sem cliente"}`,
    markdown_description: processo.descricao ?? "",
    status: processo.status,
  };

  let taskId = link?.clickup_task_id ?? null;
  let movementWatermark = link?.last_movement_at ?? null;

  if (!taskId) {
    const listId = connection.list_map[processo.area] ?? connection.list_map.default;
    if (!listId) {
      throw new ClickUpError(
        `Sem lista mapeada para a área ${processo.area}`,
        "missing_list_mapping",
      );
    }
    const created = await cuFetch(token, `/list/${listId}/task`, {
      method: "POST",
      body: JSON.stringify({ ...body, custom_fields: fields }),
    });
    taskId = String(created.id);
  } else if (link?.last_payload_hash !== hash) {
    await cuFetch(token, `/task/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    for (const field of fields) {
      await cuFetch(token, `/task/${taskId}/field/${field.id}`, {
        method: "POST",
        body: JSON.stringify({ value: field.value }),
      });
    }
  }

  movementWatermark = await pushNewMovements(admin, token, job, taskId!, movementWatermark);
  await saveLink(admin, job, taskId!, hash, movementWatermark);
}

async function syncPrazo(
  admin: SupabaseClient,
  connection: Connection,
  token: string,
  job: QueueJob,
): Promise<void> {
  const { data: prazo } = await admin
    .from("deadline_suggestions")
    .select("id,publication_id,proposed_date,proposed_days,reason,evidence,status")
    .eq("tenant_id", job.tenant_id)
    .eq("id", job.entity_id)
    .maybeSingle();

  if (!prazo || prazo.status === "rejected") return;

  const { data: publicacao } = await admin
    .from("publicacoes")
    .select("numero_processo,tribunal,data_publicacao,conteudo_simplificado")
    .eq("tenant_id", job.tenant_id)
    .eq("id", prazo.publication_id)
    .maybeSingle();

  // O prazo pendura no card do processo. Sem processo espelhado, o job espera:
  // o trigger de processos vai enfileirar e este volta na próxima rodada.
  const { data: processo } = await admin
    .from("processos")
    .select("id")
    .eq("tenant_id", job.tenant_id)
    .eq("numero", publicacao?.numero_processo ?? "")
    .maybeSingle();

  if (!processo) {
    throw new ClickUpError("Processo ainda não espelhado", "parent_not_synced");
  }

  const { data: parentLink } = await admin
    .from("clickup_task_links")
    .select("clickup_task_id")
    .eq("tenant_id", job.tenant_id)
    .eq("entity_type", "processo")
    .eq("entity_id", processo.id)
    .maybeSingle();

  if (!parentLink) {
    throw new ClickUpError("Processo ainda não espelhado", "parent_not_synced");
  }

  const snapshot = {
    ...prazo,
    disponibilizacao: publicacao?.data_publicacao?.slice(0, 10) ?? null,
    publicacao_cpc: prazo.proposed_date?.slice(0, 10) ?? null,
  };
  const hash = await sha256(JSON.stringify(snapshot));
  const link = await loadLink(admin, job);
  if (link?.last_payload_hash === hash) return;

  const fields = prazoFields(connection.field_map, snapshot);
  const confirmado = prazo.status === "confirmed";
  const body = {
    // O nome carrega o estado porque é o que aparece na agenda e na
    // notificação — onde o advogado olha antes de abrir o card.
    name: confirmado
      ? `Prazo — ${publicacao?.numero_processo ?? ""}`
      : `[A CONFERIR] Prazo — ${publicacao?.numero_processo ?? ""}`,
    markdown_description: [
      publicacao?.conteudo_simplificado,
      prazo.reason ? `\n\n**Base do cálculo:** ${prazo.reason}` : null,
      prazo.evidence ? `\n\n> ${prazo.evidence}` : null,
      confirmado ? null : "\n\n---\n_Prazo sugerido pelo Horus. Confira antes de agendar._",
    ].filter(Boolean).join(""),
    due_date: prazo.proposed_date ? Date.parse(prazo.proposed_date) : undefined,
    priority: confirmado ? "high" : "normal",
    parent: parentLink.clickup_task_id,
  };

  let taskId = link?.clickup_task_id ?? null;
  if (!taskId) {
    const listId = connection.list_map.prazos ?? connection.list_map.default;
    if (!listId) {
      throw new ClickUpError("Sem lista mapeada para prazos", "missing_list_mapping");
    }
    const created = await cuFetch(token, `/list/${listId}/task`, {
      method: "POST",
      body: JSON.stringify({ ...body, custom_fields: fields }),
    });
    taskId = String(created.id);
  } else {
    await cuFetch(token, `/task/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    for (const field of fields) {
      await cuFetch(token, `/task/${taskId}/field/${field.id}`, {
        method: "POST",
        body: JSON.stringify({ value: field.value }),
      });
    }
  }

  await saveLink(admin, job, taskId!, hash);
}

async function syncAudiencia(
  admin: SupabaseClient,
  connection: Connection,
  token: string,
  job: QueueJob,
): Promise<void> {
  const { data: audiencia } = await admin
    .from("audiencias")
    .select("id,processo_id,processo_numero,cliente_nome,tipo,data_hora,vara,juiz,local,observacoes,status")
    .eq("tenant_id", job.tenant_id)
    .eq("id", job.entity_id)
    .maybeSingle();

  if (!audiencia) return;

  const hash = await sha256(JSON.stringify(audiencia));
  const link = await loadLink(admin, job);
  if (link?.last_payload_hash === hash) return;

  const { data: parentLink } = audiencia.processo_id
    ? await admin
      .from("clickup_task_links")
      .select("clickup_task_id")
      .eq("tenant_id", job.tenant_id)
      .eq("entity_type", "processo")
      .eq("entity_id", audiencia.processo_id)
      .maybeSingle()
    : { data: null };

  const body = {
    name: `${audiencia.tipo} — ${audiencia.processo_numero ?? audiencia.cliente_nome ?? ""}`,
    markdown_description: [
      audiencia.vara ? `**Vara:** ${audiencia.vara}` : null,
      audiencia.juiz ? `**Juízo:** ${audiencia.juiz}` : null,
      audiencia.local ? `**Local:** ${audiencia.local}` : null,
      audiencia.observacoes,
    ].filter(Boolean).join("\n\n"),
    due_date: Date.parse(audiencia.data_hora),
    priority: "high",
    ...(parentLink ? { parent: parentLink.clickup_task_id } : {}),
  };

  let taskId = link?.clickup_task_id ?? null;
  if (!taskId) {
    const listId = connection.list_map.audiencias ?? connection.list_map.default;
    if (!listId) {
      throw new ClickUpError("Sem lista mapeada para audiências", "missing_list_mapping");
    }
    const created = await cuFetch(token, `/list/${listId}/task`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    taskId = String(created.id);
  } else {
    await cuFetch(token, `/task/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  await saveLink(admin, job, taskId!, hash);
}

async function removeMirror(
  admin: SupabaseClient,
  token: string,
  job: QueueJob,
): Promise<void> {
  const link = await loadLink(admin, job);
  if (!link) return;

  // 404 aqui é sucesso: o card já não existe, que é o estado desejado.
  try {
    await cuFetch(token, `/task/${link.clickup_task_id}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof ClickUpError) || error.status !== 404) throw error;
  }

  await admin
    .from("clickup_task_links")
    .delete()
    .eq("tenant_id", job.tenant_id)
    .eq("entity_type", job.entity_type)
    .eq("entity_id", job.entity_id);
}

// ---------------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------------

function shouldRetry(error: ClickUpError, attempts: number): boolean {
  if (error.code === "unauthorized" || error.code === "missing_token_key") return false;
  if (error.code === "missing_list_mapping") return false;
  return attempts < 6;
}

function retryDelayMs(attempts: number, retryAfterSeconds: number | null): number {
  if (retryAfterSeconds) return retryAfterSeconds * 1000;
  return Math.min(2 ** attempts * 5_000, 15 * 60_000);
}

function normalizeError(error: unknown): ClickUpError {
  if (error instanceof ClickUpError) return error;
  console.error("clickup: unexpected error", error);
  return new ClickUpError("Erro interno", "internal_error");
}

export async function processJobs(
  admin: SupabaseClient,
  limit = 25,
  tenantId?: string,
): Promise<{ claimed: number; completed: number; retried: number; failed: number }> {
  const { data, error } = await admin.rpc("claim_clickup_sync_jobs", {
    claim_limit: Math.max(1, Math.min(limit, 100)),
    claim_tenant_id: tenantId ?? null,
  });
  if (error) {
    throw new ClickUpError("Não foi possível iniciar o processamento", "queue_claim");
  }

  const jobs = (data ?? []) as QueueJob[];
  const result = { claimed: jobs.length, completed: 0, retried: 0, failed: 0 };

  const connections = new Map<string, { connection: Connection; token: string }>();
  // Tenant que levou 429 sai da rodada inteira: insistir só queima a janela.
  const throttled = new Set<string>();

  for (const job of jobs) {
    try {
      if (throttled.has(job.tenant_id)) {
        throw new ClickUpError("Tenant em espera de rate limit", "rate_limited", 429, 60);
      }

      let entry = connections.get(job.tenant_id);
      if (!entry) {
        const { data: connection } = await admin
          .from("clickup_connections")
          .select("tenant_id,workspace_id,space_id,encrypted_token,field_map,list_map,status")
          .eq("tenant_id", job.tenant_id)
          .maybeSingle();

        if (!connection || connection.status !== "active") {
          throw new ClickUpError("Conexão inativa", "connection_inactive");
        }
        entry = {
          connection: connection as Connection,
          token: await decryptToken(connection.encrypted_token),
        };
        connections.set(job.tenant_id, entry);
      }

      if (job.operation === "delete") {
        await removeMirror(admin, entry.token, job);
      } else if (job.entity_type === "processo") {
        await syncProcesso(admin, entry.connection, entry.token, job);
      } else if (job.entity_type === "prazo") {
        await syncPrazo(admin, entry.connection, entry.token, job);
      } else if (job.entity_type === "audiencia") {
        await syncAudiencia(admin, entry.connection, entry.token, job);
      }

      // Só conclui se o job ainda estiver em 'processing'. Se o dado mudou
      // durante a execução, o trigger já devolveu a linha para 'pending' — e
      // marcar 'completed' aqui apagaria essa mudança do ClickUp.
      await admin.from("clickup_sync_queue").update({
        status: "completed",
        locked_at: null,
        last_error_code: null,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "processing");
      result.completed += 1;
    } catch (error) {
      const clickUpError = normalizeError(error);

      if (clickUpError.code === "rate_limited") throttled.add(job.tenant_id);

      if (clickUpError.code === "unauthorized") {
        await admin.from("clickup_connections").update({
          status: "paused",
          last_error_code: clickUpError.code,
          updated_at: new Date().toISOString(),
        }).eq("tenant_id", job.tenant_id);
        connections.delete(job.tenant_id);
      }

      const retryable = shouldRetry(clickUpError, job.attempts);
      await admin.from("clickup_sync_queue").update({
        status: retryable ? "retry" : "failed",
        next_attempt_at: new Date(
          Date.now() + retryDelayMs(job.attempts, clickUpError.retryAfterSeconds),
        ).toISOString(),
        locked_at: null,
        last_error_code: clickUpError.code,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "processing");

      if (retryable) result.retried += 1;
      else result.failed += 1;
    }
  }

  return result;
}
