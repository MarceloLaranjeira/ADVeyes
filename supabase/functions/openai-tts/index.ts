import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";

const VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova",
  "onyx", "sage", "shimmer", "verse", "marin", "cedar",
]);
const MAX_INPUT_LENGTH = 4096;

interface SpeechRequest {
  text?: string;
  voice?: string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: SpeechRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  const text = body.text?.replace(/\s+/g, " ").trim() ?? "";
  const voice = body.voice?.trim().toLowerCase() ?? "marin";
  if (!text || text.length > MAX_INPUT_LENGTH || !VOICES.has(voice)) {
    return json({ error: "invalid_payload" }, 400);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "openai_not_configured" }, 503);

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        input: text,
        voice,
        instructions: "Fale em português brasileiro, com clareza, naturalidade e tom profissional.",
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      console.error("openai-tts: provider error", response.status, await response.text());
      return json({ error: "speech_generation_failed" }, 502);
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("openai-tts: request failed", error);
    return json({ error: "speech_generation_failed" }, 502);
  }
});
