// Cliente da API pública oficial do DJEN/CNJ.
// Não conhece banco, tenants ou credenciais privadas.

export const DJEN_API_URL =
  "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 20;
const DEFAULT_TIMEOUT_MS = 15_000;

export interface DjenPublicationPayload {
  id?: number | string | null;
  hash?: string | null;
  data_disponibilizacao?: string | null;
  datadisponibilizacao?: string | null;
  siglaTribunal?: string | null;
  tipoComunicacao?: string | null;
  nomeOrgao?: string | null;
  texto?: string | null;
  numero_processo?: string | null;
  numeroprocessocommascara?: string | null;
  meio?: string | null;
  meiocompleto?: string | null;
  link?: string | null;
  tipoDocumento?: string | null;
  nomeClasse?: string | null;
  numeroComunicacao?: number | string | null;
  destinatarios?: Array<Record<string, unknown>> | null;
  destinatarioadvogados?: Array<Record<string, unknown>> | null;
  [key: string]: unknown;
}

interface DjenResponse {
  status?: string;
  message?: string;
  count?: number;
  items?: DjenPublicationPayload[];
}

export interface DjenFetchResult {
  items: DjenPublicationPayload[];
  pages: number;
  totalReported: number | null;
  rateLimit: number | null;
  rateLimitRemaining: number | null;
}

export class DjenApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "DjenApiError";
  }
}

/** Agrupa referências iguais sem considerar o tenant que receberá o resultado. */
export function groupDjenReferences<
  T extends { source_kind: "oab" | "process"; reference: string },
>(sources: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const source of sources) {
    const key = `${source.source_kind}:${source.reference}`;
    const group = groups.get(key) ?? [];
    group.push(source);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function positiveInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function retryAfterMs(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const instant = Date.parse(raw);
  return Number.isNaN(instant) ? null : Math.max(0, instant - Date.now());
}

async function requestPage(
  url: URL,
  fetcher: typeof fetch,
  timeoutMs: number,
  proxySecret?: string,
): Promise<{ body: DjenResponse; headers: Headers }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: {
        Accept: "application/json",
        ...(proxySecret
          ? { Authorization: `Bearer ${proxySecret}` }
          : {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    const code = error instanceof DOMException && error.name === "AbortError"
      ? "djen_timeout"
      : "djen_request_failed";
    throw new DjenApiError(code, code);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new DjenApiError(
      "djen_rate_limited",
      "djen_rate_limited",
      retryAfterMs(response.headers) ?? 60_000,
    );
  }
  if (!response.ok) {
    throw new DjenApiError(
      "djen_request_failed",
      `djen_http_${response.status}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new DjenApiError("djen_invalid_response", "djen_invalid_json");
  }

  if (
    !body || typeof body !== "object" ||
    !Array.isArray((body as DjenResponse).items)
  ) {
    throw new DjenApiError("djen_invalid_response", "djen_invalid_payload");
  }

  return { body: body as DjenResponse, headers: response.headers };
}

export async function fetchDjenPublications(input: {
  sourceKind: "oab" | "process";
  reference: string;
  startDate: string;
  endDate: string;
  fetcher?: typeof fetch;
  pageSize?: number;
  maxPages?: number;
  timeoutMs?: number;
  baseUrl?: string;
  proxySecret?: string;
}): Promise<DjenFetchResult> {
  const fetcher = input.fetcher ?? fetch;
  // A especificação oficial aceita somente 5 ou 100; outros valores são
  // silenciosamente tratados como 5 pela API e quebrariam a parada da página.
  const pageSize = (input.pageSize ?? DEFAULT_PAGE_SIZE) <= 5
    ? 5
    : DEFAULT_PAGE_SIZE;
  const maxPages = Math.min(
    100,
    Math.max(1, input.maxPages ?? DEFAULT_MAX_PAGES),
  );
  const base = new URL(input.baseUrl ?? DJEN_API_URL);
  base.searchParams.set("dataDisponibilizacaoInicio", input.startDate);
  base.searchParams.set("dataDisponibilizacaoFim", input.endDate);
  base.searchParams.set("meio", "D");
  base.searchParams.set("itensPorPagina", String(pageSize));

  if (input.sourceKind === "oab") {
    const [number, state] = input.reference.split("/");
    const oabNumber = (number ?? "").replace(/\D/g, "");
    const oabState = (state ?? "").trim().toUpperCase();
    if (!oabNumber || !/^[A-Z]{2}$/.test(oabState)) {
      throw new DjenApiError("djen_invalid_reference", "invalid_oab");
    }
    base.searchParams.set("numeroOab", oabNumber);
    base.searchParams.set("ufOab", oabState);
  } else {
    const cnj = input.reference.replace(/\D/g, "");
    if (cnj.length !== 20) {
      throw new DjenApiError("djen_invalid_reference", "invalid_cnj");
    }
    base.searchParams.set("numeroProcesso", cnj);
  }

  const items: DjenPublicationPayload[] = [];
  let pages = 0;
  let totalReported: number | null = null;
  let rateLimit: number | null = null;
  let rateLimitRemaining: number | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(base);
    url.searchParams.set("pagina", String(page));
    const response = await requestPage(
      url,
      fetcher,
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      input.proxySecret,
    );
    pages += 1;
    const pageItems = response.body.items ?? [];
    items.push(...pageItems);
    totalReported = typeof response.body.count === "number"
      ? response.body.count
      : totalReported;
    rateLimit = positiveInteger(response.headers.get("x-ratelimit-limit"));
    rateLimitRemaining = positiveInteger(
      response.headers.get("x-ratelimit-remaining"),
    );

    if (
      pageItems.length < pageSize ||
      (totalReported !== null && items.length >= totalReported)
    ) break;
    if (rateLimitRemaining === 0) break;
  }

  return { items, pages, totalReported, rateLimit, rateLimitRemaining };
}
