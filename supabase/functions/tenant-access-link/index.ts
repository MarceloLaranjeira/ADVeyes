import {
  authenticateTenantRequest,
  corsHeaders,
  failureResponse,
  json,
} from "../_shared/tenant-auth.ts";
import {
  accessRequestUrl,
  createAccessToken,
  hashAccessToken,
  validateAccessLinkPayload,
} from "../_shared/tenant-access-requests.ts";

/**
 * Link privado de solicitação. Só o proprietário administra — a checagem
 * definitiva é da função SQL, aqui apenas autenticamos e repassamos.
 *
 * O token em claro só volta no momento da geração; depois disso o banco
 * guarda apenas o hash e a URL não pode ser recuperada.
 */
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  const payload = validateAccessLinkPayload(body);
  if (!payload) return json({ error: "invalid_payload" }, 400);

  const token = payload.action === "generate" ? createAccessToken() : null;
  const tokenHash = token ? await hashAccessToken(token) : null;

  const { data, error } = await auth.admin.rpc("tenant_access_link_server", {
    p_actor_user_id: auth.user.id,
    p_tenant_id: payload.tenantId,
    p_action: payload.action,
    p_token_hash: tokenHash,
  });

  if (error) return failureResponse("tenant-access-link", error);

  const result = (data ?? {}) as Record<string, unknown>;
  return json({
    ...result,
    url: token ? accessRequestUrl(token) : null,
  });
});
