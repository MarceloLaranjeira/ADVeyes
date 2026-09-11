export class TrackJudApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}

/**
 * Adaptador contratual. A URL é fornecida pelo contrato TrackJud porque a
 * documentação pública não define um endpoint nacional estável.
 */
export async function fetchTrackJudProcess(input: {
  apiKey: string;
  baseUrl: string;
  processNumber: string;
  tribunal?: string | null;
  timeoutMs?: number;
}): Promise<Record<string, unknown> | null> {
  const base = new URL(input.baseUrl);
  if (base.protocol !== "https:") throw new Error("trackjud_https_required");
  const endpoint = new URL("processes/search", base.href.endsWith("/") ? base : `${base.href}/`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({ number: input.processNumber, tribunal: input.tribunal ?? undefined }),
    signal: AbortSignal.timeout(input.timeoutMs ?? 20_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403
      ? "trackjud_unauthorized"
      : response.status === 429 ? "trackjud_rate_limited" : "trackjud_request_failed";
    throw new TrackJudApiError(response.status, code);
  }
  const payload = await response.json();
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
}
