import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  decodeCursor,
  encodeCursor,
  mapApiInput,
  mapApiOutput,
  normalizePageSize,
  parsePublicApiPath,
  PublicApiContractError,
  RESOURCE_CONTRACTS,
  requireScope,
  resolveRequestTenant,
  type ApiResource,
} from "../_shared/public-api-contract.ts";
import {
  createWebhookSecret,
  encryptWebhookSecret,
  sha256Hex,
} from "../_shared/public-api-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};
const RATE_LIMIT_PER_MINUTE = 120;
const WEBHOOK_EVENTS = new Set([
  "*",
  "contact.created", "contact.updated", "contact.deleted",
  "process.created", "process.updated", "process.deleted",
  "task.created", "task.updated", "task.completed", "task.deleted",
]);

interface TokenContext {
  id: string;
  tenantId: string;
  scopes: string[];
  actorUserId: string;
}

/** Token como está gravado: o de plataforma não carrega escritório. */
interface RawTokenContext {
  id: string;
  tenantId: string | null;
  isPlatform: boolean;
  scopes: string[];
  actorUserId: string;
}

interface ApiResult {
  body: Record<string, unknown>;
  status: number;
  headers?: Record<string, string>;
}

function response(result: ApiResult, requestId: string): Response {
  return new Response(result.status === 204 ? null : JSON.stringify(result.body), {
    status: result.status,
    headers: {
      ...corsHeaders,
      "Content-Type": result.status >= 400
        ? "application/problem+json"
        : "application/json",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...result.headers,
    },
  });
}

function success(data: unknown, status = 200, meta?: Record<string, unknown>): ApiResult {
  return { body: { data, ...(meta ? { meta } : {}) }, status };
}

function problem(
  code: string,
  status: number,
  requestId: string,
  field?: string,
): ApiResult {
  return {
    status,
    body: {
      type: `https://adveyes.automatikus.com.br/api/problems/${code}`,
      title: code.replaceAll("_", " "),
      status,
      code,
      request_id: requestId,
      ...(field ? { field } : {}),
    },
  };
}

function serverClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticate(
  request: Request,
  admin: SupabaseClient,
): Promise<RawTokenContext | null> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer adv_")) return null;
  const rawToken = authorization.slice("Bearer ".length).trim();
  if (rawToken.length < 60 || rawToken.length > 160) return null;
  const tokenHash = await sha256Hex(rawToken);
  const { data, error } = await admin.from("api_tokens")
    .select("id, tenant_id, is_platform, scopes, expires_at, revoked_at, created_by")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) {
    return null;
  }
  return {
    id: data.id,
    tenantId: data.tenant_id ?? null,
    isPlatform: Boolean(data.is_platform),
    scopes: data.scopes ?? [],
    actorUserId: data.created_by,
  };
}

/**
 * A credencial de plataforma aponta para um escritório por cabeçalho, então o
 * alvo precisa ser conferido a cada chamada: um tenant removido ou cancelado
 * não pode continuar respondendo por um identificador antigo.
 */
async function assertTenantServable(
  admin: SupabaseClient,
  tenantId: string,
): Promise<void> {
  const { data, error } = await admin.from("tenants")
    .select("id, status").eq("id", tenantId).maybeSingle();
  if (error) throw error;
  if (!data || data.status === "canceled") {
    throw new PublicApiContractError("tenant_not_found", 404);
  }
}

async function listTenants(
  admin: SupabaseClient,
  method: string,
): Promise<ApiResult> {
  if (method !== "GET") throw new PublicApiContractError("method_not_allowed", 405);
  const { data, error } = await admin.from("tenants")
    .select("id, display_name, slug, status, created_at")
    .neq("status", "canceled")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return success((data ?? []).map((tenant) => ({
    id: tenant.id,
    name: tenant.display_name,
    slug: tenant.slug,
    status: tenant.status,
    created_at: tenant.created_at,
  })));
}

async function rateLimited(admin: SupabaseClient, tokenId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await admin.from("api_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_token_id", tokenId)
    .gte("created_at", since);
  if (error) throw error;
  return (count ?? 0) >= RATE_LIMIT_PER_MINUTE;
}

