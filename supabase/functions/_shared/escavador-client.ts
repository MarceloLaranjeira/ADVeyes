const ESCAVADOR_API_BASE = "https://api.escavador.com/api/v2";
const MAX_DISCOVERY_PAGES = 20;

export interface EscavadorLawyer {
  nome: string;
  tipo: string;
  quantidade_processos: number;
}

export interface EscavadorProcessItem {
  numero_cnj: string;
  titulo_polo_ativo?: string | null;
  titulo_polo_passivo?: string | null;
  data_ultima_movimentacao?: string | null;
  estado_origem?: { sigla?: string | null } | null;
  unidade_origem?: {
    nome?: string | null;
    tribunal_sigla?: string | null;
  } | null;
  fontes_tribunais_estao_arquivadas?: boolean | null;
  [key: string]: unknown;
}

interface EscavadorLawyerProcessesResponse {
  advogado_encontrado?: EscavadorLawyer | null;
  items?: EscavadorProcessItem[];
  links?: { next?: string | null };
}

export class EscavadorApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

function safeNextUrl(next: string | null | undefined): string | null {
  if (!next) return null;
  const parsed = new URL(next);
  if (
    parsed.origin !== "https://api.escavador.com" ||
    !parsed.pathname.startsWith("/api/v2/")
  ) {
    throw new EscavadorApiError(502, "invalid_provider_pagination");
  }
  return parsed.toString();
}

export async function discoverLawyerProcesses(input: {
  token: string;
  oabState: string;
  oabNumber: string;
  oabType: string;
}) {
  const url = new URL(`${ESCAVADOR_API_BASE}/advogado/processos`);
  url.searchParams.set("oab_estado", input.oabState);
  url.searchParams.set("oab_numero", input.oabNumber);
  url.searchParams.set("oab_tipo", input.oabType);
  url.searchParams.set("limit", "100");

  let next: string | null = url.toString();
  let page = 0;
  let lawyer: EscavadorLawyer | null = null;
  const processes = new Map<string, EscavadorProcessItem>();

  while (next && page < MAX_DISCOVERY_PAGES) {
    const response = await fetch(next, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.token}`,
      },
    });

    if (!response.ok) {
      const code = response.status === 401
        ? "escavador_unauthorized"
        : response.status === 402
        ? "escavador_insufficient_balance"
        : response.status === 429
        ? "escavador_rate_limited"
        : "escavador_request_failed";
      throw new EscavadorApiError(response.status, code);
    }

    const payload = await response.json() as EscavadorLawyerProcessesResponse;
    lawyer ??= payload.advogado_encontrado ?? null;
    for (const process of payload.items ?? []) {
      if (typeof process.numero_cnj === "string") {
        processes.set(process.numero_cnj, process);
      }
    }

    next = safeNextUrl(payload.links?.next);
    page += 1;
  }

  if (next) {
    throw new EscavadorApiError(502, "escavador_pagination_limit");
  }

  return {
    lawyer,
    processes: Array.from(processes.values()),
    pages: page,
  };
}
