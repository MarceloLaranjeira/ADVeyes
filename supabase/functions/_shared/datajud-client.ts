// Adaptador DataJud: consulta pública de processos e movimentos por número CNJ.
// O resultado alimenta exclusivamente processos e andamentos.
// Nenhuma resposta deste adaptador pode virar publicação.

import type { DataJudProcessPayload } from "./legal-normalization.ts";

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";

/** Códigos TR da Justiça Estadual (segmento 8) do padrão CNJ. */
const STATE_COURT_BY_CODE: Record<string, string> = {
  "01": "ac",
  "02": "al",
  "03": "ap",
  "04": "am",
  "05": "ba",
  "06": "ce",
  "07": "dft",
  "08": "es",
  "09": "go",
  "10": "ma",
  "11": "mt",
  "12": "ms",
  "13": "mg",
  "14": "pa",
  "15": "pb",
  "16": "pr",
  "17": "pe",
  "18": "pi",
  "19": "rj",
  "20": "rn",
  "21": "rs",
  "22": "ro",
  "23": "rr",
  "24": "sc",
  "25": "se",
  "26": "sp",
  "27": "to",
};

export class DataJudApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

function aliasFromTribunal(tribunal: string | null | undefined): string | null {
  const value = tribunal?.trim().toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (!value) return null;
  if (/^(tj[a-z]{2}|tjdft|trf[1-6]|trt\d{1,2}|stf|stj|tst|tse|stm)$/.test(value)) {
    return value;
  }
  return null;
}

function aliasFromCnj(cnj: string): string | null {
  const digits = cnj.replace(/\D/g, "");
  if (digits.length !== 20) return null;
  const segment = digits.slice(13, 14);
  const court = digits.slice(14, 16);

  if (segment === "8") {
    const state = STATE_COURT_BY_CODE[court];
    return state ? `tj${state}` : null;
  }
  if (segment === "5") return `trt${Number.parseInt(court, 10)}`;
  if (segment === "4") return `trf${Number.parseInt(court, 10)}`;
  if (segment === "1") return "stf";
  if (segment === "3") return "stj";
  return null;
}

/**
 * Descobre o índice público do processo. O tribunal informado tem prioridade;
 * na ausência dele o segmento e o código do número CNJ são usados.
 * Retorna null quando o DataJud não cobre a origem.
 */
export function resolveDataJudEndpoint(input: {
  cnj: string;
  tribunal?: string | null;
}): string | null {
  const alias = aliasFromTribunal(input.tribunal) ?? aliasFromCnj(input.cnj);
  if (!alias) return null;
  return `${DATAJUD_BASE}/api_publica_${alias}/_search`;
}

export interface DataJudProcess extends DataJudProcessPayload {
  classe: string | null;
  orgaoJulgador: string | null;
  dataAjuizamento: string | null;
  ultimaAtualizacao: string | null;
}

interface DataJudSearchResponse {
  hits?: {
    hits?: Array<{ _source?: Record<string, unknown> }>;
  };
}

/**
 * Busca um processo e seus movimentos públicos.
 * Devolve null quando o processo não é encontrado no índice consultado.
 */
export async function fetchDataJudProcess(input: {
  authorization: string;
  cnj: string;
  tribunal?: string | null;
  timeoutMs?: number;
}): Promise<DataJudProcess | null> {
  const endpoint = resolveDataJudEndpoint({
    cnj: input.cnj,
    tribunal: input.tribunal,
  });
  if (!endpoint) {
    throw new DataJudApiError(400, "datajud_court_not_supported");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: input.authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { match: { numeroProcesso: input.cnj.replace(/\D/g, "") } },
      size: 1,
    }),
    signal: AbortSignal.timeout(input.timeoutMs ?? 10_000),
  });

  if (!response.ok) {
    throw new DataJudApiError(response.status, errorCodeForStatus(response.status));
  }

  const payload = await response.json() as DataJudSearchResponse;
  const source = payload.hits?.hits?.[0]?._source;
  if (!source) return null;

  const orgao = source.orgaoJulgador as { nome?: string } | undefined;
  const classe = source.classe as { nome?: string } | undefined;

  return {
    numeroProcesso: typeof source.numeroProcesso === "string"
      ? source.numeroProcesso
      : input.cnj,
    tribunal: typeof source.tribunal === "string" ? source.tribunal : null,
    classe: classe?.nome ?? null,
    orgaoJulgador: orgao?.nome ?? null,
    dataAjuizamento: typeof source.dataAjuizamento === "string"
      ? source.dataAjuizamento
      : null,
    ultimaAtualizacao: typeof source.dataHoraUltimaAtualizacao === "string"
      ? source.dataHoraUltimaAtualizacao
      : null,
    movimentos: Array.isArray(source.movimentos)
      ? source.movimentos as DataJudProcessPayload["movimentos"]
      : [],
  };
}

function errorCodeForStatus(status: number): string {
  if (status === 401 || status === 403) return "datajud_unauthorized";
  if (status === 429) return "datajud_rate_limited";
  return "datajud_request_failed";
}
