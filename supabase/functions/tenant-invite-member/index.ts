import {
  authenticateTenantRequest,
  corsHeaders,
  json,
  postgresErrorCode,
  statusForError,
} from "../_shared/tenant-auth.ts";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  invitationUrl,
  validateInvitePayload,
} from "../_shared/tenant-invitations.ts";
import { queueInvitationEmail } from "../_shared/tenant-email.ts";

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
  const payload = validateInvitePayload(body);
  if (!payload) return json({ error: "invalid_payload" }, 400);

  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const expiresAt = invitationExpiresAt();
  const { data, error } = await auth.admin.rpc(
    "tenant_invite_member_server",
    {
      p_actor_user_id: auth.user.id,
      p_tenant_id: payload.tenantId,
      p_profile: payload.profile,
      p_role: payload.access.role,
      p_data_scope: payload.access.dataScope,
      p_team_id: payload.access.teamId,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    },
  );

  if (error) {
    const code = postgresErrorCode(error);
    if (code === "operation_failed") {
      console.error("tenant-invite-member", error.code);
    }
    return json({ error: code }, statusForError(code));
  }

  const result = data as {
    invitation_id: string;
    member_id: string;
    email: string;
    role: string;
    data_scope: string;
  };
  const emailQueued = await queueInvitationEmail(auth.admin, {
    tenantId: payload.tenantId,
    invitationId: result.invitation_id,
    email: result.email,
    recipientName: payload.profile.name,
    role: result.role,
    dataScope: result.data_scope,
    expiresAt,
    acceptUrl: invitationUrl(token),
    attemptKey: tokenHash.slice(0, 16),
  });

  return json({
    invitationId: result.invitation_id,
    memberId: result.member_id,
    status: "pending",
    emailQueued,
    expiresAt,
  }, 201);
});
