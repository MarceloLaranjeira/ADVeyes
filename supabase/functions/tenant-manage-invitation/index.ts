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
  isUuid,
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  if (!isUuid(body.tenantId) || typeof body.action !== "string") {
    return json({ error: "invalid_payload" }, 400);
  }

  if (body.action === "overview") {
    const { data, error } = await auth.admin.rpc(
      "tenant_team_overview_server",
      {
        p_actor_user_id: auth.user.id,
        p_tenant_id: body.tenantId,
      },
    );
    if (error) {
      const code = postgresErrorCode(error);
      return json({ error: code }, statusForError(code));
    }
    return json(data);
  }

  if (
    !isUuid(body.invitationId) ||
    !["resend", "revoke"].includes(body.action)
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  let token: string | null = null;
  let tokenHash: string | null = null;
  let expiresAt: string | null = null;
  if (body.action === "resend") {
    token = createInvitationToken();
    tokenHash = await hashInvitationToken(token);
    expiresAt = invitationExpiresAt();
  }

  const { data, error } = await auth.admin.rpc(
    "tenant_manage_invitation_server",
    {
      p_actor_user_id: auth.user.id,
      p_tenant_id: body.tenantId,
      p_invitation_id: body.invitationId,
      p_action: body.action,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    },
  );
  if (error) {
    const code = postgresErrorCode(error);
    if (code === "operation_failed") {
      console.error("tenant-manage-invitation", error.code);
    }
    return json({ error: code }, statusForError(code));
  }

  let emailQueued: boolean | null = null;
  if (body.action === "resend" && token && tokenHash && expiresAt) {
    const result = data as {
      invitation_id: string;
      equipe_id: string | null;
      email: string;
      role: string;
      data_scope: string;
    };
    let recipientName: string | null = null;
    if (result.equipe_id) {
      const { data: professional } = await auth.admin.from("equipe")
        .select("nome")
        .eq("id", result.equipe_id)
        .eq("tenant_id", body.tenantId)
        .maybeSingle();
      recipientName = professional?.nome ?? null;
    }
    emailQueued = await queueInvitationEmail(auth.admin, {
      tenantId: body.tenantId,
      invitationId: result.invitation_id,
      email: result.email,
      recipientName,
      role: result.role,
      dataScope: result.data_scope,
      expiresAt,
      acceptUrl: invitationUrl(token),
      attemptKey: tokenHash.slice(0, 16),
    });
  }

  return json({ ...data as Record<string, unknown>, emailQueued });
});
