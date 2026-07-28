import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  consumeOAuthState,
  enqueueFutureItems,
  exchangeAuthorizationCode,
  getAdminClient,
  getOAuthConfiguration,
  GoogleCalendarError,
  processJobs,
  storeGoogleCredentials,
  verifyGoogleIdentity,
} from "../_shared/google-calendar.ts";

serve(async (req) => {
  const requestUrl = new URL(req.url);
  const state = requestUrl.searchParams.get("state");
  let returnUrl = `${safeAppUrl()}/configuracoes`;

  try {
    if (!state) {
      throw new GoogleCalendarError("State ausente", "missing_oauth_state", 400);
    }

    const admin = getAdminClient();
    const consumedState = await consumeOAuthState(admin, state);
    returnUrl = consumedState.returnUrl;

    const providerError = requestUrl.searchParams.get("error");
    if (providerError) {
      throw new GoogleCalendarError(
        "Autorização cancelada",
        providerError === "access_denied" ? "access_denied" : "google_oauth_error",
        400,
      );
    }

    const code = requestUrl.searchParams.get("code");
    if (!code) {
      throw new GoogleCalendarError("Código ausente", "missing_oauth_code", 400);
    }

    const token = await exchangeAuthorizationCode(code);
    if (!token.id_token) {
      throw new GoogleCalendarError("Identidade Google ausente", "missing_id_token", 400);
    }
    const identity = await verifyGoogleIdentity(token.id_token);

    await storeGoogleCredentials(
      admin,
      consumedState.userId,
      token,
      identity.subject,
    );
    const { error: connectionError } = await admin
      .from("google_calendar_connections")
      .upsert({
        user_id: consumedState.userId,
        google_email: identity.email,
        google_subject: identity.subject,
        calendar_id: "primary",
        status: "connected",
        connected_at: new Date().toISOString(),
        last_error_code: null,
        last_error_at: null,
      });
    if (connectionError) {
      throw new GoogleCalendarError(
        "Não foi possível concluir a conexão",
        "connection_store_failed",
      );
    }

    await enqueueFutureItems(admin, consumedState.userId);
    await processJobs(admin, 25, consumedState.userId);
    return redirectWithResult(returnUrl, "connected");
  } catch (error) {
    const calendarError = error instanceof GoogleCalendarError
      ? error
      : new GoogleCalendarError("Erro interno", "internal_error");
    console.error("google-calendar-callback", {
      code: calendarError.code,
      status: calendarError.status,
    });
    return redirectWithResult(returnUrl, "error", calendarError.code);
  }
});

function safeAppUrl(): string {
  try {
    return getOAuthConfiguration().appUrl;
  } catch {
    return "https://adveyes.automatikus.com.br";
  }
}

function redirectWithResult(
  destination: string,
  result: "connected" | "error",
  code?: string,
): Response {
  const url = new URL(destination);
  url.searchParams.set("google_calendar", result);
  if (code) url.searchParams.set("google_calendar_error", code);
  return Response.redirect(url.toString(), 302);
}
