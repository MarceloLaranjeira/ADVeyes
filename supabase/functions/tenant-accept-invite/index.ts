import {
  authenticateTenantRequest,
  corsHeaders,
  json,
  postgresErrorCode,
  statusForError,
} from "../_shared/tenant-auth.ts";
import { hashInvitationToken } from "../_shared/tenant-invitations.ts";

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
    typeof body.token !== "string" || body.token.length < 32 ||
    body.token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(body.token)
  ) {
    return json({ error: "invalid_invitation" }, 400);
  }

  const tokenHash = await hashInvitationToken(body.token);
  const { data, error } = await auth.admin.rpc(
    "tenant_accept_invite_server",
    {
      p_user_id: auth.user.id,
      p_token_hash: tokenHash,
    },
  );

  if (error) {
    const code = postgresErrorCode(error);
    if (code === "operation_failed") {
      console.error("tenant-accept-invite", error.code);
    }
    return json(
      { error: code === "operation_failed" ? "invalid_invitation" : code },
      code === "operation_failed" ? 400 : statusForError(code),
    );
  }

  return json(data);
});
