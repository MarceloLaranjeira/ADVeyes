import {
  authenticateTenantRequest,
  corsHeaders,
  json,
  postgresErrorCode,
  statusForError,
} from "../_shared/tenant-auth.ts";
import { isUuid } from "../_shared/tenant-invitations.ts";

const actions = new Set([
  "update_access",
  "suspend",
  "reactivate",
  "update_permissions",
  "read_permissions",
]);
const roles = new Set(["admin", "lawyer", "assistant", "finance"]);
const scopes = new Set(["tenant", "team", "assigned"]);

/** Exceções aceitas; o banco descarta qualquer outra combinação. */
const OVERRIDE_KEYS = new Set([
  "subscription.read",
  "subscription.manage",
  "legal.delete",
  "finance.read",
  "finance.create",
  "finance.update",
  "finance.delete",
  "contracts.read",
  "contracts.create",
  "contracts.update",
  "contracts.delete",
  "critical_delete.execute",
]);

function normalizeOverrides(value: unknown): Record<
  string,
  Record<string, boolean>
> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const result: Record<string, Record<string, boolean>> = {};
  for (const [module, actionsValue] of Object.entries(value)) {
    if (
      !actionsValue || typeof actionsValue !== "object" ||
      Array.isArray(actionsValue)
    ) {
      return null;
    }
    for (const [action, granted] of Object.entries(actionsValue)) {
      if (typeof granted !== "boolean") return null;
      if (!OVERRIDE_KEYS.has(`${module}.${action}`)) return null;
      if (!granted) continue;
      result[module] = { ...result[module], [action]: true };
    }
  }
  return result;
}

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

  const readsOnly = body.action === "read_permissions";
  if (
    !isUuid(body.tenantId) ||
    (!readsOnly && !isUuid(body.membershipId)) ||
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

  if (body.action === "read_permissions") {
    const { data, error } = await auth.admin.rpc(
      "tenant_member_permissions_server",
      {
        p_actor_user_id: auth.user.id,
        p_tenant_id: body.tenantId,
      },
    );

    if (error) {
      const code = postgresErrorCode(error);
      return json({ error: code }, statusForError(code));
    }

    return json({ permissions: data ?? {} });
  }

  if (body.action === "update_permissions") {
    const overrides = normalizeOverrides(body.permissions);
    if (overrides === null) return json({ error: "invalid_payload" }, 400);

    const { data, error } = await auth.admin.rpc(
      "tenant_set_member_permissions_server",
      {
        p_actor_user_id: auth.user.id,
        p_tenant_id: body.tenantId,
        p_membership_id: body.membershipId,
        p_permission_overrides: overrides,
      },
    );

    if (error) {
      const code = postgresErrorCode(error);
      if (code === "operation_failed") {
        console.error("tenant-manage-member permissions", error.code);
      }
      return json({ error: code }, statusForError(code));
    }

    return json(data);
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
