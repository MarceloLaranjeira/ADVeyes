import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export interface TenantAuthContext {
  user: User;
  admin: SupabaseClient;
}

export async function authenticateTenantRequest(
  request: Request,
): Promise<TenantAuthContext | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("tenant-auth: missing server configuration");
    return json({ error: "server_configuration_error" }, 500);
  }

  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getUser(token);

  if (error || !data.user) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { user: data.user, admin };
}

export function postgresErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "operation_failed";
  const record = error as { message?: string; code?: string };
  const stable = new Set([
    "permission_denied",
    "member_already_active",
    "member_not_found",
    "owner_requires_transfer",
    "invitation_not_found",
    "invitation_not_pending",
    "invalid_invitation",
    "invitation_expired",
    "invitation_unavailable",
    "email_mismatch",
    "already_accepted",
    "invalid_role",
    "invalid_data_scope",
    "owner_required_for_subscription",
    "team_required",
    "invalid_team",
    "invalid_action",
    "signup_email_not_confirmed",
    "signup_user_already_linked",
    "signup_invitation_pending",
    "signup_trial_plan_unavailable",
    "signup_office_name_invalid",
    "pilot_seat_limit",
  ]);

  return record.message && stable.has(record.message)
    ? record.message
    : "operation_failed";
}

export function statusForError(code: string): number {
  if (
    code === "permission_denied" || code === "email_mismatch" ||
    code === "owner_required_for_subscription"
  ) return 403;
  if (code === "member_not_found" || code === "invitation_not_found") {
    return 404;
  }
  if (
    code === "member_already_active" || code === "already_accepted" ||
    code === "invitation_not_pending" ||
    code === "signup_user_already_linked" ||
    code === "signup_invitation_pending" ||
    code === "pilot_seat_limit"
  ) return 409;
  if (code === "signup_email_not_confirmed") return 403;
  if (code === "signup_trial_plan_unavailable") return 503;
  if (code === "operation_failed") return 500;
  return 400;
}
