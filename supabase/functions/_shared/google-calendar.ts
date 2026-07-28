import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-worker-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";

type EntityType = "evento" | "audiencia" | "tarefa" | "financeiro";
type QueueOperation = "upsert" | "delete";

interface QueueJob {
  id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  operation: QueueOperation;
  snapshot: Record<string, unknown>;
  attempts: number;
}

interface GoogleCredentials {
  user_id: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  access_token_ciphertext: string | null;
  access_token_iv: string | null;
  access_token_expires_at: string | null;
}

interface GoogleEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  colorId?: string;
  extendedProperties: {
    private: Record<string, string>;
  };
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export class GoogleCalendarError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 500,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
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
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireUser(
  req: Request,
  admin = getAdminClient(),
): Promise<{ id: string; email?: string }> {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    throw new GoogleCalendarError("Autenticação necessária", "unauthorized", 401);
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    throw new GoogleCalendarError("Sessão inválida", "unauthorized", 401);
  }

  return { id: data.user.id, email: data.user.email };
}

export function getOAuthConfiguration() {
  return {
    clientId: requiredEnv("GOOGLE_CALENDAR_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
    redirectUri: requiredEnv("GOOGLE_CALENDAR_REDIRECT_URI"),
    appUrl: requiredEnv("APP_URL").replace(/\/+$/, ""),
  };
}

export function validateReturnUrl(candidate: unknown, appUrl: string): string {
  const defaultUrl = `${appUrl}/configuracoes`;
  if (typeof candidate !== "string" || !candidate) return defaultUrl;

  const allowedOrigins = new Set([
    new URL(appUrl).origin,
    "http://localhost:8080",
    ...((Deno.env.get("GOOGLE_CALENDAR_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)),
  ]);

  try {
    const parsed = new URL(candidate);
    return allowedOrigins.has(parsed.origin) ? parsed.toString() : defaultUrl;
  } catch {
    return defaultUrl;
  }
}

export async function createOAuthState(
  admin: SupabaseClient,
  userId: string,
  returnUrl: string,
): Promise<string> {
  const state = randomBase64Url(48);
  const stateHash = await sha256(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await admin
    .from("google_calendar_oauth_states")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const { error } = await admin.from("google_calendar_oauth_states").insert({
    state_hash: stateHash,
    user_id: userId,
    return_url: returnUrl,
    expires_at: expiresAt,
  });
  if (error) {
    throw new GoogleCalendarError("Não foi possível iniciar a conexão", "oauth_state_create");
  }
  return state;
}

export function buildGoogleAuthorizationUrl(state: string): string {
  const config = getOAuthConfiguration();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: `openid email ${CALENDAR_SCOPE}`,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function consumeOAuthState(
  admin: SupabaseClient,
  state: string,
): Promise<{ userId: string; returnUrl: string }> {
  const stateHash = await sha256(state);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("google_calendar_oauth_states")
    .update({ consumed_at: now })
    .eq("state_hash", stateHash)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("user_id, return_url")
    .maybeSingle();

  if (error || !data) {
    throw new GoogleCalendarError("Autorização expirada ou inválida", "invalid_oauth_state", 400);
  }
  return { userId: data.user_id, returnUrl: data.return_url };
}

export async function exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
  const config = getOAuthConfiguration();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = await response.json() as TokenResponse;
  if (!response.ok || !body.access_token) {
    throw new GoogleCalendarError(
      body.error_description ?? "O Google recusou a autorização",
      body.error ?? "oauth_exchange_failed",
      400,
    );
  }
  return body;
}

export async function verifyGoogleIdentity(idToken: string): Promise<{
  email: string;
  subject: string;
}> {
  const config = getOAuthConfiguration();
  const response = await fetch(
    `${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(idToken)}`,
  );
  const data = await response.json() as {
    aud?: string;
    email?: string;
    sub?: string;
    email_verified?: string | boolean;
  };
  if (
    !response.ok ||
    data.aud !== config.clientId ||
    !data.email ||
    !data.sub ||
    ![true, "true"].includes(data.email_verified ?? false)
  ) {
    throw new GoogleCalendarError("Identidade Google inválida", "invalid_google_identity", 400);
  }
  return { email: data.email, subject: data.sub };
}

export async function storeGoogleCredentials(
  admin: SupabaseClient,
  userId: string,
  token: TokenResponse,
  googleSubject: string,
): Promise<void> {
  const grantedScopes = new Set((token.scope ?? "").split(/\s+/).filter(Boolean));
  if (!grantedScopes.has(CALENDAR_SCOPE)) {
    throw new GoogleCalendarError(
      "A permissão do Google Calendar não foi concedida. Autorize novamente.",
      "missing_calendar_scope",
      400,
    );
  }

  const [{ data: previous }, { data: previousConnection }] = await Promise.all([
    admin
      .from("google_calendar_credentials")
      .select("refresh_token_ciphertext, refresh_token_iv")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("google_calendar_connections")
      .select("google_subject")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  let encryptedRefresh: { ciphertext: string; iv: string };
  if (token.refresh_token) {
    encryptedRefresh = await encryptSecret(token.refresh_token);
  } else if (
    previous?.refresh_token_ciphertext &&
    previous?.refresh_token_iv &&
    previousConnection?.google_subject === googleSubject
  ) {
    encryptedRefresh = {
      ciphertext: previous.refresh_token_ciphertext,
      iv: previous.refresh_token_iv,
    };
  } else {
    throw new GoogleCalendarError(
      "O Google não forneceu acesso permanente. Autorize novamente.",
      "missing_refresh_token",
      400,
    );
  }

  const encryptedAccess = token.access_token
    ? await encryptSecret(token.access_token)
    : null;
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;

  const { error } = await admin.from("google_calendar_credentials").upsert({
    user_id: userId,
    refresh_token_ciphertext: encryptedRefresh.ciphertext,
    refresh_token_iv: encryptedRefresh.iv,
    access_token_ciphertext: encryptedAccess?.ciphertext ?? null,
    access_token_iv: encryptedAccess?.iv ?? null,
    access_token_expires_at: expiresAt,
    encryption_version: 1,
    scope: token.scope ?? CALENDAR_SCOPE,
  });
  if (error) {
    throw new GoogleCalendarError("Não foi possível proteger as credenciais", "credential_store");
  }
}

export async function getValidAccessToken(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await admin
    .from("google_calendar_credentials")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new GoogleCalendarError("Google Calendar não conectado", "not_connected", 409);
  }

  const credentials = data as GoogleCredentials;
  const expiresAt = credentials.access_token_expires_at
    ? new Date(credentials.access_token_expires_at).getTime()
    : 0;
  if (
    credentials.access_token_ciphertext &&
    credentials.access_token_iv &&
    expiresAt > Date.now() + 60_000
  ) {
    return decryptSecret(
      credentials.access_token_ciphertext,
      credentials.access_token_iv,
    );
  }

  const refreshToken = await decryptSecret(
    credentials.refresh_token_ciphertext,
    credentials.refresh_token_iv,
  );
  const config = getOAuthConfiguration();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = await response.json() as TokenResponse;
  if (!response.ok || !token.access_token) {
    if (token.error === "invalid_grant") {
      await admin.from("google_calendar_connections").update({
        status: "reconnect_required",
        last_error_code: "invalid_grant",
        last_error_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }
    throw new GoogleCalendarError(
      token.error_description ?? "Não foi possível renovar o Google Calendar",
      token.error ?? "token_refresh_failed",
      token.error === "invalid_grant" ? 409 : 502,
    );
  }

  const encryptedAccess = await encryptSecret(token.access_token);
  const newExpiresAt = new Date(
    Date.now() + (token.expires_in ?? 3600) * 1000,
  ).toISOString();
  await admin.from("google_calendar_credentials").update({
    access_token_ciphertext: encryptedAccess.ciphertext,
    access_token_iv: encryptedAccess.iv,
    access_token_expires_at: newExpiresAt,
  }).eq("user_id", userId);

  return token.access_token;
}

export async function enqueueFutureItems(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const [events, hearings, tasks, financial] = await Promise.all([
    admin.from("eventos").select("id").eq("user_id", userId).gte("data_inicio", now),
    admin.from("audiencias").select("id").eq("user_id", userId).gte("data_hora", now),
    admin.from("tarefas").select("id").eq("user_id", userId)
      .not("data_limite", "is", null).gte("data_limite", today).neq("status", "concluída"),
    admin.from("financeiro").select("id").eq("user_id", userId)
      .not("data_vencimento", "is", null).gte("data_vencimento", today),
  ]);

  const rows = [
    ...(events.data ?? []).map((row) => queueRow(userId, "evento", row.id)),
    ...(hearings.data ?? []).map((row) => queueRow(userId, "audiencia", row.id)),
    ...(tasks.data ?? []).map((row) => queueRow(userId, "tarefa", row.id)),
    ...(financial.data ?? []).map((row) => queueRow(userId, "financeiro", row.id)),
  ];
  if (rows.length === 0) return 0;

  const { error } = await admin.from("google_calendar_sync_queue")
    .upsert(rows, { onConflict: "user_id,entity_type,entity_id" });
  if (error) {
    throw new GoogleCalendarError("Não foi possível preparar a sincronização", "enqueue_failed");
  }
  return rows.length;
}

export async function getConnectionStatus(admin: SupabaseClient, userId: string) {
  const [{ data: connection }, { data: queue }] = await Promise.all([
    admin.from("google_calendar_connections").select(
      "google_email,status,connected_at,last_sync_at,last_error_code,last_error_at",
    ).eq("user_id", userId).maybeSingle(),
    admin.from("google_calendar_sync_queue").select("status").eq("user_id", userId)
      .in("status", ["pending", "processing", "retry", "failed"]),
  ]);

  const counts = { pending: 0, processing: 0, retry: 0, failed: 0 };
  for (const row of queue ?? []) {
    const status = row.status as keyof typeof counts;
    counts[status] += 1;
  }

  return {
    connected: Boolean(connection),
    connection: connection ?? null,
    queue: counts,
  };
}

export async function processJobs(
  admin: SupabaseClient,
  limit = 25,
  userId?: string,
): Promise<{ claimed: number; completed: number; retried: number; failed: number }> {
  const { data, error } = await admin.rpc("claim_google_calendar_sync_jobs", {
    claim_limit: Math.max(1, Math.min(limit, 100)),
    claim_user_id: userId ?? null,
  });
  if (error) {
    throw new GoogleCalendarError("Não foi possível iniciar o processamento", "queue_claim");
  }

  const jobs = (data ?? []) as QueueJob[];
  const result = { claimed: jobs.length, completed: 0, retried: 0, failed: 0 };

  for (const job of jobs) {
    try {
      await processOneJob(admin, job);
      await admin.from("google_calendar_sync_queue").update({
        status: "completed",
        locked_at: null,
        last_error_code: null,
      }).eq("id", job.id);
      result.completed += 1;
    } catch (error) {
      const calendarError = normalizeError(error);
      if (
        calendarError.code === "insufficientPermissions" ||
        calendarError.code === "missing_calendar_scope"
      ) {
        await admin.from("google_calendar_connections").update({
          status: "reconnect_required",
          last_error_code: calendarError.code,
          last_error_at: new Date().toISOString(),
        }).eq("user_id", job.user_id);
      }
      const retryable = shouldRetry(calendarError, job.attempts);
      const nextAttemptAt = new Date(
        Date.now() + retryDelayMs(job.attempts, calendarError.retryAfterSeconds),
      ).toISOString();
      await admin.from("google_calendar_sync_queue").update({
        status: retryable ? "retry" : "failed",
        next_attempt_at: nextAttemptAt,
        locked_at: null,
        last_error_code: calendarError.code,
      }).eq("id", job.id);
      if (retryable) result.retried += 1;
      else result.failed += 1;
    }
  }

  if (
    userId &&
    result.completed > 0 &&
    result.failed === 0 &&
    result.retried === 0
  ) {
    await admin.from("google_calendar_connections").update({
      last_sync_at: new Date().toISOString(),
      status: "connected",
      last_error_code: null,
      last_error_at: null,
    }).eq("user_id", userId);
  }
  return result;
}

export async function revokeAndDeleteConnection(
  admin: SupabaseClient,
  userId: string,
  removeEvents: boolean,
): Promise<{ removedFromGoogle: number; failedRemovals: number }> {
  let removedFromGoogle = 0;
  let failedRemovals = 0;

  if (removeEvents) {
    const { data: links } = await admin.from("google_calendar_event_links")
      .select("entity_type,entity_id,google_event_id")
      .eq("user_id", userId);
    if (links?.length) {
      const rows = links.map((link) => ({
        ...queueRow(userId, link.entity_type as EntityType, link.entity_id, "delete"),
        snapshot: { google_event_id: link.google_event_id },
      }));
      await admin.from("google_calendar_sync_queue")
        .upsert(rows, { onConflict: "user_id,entity_type,entity_id" });
      const processed = await processJobs(admin, Math.min(rows.length, 100), userId);
      removedFromGoogle = processed.completed;
      failedRemovals = processed.failed + processed.retried;
    }
  }

  const { data: credentials } = await admin.from("google_calendar_credentials")
    .select("refresh_token_ciphertext,refresh_token_iv")
    .eq("user_id", userId)
    .maybeSingle();
  if (credentials) {
    try {
      const refreshToken = await decryptSecret(
        credentials.refresh_token_ciphertext,
        credentials.refresh_token_iv,
      );
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch {
      // A limpeza local continua mesmo se a autorização já tiver sido revogada.
    }
  }

  await Promise.all([
    admin.from("google_calendar_credentials").delete().eq("user_id", userId),
    admin.from("google_calendar_connections").delete().eq("user_id", userId),
    admin.from("google_calendar_event_links").delete().eq("user_id", userId),
    admin.from("google_calendar_sync_queue").delete().eq("user_id", userId),
  ]);

  return { removedFromGoogle, failedRemovals };
}

async function processOneJob(admin: SupabaseClient, job: QueueJob): Promise<void> {
  const { data: connection } = await admin.from("google_calendar_connections")
    .select("status")
    .eq("user_id", job.user_id)
    .maybeSingle();
  if (!connection) {
    throw new GoogleCalendarError("Google Calendar não conectado", "not_connected", 409);
  }
  if (connection.status === "reconnect_required") {
    throw new GoogleCalendarError("Reconexão necessária", "reconnect_required", 409);
  }

  const token = await getValidAccessToken(admin, job.user_id);
  const { data: link } = await admin.from("google_calendar_event_links")
    .select("google_event_id")
    .eq("user_id", job.user_id)
    .eq("entity_type", job.entity_type)
    .eq("entity_id", job.entity_id)
    .maybeSingle();

  if (job.operation === "delete") {
    const snapshotEventId = typeof job.snapshot?.google_event_id === "string"
      ? job.snapshot.google_event_id
      : null;
    const eventId = link?.google_event_id ?? snapshotEventId;
    if (eventId) await deleteGoogleEvent(token, eventId);
    await admin.from("google_calendar_event_links").delete()
      .eq("user_id", job.user_id)
      .eq("entity_type", job.entity_type)
      .eq("entity_id", job.entity_id);
    await clearSourceEventId(admin, job);
    return;
  }

  const source = await fetchSourceEntity(admin, job);
  if (!source) {
    if (link?.google_event_id) await deleteGoogleEvent(token, link.google_event_id);
    await admin.from("google_calendar_event_links").delete()
      .eq("user_id", job.user_id)
      .eq("entity_type", job.entity_type)
      .eq("entity_id", job.entity_id);
    return;
  }

  const event = buildGoogleEvent(job.entity_type, source, job.entity_id);
  const payloadHash = await sha256(JSON.stringify(event));
  const eventId = link?.google_event_id ?? deterministicEventId(job.entity_type, job.entity_id);
  await upsertGoogleEvent(token, eventId, event);

  await admin.from("google_calendar_event_links").upsert({
    user_id: job.user_id,
    entity_type: job.entity_type,
    entity_id: job.entity_id,
    google_event_id: eventId,
    last_payload_hash: payloadHash,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "user_id,entity_type,entity_id" });
  await setSourceEventId(admin, job, eventId);
}

async function fetchSourceEntity(admin: SupabaseClient, job: QueueJob) {
  const table = sourceTable(job.entity_type);
  const { data, error } = await admin.from(table).select("*")
    .eq("id", job.entity_id)
    .eq("user_id", job.user_id)
    .maybeSingle();
  if (error) throw new GoogleCalendarError(error.message, "source_read_failed");
  return data as Record<string, unknown> | null;
}

function buildGoogleEvent(
  entityType: EntityType,
  source: Record<string, unknown>,
  entityId: string,
): GoogleEventInput {
  const metadata = {
    adveyes_origin: "adveyes",
    adveyes_entity_type: entityType,
    adveyes_entity_id: entityId,
  };

  if (entityType === "evento") {
    const start = String(source.data_inicio);
    const end = source.data_fim
      ? String(source.data_fim)
      : new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
    return {
      summary: `${capitalize(String(source.tipo ?? "Evento"))} — ${source.titulo}`,
      description: optionalString(source.descricao),
      location: optionalString(source.local),
      start: dateTimeField(start),
      end: dateTimeField(end),
      colorId: "7",
      extendedProperties: { private: metadata },
    };
  }

  if (entityType === "audiencia") {
    const start = String(source.data_hora);
    const end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
    const client = optionalString(source.cliente_nome);
    const process = optionalString(source.processo_numero);
    const details = [
      optionalString(source.vara) ? `Vara: ${source.vara}` : "",
      optionalString(source.observacoes),
    ].filter(Boolean).join("\n");
    return {
      summary: `Audiência — ${client || process || String(source.tipo ?? "Compromisso")}`,
      description: details || undefined,
      location: optionalString(source.local),
      start: dateTimeField(start),
      end: dateTimeField(end),
      colorId: "9",
      extendedProperties: { private: metadata },
    };
  }

  const dateKey = entityType === "tarefa" ? "data_limite" : "data_vencimento";
  const date = String(source[dateKey]).slice(0, 10);
  const nextDate = addDays(date, 1);
  return {
    summary: entityType === "tarefa"
      ? `Prazo — ${source.titulo}`
      : `Vencimento — ${source.descricao}`,
    description: entityType === "tarefa"
      ? optionalString(source.descricao)
      : `Status: ${source.status ?? "pendente"}`,
    start: { date },
    end: { date: nextDate },
    colorId: entityType === "tarefa" ? "11" : "2",
    extendedProperties: { private: metadata },
  };
}

async function upsertGoogleEvent(
  token: string,
  eventId: string,
  event: GoogleEventInput,
): Promise<void> {
  const patch = await googleFetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    token,
    { method: "PATCH", body: JSON.stringify(event) },
    true,
  );
  if (patch.status !== 404) {
    if (!patch.ok) await throwGoogleError(patch);
    return;
  }

  const insert = await googleFetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
    token,
    { method: "POST", body: JSON.stringify({ ...event, id: eventId }) },
  );
  if (insert.status === 409) {
    const retryPatch = await googleFetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,
      token,
      { method: "PATCH", body: JSON.stringify(event) },
    );
    if (!retryPatch.ok) await throwGoogleError(retryPatch);
    return;
  }
  if (!insert.ok) await throwGoogleError(insert);
}

async function deleteGoogleEvent(token: string, eventId: string): Promise<void> {
  const response = await googleFetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    token,
    { method: "DELETE" },
    true,
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    await throwGoogleError(response);
  }
}

async function googleFetch(
  url: string,
  token: string,
  init: RequestInit,
  allowError = false,
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!allowError && !response.ok) await throwGoogleError(response);
  return response;
}

async function throwGoogleError(response: Response): Promise<never> {
  let code = `google_${response.status}`;
  let message = "Falha ao sincronizar com o Google Calendar";
  try {
    const data = await response.json() as {
      error?: { message?: string; errors?: Array<{ reason?: string }> };
    };
    message = data.error?.message ?? message;
    code = data.error?.errors?.[0]?.reason ?? code;
  } catch {
    // Respostas sem JSON usam o código HTTP normalizado.
  }
  const retryAfter = Number(response.headers.get("retry-after") ?? "") || undefined;
  throw new GoogleCalendarError(message, code, response.status, retryAfter);
}

async function setSourceEventId(
  admin: SupabaseClient,
  job: QueueJob,
  eventId: string,
): Promise<void> {
  await admin.from(sourceTable(job.entity_type)).update({ google_event_id: eventId })
    .eq("id", job.entity_id)
    .eq("user_id", job.user_id);
}

async function clearSourceEventId(admin: SupabaseClient, job: QueueJob): Promise<void> {
  await admin.from(sourceTable(job.entity_type)).update({ google_event_id: null })
    .eq("id", job.entity_id)
    .eq("user_id", job.user_id);
}

function sourceTable(entityType: EntityType): string {
  return {
    evento: "eventos",
    audiencia: "audiencias",
    tarefa: "tarefas",
    financeiro: "financeiro",
  }[entityType];
}

function queueRow(
  userId: string,
  entityType: EntityType,
  entityId: string,
  operation: QueueOperation = "upsert",
) {
  return {
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    operation,
    snapshot: {},
    status: "pending",
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
    locked_at: null,
    last_error_code: null,
  };
}

function deterministicEventId(entityType: EntityType, entityId: string): string {
  const prefix = { evento: "e", audiencia: "a", tarefa: "t", financeiro: "f" }[
    entityType
  ];
  return `${prefix}${entityId.replaceAll("-", "").toLowerCase()}`;
}

function dateTimeField(value: string) {
  return { dateTime: new Date(value).toISOString(), timeZone: "America/Manaus" };
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function normalizeError(error: unknown): GoogleCalendarError {
  return error instanceof GoogleCalendarError
    ? error
    : new GoogleCalendarError(
      error instanceof Error ? error.message : "Erro desconhecido",
      "unknown_error",
    );
}

function shouldRetry(error: GoogleCalendarError, attempts: number): boolean {
  if (["invalid_grant", "reconnect_required"].includes(error.code)) return false;
  if (error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status)) {
    return false;
  }
  return attempts < 5;
}

function retryDelayMs(attempts: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds) return retryAfterSeconds * 1000;
  const schedule = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
  return schedule[Math.min(Math.max(attempts - 1, 0), schedule.length - 1)];
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new GoogleCalendarError(`Secret ausente: ${name}`, "configuration_missing", 503);
  return value;
}

async function encryptSecret(value: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await importEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return {
    ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
    iv: bytesToBase64Url(iv),
  };
}

async function decryptSecret(ciphertext: string, iv: string): Promise<string> {
  const key = await importEncryptionKey();
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(iv) },
      key,
      base64UrlToBytes(ciphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new GoogleCalendarError("Credencial protegida inválida", "credential_decrypt_failed");
  }
}

async function importEncryptionKey(): Promise<CryptoKey> {
  const raw = base64UrlToBytes(requiredEnv("GOOGLE_TOKEN_ENCRYPTION_KEY"));
  if (raw.byteLength !== 32) {
    throw new GoogleCalendarError(
      "GOOGLE_TOKEN_ENCRYPTION_KEY deve possuir 32 bytes",
      "invalid_encryption_key",
      503,
    );
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function randomBase64Url(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToBase64Url(bytes);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
