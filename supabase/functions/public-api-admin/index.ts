import {
  authenticateTenantRequest,
  corsHeaders,
  failureResponse,
  json,
  resolveTenantLegalAccess,
  type TenantLegalAccess,
} from "../_shared/tenant-auth.ts";
import { API_SCOPES, isApiScope } from "../_shared/public-api-contract.ts";
import {
  createApiToken,
  createWebhookSecret,
  encryptWebhookSecret,
  sha256Hex,
} from "../_shared/public-api-crypto.ts";
import { legalProviderAvailabilityFromEnvironment } from "../_shared/legal-provider-router.ts";
import { getEscavadorToken } from "../_shared/provider-secrets.ts";

const WEBHOOK_EVENTS = [
  "*",
  "contact.created", "contact.updated", "contact.deleted",
  "process.created", "process.updated", "process.deleted",
  "task.created", "task.updated", "task.completed", "task.deleted",
] as const;

interface AdminBody {
  action?: "list" | "create_token" | "revoke_token" | "create_webhook" |
    "update_webhook" | "delete_webhook";
  tenantId?: string;
  tokenId?: string;
  webhookId?: string;
  name?: string;
  scopes?: string[];
  expiresInDays?: number;
  url?: string;
  eventTypes?: string[];
  active?: boolean;
}

function validWebhookEvents(values: unknown): values is string[] {
  return Array.isArray(values) && values.length > 0 && values.length <= 10 &&
    values.every((value) => typeof value === "string" &&
      (WEBHOOK_EVENTS as readonly string[]).includes(value));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: AdminBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const tenantId = body.tenantId?.trim();
  if (!tenantId) return json({ error: "tenant_required" }, 400);

  // A Conta Geral precisa enxergar a configuração para diagnosticar o
  // escritório, mas emitir credencial é um ato auditável: exige uma sessão de
  // suporte ativa, exatamente como nas demais funções administrativas.
  let access: TenantLegalAccess | null;
  try {
    access = await resolveTenantLegalAccess(auth.admin, auth.user.id, tenantId);
  } catch (accessError) {
    return failureResponse("public-api-admin: access", accessError);
  }
  if (!access || !access.canManageAll) return json({ error: "permission_denied" }, 403);

  const action = body.action ?? "list";
  if (action !== "list" && !access.canMutate) {
    return json({ error: "support_session_required" }, 403);
  }
  if (action === "list") {
    const [tokensResult, endpointsResult, escavadorToken] = await Promise.all([
      auth.admin.from("api_tokens")
        .select("id, name, token_prefix, scopes, expires_at, last_used_at, revoked_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      auth.admin.from("webhook_endpoints")
        .select("id, name, url, event_types, active, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      getEscavadorToken(auth.admin),
    ]);
    if (tokensResult.error || endpointsResult.error) {
      return failureResponse(
        "public-api-admin: list",
        tokensResult.error ?? endpointsResult.error,
      );
    }
    const providers = legalProviderAvailabilityFromEnvironment((name) => Deno.env.get(name));
    providers.escavador = Boolean(escavadorToken);
    return json({
      availableScopes: API_SCOPES,
      availableEvents: WEBHOOK_EVENTS,
      providers,
      tokens: tokensResult.data ?? [],
      webhooks: endpointsResult.data ?? [],
    });
  }

  if (action === "create_token") {
    const name = body.name?.trim() ?? "";
    const scopes = body.scopes;
    const expiresInDays = body.expiresInDays ?? 90;
    if (name.length < 2 || name.length > 80) return json({ error: "invalid_name" }, 400);
    if (!Array.isArray(scopes) || scopes.length < 1 || scopes.length > API_SCOPES.length ||
      !scopes.every((scope) => typeof scope === "string" && isApiScope(scope))) {
      return json({ error: "invalid_scopes" }, 400);
    }
    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
      return json({ error: "invalid_expiration" }, 400);
    }
    const generated = createApiToken("live");
    const tokenHash = await sha256Hex(generated.token);
    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();
    const { data, error } = await auth.admin.from("api_tokens").insert({
      tenant_id: tenantId,
      name,
      token_prefix: generated.prefix,
      token_hash: tokenHash,
      scopes: [...new Set(scopes)],
      expires_at: expiresAt,
      created_by: auth.user.id,
    }).select("id, name, token_prefix, scopes, expires_at, created_at").single();
    if (error) return failureResponse("public-api-admin: create token", error);
    return json({ token: generated.token, record: data }, 201);
  }

  if (action === "revoke_token") {
    if (!body.tokenId) return json({ error: "token_required" }, 400);
    const { data, error } = await auth.admin.from("api_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", body.tokenId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) return failureResponse("public-api-admin: revoke token", error);
    if (!data) return json({ error: "token_not_found" }, 404);
    return json({ revoked: true });
  }

  if (action === "create_webhook") {
    const name = body.name?.trim() ?? "";
    if (name.length < 2 || name.length > 80) return json({ error: "invalid_name" }, 400);
    let target: URL;
    try {
      target = new URL(body.url ?? "");
    } catch {
      return json({ error: "invalid_webhook_url" }, 400);
    }
    if (target.protocol !== "https:") return json({ error: "https_required" }, 400);
    if (!validWebhookEvents(body.eventTypes)) return json({ error: "invalid_events" }, 400);
    const encryptionKey = Deno.env.get("WEBHOOK_SECRET_ENCRYPTION_KEY");
    if (!encryptionKey) return json({ error: "webhook_encryption_unavailable" }, 503);
    const secret = createWebhookSecret();
    let ciphertext: string;
    try {
      ciphertext = await encryptWebhookSecret(secret, encryptionKey);
    } catch {
      return json({ error: "webhook_encryption_unavailable" }, 503);
    }
    const { data, error } = await auth.admin.from("webhook_endpoints").insert({
      tenant_id: tenantId,
      name,
      url: target.toString(),
      event_types: [...new Set(body.eventTypes)],
      secret_ciphertext: ciphertext,
      created_by: auth.user.id,
    }).select("id, name, url, event_types, active, created_at, updated_at").single();
    if (error) return failureResponse("public-api-admin: create webhook", error);
    return json({ secret, webhook: data }, 201);
  }

  if (action === "update_webhook") {
    if (!body.webhookId) return json({ error: "webhook_required" }, 400);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 80) return json({ error: "invalid_name" }, 400);
      patch.name = name;
    }
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.eventTypes !== undefined) {
      if (!validWebhookEvents(body.eventTypes)) return json({ error: "invalid_events" }, 400);
      patch.event_types = [...new Set(body.eventTypes)];
    }
    const { data, error } = await auth.admin.from("webhook_endpoints")
      .update(patch).eq("tenant_id", tenantId).eq("id", body.webhookId)
      .select("id, name, url, event_types, active, created_at, updated_at")
      .maybeSingle();
    if (error) return failureResponse("public-api-admin: update webhook", error);
    if (!data) return json({ error: "webhook_not_found" }, 404);
    return json({ webhook: data });
  }

  if (action === "delete_webhook") {
    if (!body.webhookId) return json({ error: "webhook_required" }, 400);
    const { data, error } = await auth.admin.from("webhook_endpoints")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId).eq("id", body.webhookId)
      .select("id").maybeSingle();
    if (error) return failureResponse("public-api-admin: delete webhook", error);
    if (!data) return json({ error: "webhook_not_found" }, 404);
    return json({ deleted: true });
  }

  return json({ error: "invalid_action" }, 400);
});
