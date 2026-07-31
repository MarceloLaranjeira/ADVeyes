import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  buildGoogleAuthorizationUrl,
  corsHeaders,
  createOAuthState,
  enqueueFutureItems,
  getAdminClient,
  getConnectionStatus,
  getOAuthConfiguration,
  GoogleCalendarError,
  jsonResponse,
  processJobs,
  requireUser,
  revokeAndDeleteConnection,
  validateReturnUrl,
} from "../_shared/google-calendar.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const admin = getAdminClient();
    const user = await requireUser(req, admin);
    const body = await req.json().catch(() => ({})) as {
      action?: string;
      returnUrl?: string;
      removeEvents?: boolean;
    };
    const action = body.action ?? "status";

    if (action === "status") {
      return jsonResponse(await getConnectionStatus(admin, user.id));
    }

    if (action === "connect") {
      const config = getOAuthConfiguration();
      const returnUrl = validateReturnUrl(body.returnUrl, config.appUrl);
      const state = await createOAuthState(admin, user.id, returnUrl);
      return jsonResponse({ authorizationUrl: buildGoogleAuthorizationUrl(state) });
    }

    if (action === "sync") {
      const queued = await enqueueFutureItems(admin, user.id);
      const result = await processJobs(admin, 50, user.id);
      return jsonResponse({ queued, ...result });
    }

    if (action === "disconnect") {
      const result = await revokeAndDeleteConnection(
        admin,
        user.id,
        Boolean(body.removeEvents),
      );
      return jsonResponse(result);
    }

    return jsonResponse({ error: "Ação inválida", code: "invalid_action" }, 400);
  } catch (error) {
    const calendarError = error instanceof GoogleCalendarError
      ? error
      : new GoogleCalendarError("Erro interno", "internal_error");
    console.error("google-calendar", {
      code: calendarError.code,
      status: calendarError.status,
    });
    return jsonResponse(
      { error: calendarError.message, code: calendarError.code },
      calendarError.status,
    );
  }
});