async function validateRelationships(
  admin: SupabaseClient,
  token: TokenContext,
  resource: ApiResource,
  patch: Record<string, unknown>,
): Promise<void> {
  const checks: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
  if (resource === "processes" && typeof patch.cliente_id === "string") {
    checks.push(admin.from("clientes").select("id").eq("tenant_id", token.tenantId)
      .eq("id", patch.cliente_id).is("deleted_at", null).maybeSingle());
  }
  if (resource === "tasks" && typeof patch.processo_id === "string") {
    checks.push(admin.from("processos").select("id").eq("tenant_id", token.tenantId)
      .eq("id", patch.processo_id).is("deleted_at", null).maybeSingle());
  }
  if (resource === "tasks" && typeof patch.responsavel_id === "string") {
    checks.push(admin.from("tenant_memberships").select("id")
      .eq("tenant_id", token.tenantId).eq("user_id", patch.responsavel_id)
      .eq("status", "active").maybeSingle());
  }
  for (const check of checks) {
    const { data, error } = await check;
    if (error) throw error;
    if (!data) throw new PublicApiContractError("invalid_relationship", 422);
  }
}

function selectedColumns(resource: ApiResource): string {
  return [...new Set(Object.values(RESOURCE_CONTRACTS[resource].output))].join(",");
}

