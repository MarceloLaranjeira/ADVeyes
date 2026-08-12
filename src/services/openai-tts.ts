import {
  getAuthenticatedFunctionHeaders,
  getFunctionUrl,
} from "@/integrations/supabase/client";

export const OPENAI_TTS_VOICES = [
  "marin",
  "cedar",
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

export type OpenAITtsVoice = (typeof OPENAI_TTS_VOICES)[number];

export async function generateOpenAITts(
  text: string,
  voice: string,
): Promise<Blob> {
  const headers = await getAuthenticatedFunctionHeaders();
  const response = await fetch(getFunctionUrl("openai-tts"), {
    method: "POST",
    headers,
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    const messages: Record<string, string> = {
      invalid_payload: "Texto ou voz inválidos.",
      openai_not_configured: "A voz OpenAI ainda não está configurada no servidor.",
      speech_generation_failed: "A OpenAI não conseguiu gerar o áudio agora.",
    };
    throw new Error(messages[body?.error ?? ""] ?? "Falha ao gerar voz OpenAI.");
  }

  return response.blob();
}

export function playAudioBlob(
  blob: Blob,
  onEnd?: () => void,
): { audio: HTMLAudioElement; url: string } {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  const release = () => {
    URL.revokeObjectURL(url);
    onEnd?.();
  };
  audio.onended = release;
  audio.onerror = release;
  void audio.play().catch(release);
  return { audio, url };
}
