import {
  authenticateTenantRequest,
  corsHeaders,
  json,
  postgresErrorCode,
  statusForError,
} from "../_shared/tenant-auth.ts";
import { isUuid } from "../_shared/tenant-invitations.ts";

const actions = new Set(["update_access", "suspend", "reactivate"]);
const roles = new Set(["admin", "lawyer", "assistant", "finance"]);
const scopes = new Set(["tenant", "team", "assigned"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  if (
    !isUuid(body.tenantId) || !isUuid(body.membershipId) ||
    typeof body.action !== "string" || !actions.has(body.action)
  ) {
    return json({ error: "invalid_payload" }, 400);
  }
  if (
    body.action === "update_access" &&
    (typeof body.role !== "string" || !roles.has(body.role) ||
      typeof body.dataScope !== "string" || !scopes.has(body.dataScope) ||
      (body.dataScope === "team" && !isUuid(body.teamId)))
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  const { data, error } = await auth.admin.rpc(
    "tenant_manage_member_server",
    {
      p_actor_user_id: auth.user.id,
      p_tenant_id: body.tenantId,
      p_membership_id: body.membershipId,
      p_action: body.action,
      p_role: body.role ?? null,
      p_data_scope: body.dataScope ?? null,
      p_team_id: body.dataScope === "team" ? body.teamId : null,
      p_profile: body.profile ?? null,
    },
  );

  if (error) {
    const code = postgresErrorCode(error);
    if (code === "operation_failed") {
      console.error("tenant-manage-member", error.code);
    }
    return json({ error: code }, statusForError(code));
  }

  return json(data);
});
