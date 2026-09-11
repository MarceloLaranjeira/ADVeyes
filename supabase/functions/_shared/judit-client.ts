const DEFAULT_BASE_URL = "https://lawsuits.production.judit.io";

export interface JuditLawsuit {
  code: string;
  tribunal_acronym?: string | null;
  distribution_date?: string | null;
  status?: string | null;
  phase?: string | null;
  parties?: Array<Record<string, unknown>>;
  steps?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface JuditLawsuitResponse {
  has_lawsuits?: boolean;
  request_id?: string;
  response_data?: JuditLawsuit[];
}

export class JuditApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}

function codeForStatus(status: number): string {
  if (status === 401 || status === 403) return "judit_unauthorized";
  if (status === 402) return "judit_insufficient_balance";
  if (status === 429) return "judit_rate_limited";
  return "judit_request_failed";
}

function safeBaseUrl(value?: string): string {
  const parsed = new URL(value || DEFAULT_BASE_URL);
  if (parsed.protocol !== "https:") throw new Error("judit_https_required");
  return parsed.origin;
}

/**
 * Consulta síncrona de baixo custo no Hot Storage. `onDemand` fica desligado
 * por padrão para evitar que uma leitura do painel dispare cobrança no tribunal.
 */
export async function fetchJuditProcess(input: {
  apiKey: string;
  processNumber: string;
  baseUrl?: string;
  onDemand?: boolean;
  cacheTtlDays?: number;
  timeoutMs?: number;
}): Promise<{ requestId: string | null; lawsuit: JuditLawsuit | null }> {
  const search: Record<string, unknown> = {
    search_type: "lawsuit_cnj",
    search_key: input.processNumber,
  };
  if (input.onDemand) {
    search.on_demand = true;
    search.cache_ttl_in_days = Math.max(1, input.cacheTtlDays ?? 1);
  }
  const response = await fetch(`${safeBaseUrl(input.baseUrl)}/lawsuits`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": input.apiKey,
    },
    body: JSON.stringify({ search }),
    signal: AbortSignal.timeout(input.timeoutMs ?? (input.onDemand ? 175_000 : 20_000)),
  });
  if (!response.ok && response.status !== 404) {
    throw new JuditApiError(response.status, codeForStatus(response.status));
  }
  const payload = await response.json() as JuditLawsuitResponse;
  const exact = (payload.response_data ?? []).find((item) =>
    item.code?.replace(/\D/g, "") === input.processNumber.replace(/\D/g, "")
  ) ?? payload.response_data?.[0] ?? null;
  return { requestId: payload.request_id ?? null, lawsuit: exact };
}
