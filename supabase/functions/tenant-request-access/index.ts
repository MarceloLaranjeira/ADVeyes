import { createClient } from "npm:@supabase/supabase-js@2";
import {
  authenticateTenantRequest,
  corsHeaders,
  failureResponse,
  json,
} from "../_shared/tenant-auth.ts";
import {
  hashAccessToken,
  validateLookupPayload,
  validateRequestAccessPayload,
} from "../_shared/tenant-access-requests.ts";

/**
 * Solicitação de acesso pelo integrante.
 *
 * `lookup` mostra apenas a identidade pública do escritório dono do token, de
 * modo que a tela do link possa se apresentar antes do login. `submit` e
 * `status` exigem sessão: a solicitação sempre pertence ao usuário autenticado.
 */
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  const action = (body as Record<string, unknown> | null)?.action;

  // ----- Identidade pública do escritório, sem exigir sessão -----
  if (action === "lookup") {
    const payload = validateLookupPayload(body);
    if (!payload) return json({ error: "invalid_payload" }, 400);

    const admin = createAdminClient();
    if (admin instanceof Response) return admin;

    const tokenHash = await hashAccessToken(payload.token);
    const { data, error } = await admin.rpc(
      "tenant_lookup_access_link_server",
      { p_token_hash: tokenHash },
    );
    if (error) return failureResponse("tenant-request-access.lookup", error);

    return json(data ?? { valid: false, reason: "invalid_token" });
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  // ----- Situação das solicitações do próprio usuário -----
  if (action === "status") {
    const { data, error } = await auth.admin.rpc(
      "tenant_my_access_requests_server",
      { p_user_id: auth.user.id },
    );
    if (error) return failureResponse("tenant-request-access.status", error);
    return json({ requests: data ?? [] });
  }

  if (action !== "submit") return json({ error: "invalid_payload" }, 400);

  const payload = validateRequestAccessPayload(body);
  if (!payload) return json({ error: "invalid_payload" }, 400);

  const tokenHash = await hashAccessToken(payload.token);
  const { data, error } = await auth.admin.rpc(
    "tenant_request_access_server",
    {
      p_user_id: auth.user.id,
      p_token_hash: tokenHash,
      p_profile: payload.profile,
    },
  );

  if (error) return failureResponse("tenant-request-access.submit", error);

  return json(data ?? {}, 201);
});

function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    console.error("tenant-request-access: missing server configuration");
    return json({ error: "server_configuration_error" }, 500);
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
