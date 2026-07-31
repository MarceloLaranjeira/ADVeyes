import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  getAdminClient,
  GoogleCalendarError,
  jsonResponse,
  processJobs,
} from "../_shared/google-calendar.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("GOOGLE_CALENDAR_WORKER_SECRET");
  const suppliedSecret = req.headers.get("x-worker-secret");
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({})) as { limit?: number };
    const result = await processJobs(
      getAdminClient(),
      Math.max(1, Math.min(Number(body.limit) || 25, 100)),
    );
    return jsonResponse(result);
  } catch (error) {
    const calendarError = error instanceof GoogleCalendarError
      ? error
      : new GoogleCalendarError("Erro interno", "internal_error");
    console.error("google-calendar-worker", {
      code: calendarError.code,
      status: calendarError.status,
    });
    return jsonResponse(
      { error: calendarError.message, code: calendarError.code },
      calendarError.status,
    );
  }
});
