import {
  authenticateTenantRequest,
  corsHeaders,
  failureResponse,
  json,
} from "../_shared/tenant-auth.ts";
import {
  isUuid,
  validateDecidePayload,
} from "../_shared/tenant-access-requests.ts";

/**
 * Listagem e decisão das solicitações. Somente o proprietário — a checagem
 * definitiva vive na função SQL, que também aplica a transação de aprovação.
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

  const raw = (body ?? {}) as Record<string, unknown>;

  if (raw.action === "list") {
    if (!isUuid(raw.tenantId)) return json({ error: "invalid_payload" }, 400);

    const { data, error } = await auth.admin.rpc(
      "tenant_access_requests_overview_server",
      { p_actor_user_id: auth.user.id, p_tenant_id: raw.tenantId },
    );
    if (error) return failureResponse("tenant-decide-access.list", error);

    return json(data ?? { pending: [], decided: [] });
  }

  if (raw.action !== "decide") return json({ error: "invalid_payload" }, 400);

  const payload = validateDecidePayload(body);
  if (!payload) return json({ error: "invalid_payload" }, 400);

  const { data, error } = await auth.admin.rpc("tenant_decide_access_server", {
    p_actor_user_id: auth.user.id,
    p_tenant_id: payload.tenantId,
    p_request_id: payload.requestId,
    p_decision: payload.decision,
    p_role: payload.role,
    p_data_scope: payload.dataScope,
    p_team_id: payload.teamId,
    p_overrides: payload.overrides,
    p_reason: payload.reason,
  });

  if (error) return failureResponse("tenant-decide-access.decide", error);

  return json(data ?? {});
});
