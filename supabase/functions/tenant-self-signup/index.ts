import {
  authenticateTenantRequest,
  corsHeaders,
  json,
  postgresErrorCode,
  statusForError,
} from "../_shared/tenant-auth.ts";

interface SignupRequest {
  requestId?: string;
  displayName?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: SignupRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  const requestId = body.requestId?.trim();
  const displayName = body.displayName?.trim();
  if (
    !requestId || !UUID_PATTERN.test(requestId) || !displayName ||
    displayName.length < 2 || displayName.length > 100
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  const { data, error } = await auth.admin.rpc(
    "provision_self_service_tenant",
    {
      p_user_id: auth.user.id,
      p_request_id: requestId,
      p_display_name: displayName,
    },
  );

  if (error) {
    const code = postgresErrorCode(error);
    if (code === "operation_failed") {
      console.error("tenant-self-signup", error.code);
    }
    return json({ error: code }, statusForError(code));
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.tenant_id) {
    console.error("tenant-self-signup: provisioning returned no tenant");
    return json({ error: "operation_failed" }, 500);
  }

  return json({
    tenantId: result.tenant_id,
    slug: result.slug,
    trialEndsAt: result.trial_ends_at,
    onboardingStep: result.onboarding_step,
  }, 201);
});