async function listResource(
  admin: SupabaseClient,
  token: TokenContext,
  resource: ApiResource,
  url: URL,
): Promise<ApiResult> {
  const contract = RESOURCE_CONTRACTS[resource];
  requireScope(token.scopes, contract.readScope);
  const limit = normalizePageSize(url.searchParams.get("limit"));
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  let query = admin.from(contract.table).select(selectedColumns(resource))
    .eq("tenant_id", token.tenantId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (url.searchParams.get("include_deleted") !== "true") {
    query = query.is("deleted_at", null);
  }
  const updatedAfter = url.searchParams.get("updated_after");
  if (updatedAfter) {
    if (Number.isNaN(Date.parse(updatedAfter))) {
      throw new PublicApiContractError("invalid_updated_after", 400, "updated_after");
    }
    query = query.gte("updated_at", updatedAfter);
  }
  const status = url.searchParams.get("status");
  if (status && resource !== "contacts") query = query.eq("status", status);
  const processId = url.searchParams.get("process_id");
  if (processId && resource === "tasks") query = query.eq("processo_id", processId);
  const search = url.searchParams.get("q")?.trim();
  if (search) {
    const column = resource === "contacts" ? "nome" : resource === "processes" ? "numero" : "titulo";
    query = query.ilike(column, `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  }
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = hasMore && last
    ? encodeCursor({ created_at: String(last.created_at), id: String(last.id) })
    : null;
  return success(page.map((row) => mapApiOutput(resource, row)), 200, {
    next_cursor: nextCursor,
  });
}

async function getResource(
  admin: SupabaseClient,
  token: TokenContext,
  resource: ApiResource,
  id: string,
): Promise<ApiResult> {
  const contract = RESOURCE_CONTRACTS[resource];
  requireScope(token.scopes, contract.readScope);
  const { data, error } = await admin.from(contract.table)
    .select(selectedColumns(resource)).eq("tenant_id", token.tenantId)
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data
    ? success(mapApiOutput(resource, data as Record<string, unknown>))
    : { body: {}, status: 404 };
}

async function mutateResource(
  admin: SupabaseClient,
  token: TokenContext,
  resource: ApiResource,
  method: string,
  id: string | null,
  body: unknown,
): Promise<ApiResult> {
  const contract = RESOURCE_CONTRACTS[resource];
  requireScope(token.scopes, contract.writeScope);
  if (method === "POST") {
    if (id) throw new PublicApiContractError("method_not_allowed", 405);
    const patch = mapApiInput(resource, body, "create");
    await validateRelationships(admin, token, resource, patch);
    const { data, error } = await admin.from(contract.table).insert({
      ...patch,
      tenant_id: token.tenantId,
      user_id: token.actorUserId,
    }).select(selectedColumns(resource)).single();
    if (error) throw error;
    return success(mapApiOutput(resource, data as Record<string, unknown>), 201);
  }
  if (!id) throw new PublicApiContractError("resource_id_required", 400);
  if (method === "PATCH") {
    const patch = mapApiInput(resource, body, "update");
    await validateRelationships(admin, token, resource, patch);
    const { data, error } = await admin.from(contract.table).update({
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq("tenant_id", token.tenantId).eq("id", id).is("deleted_at", null)
      .select(selectedColumns(resource)).maybeSingle();
    if (error) throw error;
    return data
      ? success(mapApiOutput(resource, data as Record<string, unknown>))
      : { body: {}, status: 404 };
  }
  if (method === "DELETE") {
    const deletedAt = new Date().toISOString();
    const { data, error } = await admin.from(contract.table)
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq("tenant_id", token.tenantId).eq("id", id).is("deleted_at", null)
      .select("id").maybeSingle();
    if (error) throw error;
    return data ? { body: {}, status: 204 } : { body: {}, status: 404 };
  }
  throw new PublicApiContractError("method_not_allowed", 405);
}

function validateWebhookBody(body: unknown): {
  name: string;
  url: string;
  eventTypes: string[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PublicApiContractError("invalid_body", 400);
  }
  const source = body as Record<string, unknown>;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    throw new PublicApiContractError("invalid_name", 400, "name");
  }
  let target: URL;
  try {
    target = new URL(typeof source.url === "string" ? source.url : "");
  } catch {
    throw new PublicApiContractError("invalid_webhook_url", 400, "url");
  }
  if (target.protocol !== "https:") {
    throw new PublicApiContractError("https_required", 400, "url");
  }
  if (!Array.isArray(source.event_types) || source.event_types.length < 1 ||
    source.event_types.length > 10 ||
    !source.event_types.every((event) => typeof event === "string" && WEBHOOK_EVENTS.has(event))) {
    throw new PublicApiContractError("invalid_events", 400, "event_types");
  }
  return { name, url: target.toString(), eventTypes: [...new Set(source.event_types as string[])] };
}

async function webhookResource(
  admin: SupabaseClient,
  token: TokenContext,
  method: string,
  id: string | null,
  body: unknown,
): Promise<ApiResult> {
  requireScope(token.scopes, "webhooks:manage");
  if (method === "GET") {
    const { data, error } = await admin.from("webhook_endpoints")
      .select("id, name, url, event_types, active, created_at, updated_at")
      .eq("tenant_id", token.tenantId).order("created_at", { ascending: false });
    if (error) throw error;
    return success(data ?? []);
  }
  if (method === "POST") {
    if (id) throw new PublicApiContractError("method_not_allowed", 405);
    const input = validateWebhookBody(body);
    const encryptionKey = Deno.env.get("WEBHOOK_SECRET_ENCRYPTION_KEY");
    if (!encryptionKey) throw new PublicApiContractError("webhook_encryption_unavailable", 503);
    const secret = createWebhookSecret();
    const ciphertext = await encryptWebhookSecret(secret, encryptionKey);
    const { data, error } = await admin.from("webhook_endpoints").insert({
      tenant_id: token.tenantId,
      name: input.name,
      url: input.url,
      event_types: input.eventTypes,
      secret_ciphertext: ciphertext,
      created_by: token.actorUserId,
    }).select("id, name, url, event_types, active, created_at, updated_at").single();
    if (error) throw error;
    return success({ ...data, secret }, 201);
  }
  if (!id) throw new PublicApiContractError("resource_id_required", 400);
  if (method === "PATCH") {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new PublicApiContractError("invalid_body", 400);
    }
    const source = body as Record<string, unknown>;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof source.name === "string") {
      const name = source.name.trim();
      if (name.length < 2 || name.length > 80) {
        throw new PublicApiContractError("invalid_name", 400, "name");
      }
      patch.name = name;
    }
    if (typeof source.active === "boolean") patch.active = source.active;
    if (source.event_types !== undefined) {
      if (!Array.isArray(source.event_types) || source.event_types.length < 1 ||
        !source.event_types.every((event) => typeof event === "string" && WEBHOOK_EVENTS.has(event))) {
        throw new PublicApiContractError("invalid_events", 400, "event_types");
      }
      patch.event_types = [...new Set(source.event_types as string[])];
    }
    if (Object.keys(patch).length === 1) {
      throw new PublicApiContractError("empty_update", 400);
    }
    const { data, error } = await admin.from("webhook_endpoints").update(patch)
      .eq("tenant_id", token.tenantId).eq("id", id)
      .select("id, name, url, event_types, active, created_at, updated_at").maybeSingle();
    if (error) throw error;
    return data ? success(data) : { body: {}, status: 404 };
  }
  if (method === "DELETE") {
    const { data, error } = await admin.from("webhook_endpoints")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", token.tenantId).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    return data ? { body: {}, status: 204 } : { body: {}, status: 404 };
  }
  throw new PublicApiContractError("method_not_allowed", 405);
}

async function reserveIdempotency(input: {
  admin: SupabaseClient;
  token: TokenContext;
  method: string;
  route: string;
  key: string;
  requestHash: string;
}): Promise<ApiResult | null> {
  const { data: existing, error: existingError } = await input.admin
    .from("api_idempotency_keys")
    .select("request_hash, response_status, response_body")
    .eq("api_token_id", input.token.id).eq("method", input.method)
    .eq("route", input.route).eq("idempotency_key", input.key)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (existing.request_hash !== input.requestHash) {
      throw new PublicApiContractError("idempotency_conflict", 409);
    }
    if (existing.response_status === 102) {
      throw new PublicApiContractError("request_in_progress", 409);
    }
    return { body: existing.response_body, status: existing.response_status };
  }
  const { error } = await input.admin.from("api_idempotency_keys").insert({
    tenant_id: input.token.tenantId,
    api_token_id: input.token.id,
    method: input.method,
    route: input.route,
    idempotency_key: input.key,
    request_hash: input.requestHash,
    response_status: 102,
    response_body: { pending: true },
  });
  if (error?.code === "23505") {
    return reserveIdempotency(input);
  }
  if (error) throw error;
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const admin = serverClient();
  if (!admin) return response(problem("server_configuration_error", 500, requestId), requestId);
  const url = new URL(request.url);
  const route = parsePublicApiPath(url.pathname);
  if (!route) return response(problem("not_found", 404, requestId), requestId);
  if (route.resource === "health") {
    return response(success({ status: "ok", version: "v1" }), requestId);
  }

  const rawToken = await authenticate(request, admin);
  if (!rawToken) return response(problem("unauthorized", 401, requestId), requestId);
  let result: ApiResult;
  const normalizedRoute = `/api/v1/${route.resource}${route.id ? `/${route.id}` : ""}`;
  let reservation: { key: string; hash: string } | null = null;
  let effectiveTenantId: string | null = rawToken.tenantId;
  try {
    if (await rateLimited(admin, rawToken.id)) {
      result = problem("rate_limited", 429, requestId);
      result.headers = { "Retry-After": "60" };
    } else {
      effectiveTenantId = resolveRequestTenant({
        isPlatform: rawToken.isPlatform,
        tokenTenantId: rawToken.tenantId,
        headerTenantId: request.headers.get("X-Tenant-Id")?.trim() || null,
        resource: route.resource,
      });
      if (route.resource === "tenants") {
        result = await listTenants(admin, request.method.toUpperCase());
      } else {
        if (rawToken.isPlatform) await assertTenantServable(admin, effectiveTenantId as string);
        const token: TokenContext = {
          id: rawToken.id,
          tenantId: effectiveTenantId as string,
          scopes: rawToken.scopes,
          actorUserId: rawToken.actorUserId,
        };
        const method = request.method.toUpperCase();
        const mutating = ["POST", "PATCH", "DELETE"].includes(method);
        const rawBody = method === "POST" || method === "PATCH" ? await request.text() : "";
        let parsedBody: unknown = {};
        if (rawBody) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            throw new PublicApiContractError("invalid_json", 400);
          }
        }
        if (mutating) {
          const key = request.headers.get("Idempotency-Key")?.trim() ?? "";
          if (key.length < 8 || key.length > 200) {
            throw new PublicApiContractError("idempotency_key_required", 400);
          }
          const hash = await sha256Hex(`${method}\n${normalizedRoute}\n${rawBody}`);
          reservation = { key, hash };
          const replay = await reserveIdempotency({
            admin, token, method, route: normalizedRoute, key, requestHash: hash,
          });
          if (replay) {
            result = replay;
          } else if (route.resource === "webhook-endpoints") {
            result = await webhookResource(admin, token, method, route.id, parsedBody);
          } else {
            result = await mutateResource(admin, token, route.resource, method, route.id, parsedBody);
          }
        } else if (route.resource === "webhook-endpoints") {
          result = await webhookResource(admin, token, method, route.id, parsedBody);
        } else if (method === "GET") {
          result = route.id
            ? await getResource(admin, token, route.resource, route.id)
            : await listResource(admin, token, route.resource, url);
        } else {
          throw new PublicApiContractError("method_not_allowed", 405);
        }
      }
    }
  } catch (error) {
    if (error instanceof PublicApiContractError) {
      result = problem(error.code, error.status, requestId, error.field);
    } else {
      const details = error as { code?: string; message?: string };
      console.error("public-api", requestId, details.code ?? "", details.message ?? "");
      result = problem(details.code === "23505" ? "conflict" : "operation_failed",
        details.code === "23505" ? 409 : 500, requestId);
    }
  }

  if (result.status === 404 && Object.keys(result.body).length === 0) {
    result = problem("not_found", 404, requestId);
  }
  if (reservation) {
    await admin.from("api_idempotency_keys").update({
      response_status: result.status,
      response_body: result.body,
    }).eq("api_token_id", rawToken.id).eq("method", request.method.toUpperCase())
      .eq("route", normalizedRoute).eq("idempotency_key", reservation.key)
      .eq("request_hash", reservation.hash);
  }
  await Promise.all([
    admin.from("api_request_logs").insert({
      tenant_id: effectiveTenantId,
      api_token_id: rawToken.id,
      request_id: requestId,
      method: request.method.toUpperCase(),
      route: normalizedRoute,
      status: result.status,
      duration_ms: Date.now() - startedAt,
    }),
    admin.from("api_tokens").update({ last_used_at: new Date().toISOString() })
      .eq("id", rawToken.id),
  ]);
  return response(result, requestId);
});
