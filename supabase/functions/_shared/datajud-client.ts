// Adaptador DataJud: consulta pública de processos e movimentos por número CNJ.
// O resultado alimenta exclusivamente processos e andamentos.
// Nenhuma resposta deste adaptador pode virar publicação.

import type { DataJudProcessPayload } from "./legal-normalization.ts";

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";

/**
 * A API pública do DataJud responde devagar e de forma irregular. Os limites
 * anteriores — 10s por processo e 8s por índice na descoberta — derrubavam a
 * consulta antes de o CNJ responder, e o erro chegava como "Signal timed out."
 * Cinco falhas assim seguidas pausavam a fonte de sincronização por
 * `max_retries`, que é definitivo e exige reativação manual: uma lentidão
 * passageira do tribunal virava uma fonte parada para sempre.
 *
 * Os valores abaixo continuam bem abaixo do limite de execução da Edge
 * Function, e a descoberta consulta os índices em paralelo, então o teto por
 * índice não se soma.
 */
const PROCESS_TIMEOUT_MS = 25_000;
const DISCOVERY_TIMEOUT_MS = 20_000;

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

/** Índices consultados na descoberta por OAB, por seccional. */
const COURTS_BY_OAB_STATE: Record<string, string[]> = {
  AC: ["tjac", "trf1", "trt14"],
  AL: ["tjal", "trf5", "trt19"],
  AM: ["tjam", "trf1", "trt11"],
  AP: ["tjap", "trf1", "trt8"],
  BA: ["tjba", "trf1", "trt5"],
  CE: ["tjce", "trf5", "trt7"],
  DF: ["tjdft", "trf1", "trt10"],
  ES: ["tjes", "trf2", "trt17"],
  GO: ["tjgo", "trf1", "trt18"],
  MA: ["tjma", "trf1", "trt16"],
  MG: ["tjmg", "trf1", "trt3"],
  MS: ["tjms", "trf3", "trt24"],
  MT: ["tjmt", "trf1", "trt23"],
  PA: ["tjpa", "trf1", "trt8"],
  PB: ["tjpb", "trf5", "trt13"],
  PE: ["tjpe", "trf5", "trt6"],
  PI: ["tjpi", "trf1", "trt22"],
  PR: ["tjpr", "trf4", "trt9"],
  RJ: ["tjrj", "trf2", "trt1"],
  RN: ["tjrn", "trf5", "trt21"],
  RO: ["tjro", "trf1", "trt14"],
  RR: ["tjrr", "trf1", "trt11"],
  RS: ["tjrs", "trf4", "trt4"],
  SC: ["tjsc", "trf4", "trt12"],
  SE: ["tjse", "trf5", "trt20"],
  SP: ["tjsp", "trf3", "trt2"],
  TO: ["tjto", "trf1", "trt10"],
};

/**
 * Justiça Militar estadual: existe em apenas três estados e tem índice próprio
 * no DataJud. Sem isto, o processo militar estadual do advogado nunca aparece
 * na descoberta, mesmo o CNJ publicando o índice.
 */
const MILITARY_COURT_BY_OAB_STATE: Record<string, string> = {
  MG: "tjmmg",
  RS: "tjmrs",
  SP: "tjmsp",
};

/**
 * Tribunais superiores: processam recurso de qualquer seccional, então entram
 * na descoberta de toda OAB. Antes ficavam de fora e um recurso no STJ não
 * aparecia para nenhum advogado do país.
 */
const SUPERIOR_COURTS = ["stf", "stj", "tst", "tse", "stm"];

export class DataJudApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

/**
 * `AbortSignal.timeout` existe no Deno e nos navegadores atuais, mas não em
 * todo ambiente de teste. Quando falta, o fallback com AbortController entrega
 * o mesmo comportamento — sem isso, a chamada estourava antes de sair e toda
 * consulta virava "datajud_request_failed" fora de produção.
 */
function timeoutSignal(ms: number): AbortSignal | undefined {
  const factory = (AbortSignal as { timeout?: (ms: number) => AbortSignal })
    .timeout;
  if (typeof factory === "function") return factory.call(AbortSignal, ms);
  if (typeof AbortController !== "function") return undefined;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
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
  rawSource: Record<string, unknown>;
}

interface DataJudSearchResponse {
  hits?: {
    hits?: Array<{ _source?: Record<string, unknown>; sort?: unknown[] }>;
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
    signal: timeoutSignal(input.timeoutMs ?? PROCESS_TIMEOUT_MS),
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
    assuntos: Array.isArray(source.assuntos)
      ? source.assuntos as DataJudProcessPayload["assuntos"]
      : [],
    sistema: source.sistema as DataJudProcessPayload["sistema"],
    grau: typeof source.grau === "string" ? source.grau : null,
    nivelSigilo: typeof source.nivelSigilo === "number" ||
        typeof source.nivelSigilo === "string"
      ? source.nivelSigilo
      : null,
    partes: Array.isArray(source.partes)
      ? source.partes as DataJudProcessPayload["partes"]
      : [],
    movimentos: Array.isArray(source.movimentos)
      ? source.movimentos as DataJudProcessPayload["movimentos"]
      : [],
    rawSource: source,
  };
}

function errorCodeForStatus(status: number): string {
  if (status === 401 || status === 403) return "datajud_unauthorized";
  if (status === 429) return "datajud_rate_limited";
  return "datajud_request_failed";
}

/** Índices onde faz sentido procurar processos de uma OAB. */
export function courtsForOabState(oabState: string): string[] {
  const uf = oabState.trim().toUpperCase();
  const regional = COURTS_BY_OAB_STATE[uf];
  if (!regional) return [];
  const military = MILITARY_COURT_BY_OAB_STATE[uf];
  return [
    ...regional,
    ...(military ? [military] : []),
    ...SUPERIOR_COURTS,
  ];
}

/**
 * Consulta por OAB no índice público. O campo de advogado não é preenchido de
 * forma uniforme pelos tribunais, então a busca cobre as grafias conhecidas.
 */
export function buildOabQuery(
  oabNumber: string,
  oabState: string,
): Record<string, unknown> {
  const digits = oabNumber.replace(/\D/g, "");
  const uf = oabState.trim().toUpperCase();
  const variants = [digits, `${digits}/${uf}`, `${uf}${digits}`, `${uf} ${digits}`];

  return {
    bool: {
      should: variants.flatMap((variant) => [
        { match: { "partes.advogados.inscricaoOab": variant } },
        { match: { "partes.advogados.oab": variant } },
      ]),
      minimum_should_match: 1,
    },
  };
}

export interface DiscoveredProcess {
  numeroProcesso: string;
  court: string;
  tribunal: string | null;
  classe: string | null;
  orgaoJulgador: string | null;
  dataAjuizamento: string | null;
  ultimaAtualizacao: string | null;
  poloAtivo: string | null;
  poloPassivo: string | null;
}

/** Diagnóstico por índice: separa "não achou" de "não deu para perguntar". */
export interface DiscoveryCourtReport {
  court: string;
  status: "ok" | "failed" | "partial";
  found: number;
  pages: number;
  errorCode: string | null;
}

export interface DiscoveryResult {
  processes: DiscoveredProcess[];
  reports: DiscoveryCourtReport[];
}

interface DataJudParty {
  nome?: string;
  polo?: string;
  tipo?: string;
}

function partyByPole(parties: DataJudParty[], pole: string): string | null {
  const found = parties.find((party) =>
    (party.polo ?? party.tipo ?? "").toUpperCase().startsWith(pole)
  );
  return found?.nome ?? null;
}

function mapHitToProcess(
  source: Record<string, unknown>,
  court: string,
): DiscoveredProcess | null {
  if (typeof source.numeroProcesso !== "string") return null;
  const parties = Array.isArray(source.partes)
    ? source.partes as DataJudParty[]
    : [];
  const orgao = source.orgaoJulgador as { nome?: string } | undefined;
  const classe = source.classe as { nome?: string } | undefined;

  return {
    numeroProcesso: source.numeroProcesso,
    court,
    tribunal: typeof source.tribunal === "string"
      ? source.tribunal
      : court.toUpperCase(),
    classe: classe?.nome ?? null,
    orgaoJulgador: orgao?.nome ?? null,
    dataAjuizamento: typeof source.dataAjuizamento === "string"
      ? source.dataAjuizamento
      : null,
    ultimaAtualizacao: typeof source.dataHoraUltimaAtualizacao === "string"
      ? source.dataHoraUltimaAtualizacao
      : null,
    poloAtivo: partyByPole(parties, "A"),
    poloPassivo: partyByPole(parties, "P"),
  };
}

/**
 * Varre um índice inteiro com `search_after`, o único modo de paginação que o
 * Elasticsearch do DataJud aceita além do teto de 10.000 de `from`.
 *
 * A implementação anterior mandava uma única consulta com `size: 50` e tratava
 * o resultado como completo: um advogado com 300 processos no TJ recebia 50 e
 * nenhum aviso de que faltavam 250. Aqui a varredura segue até o índice acabar
 * ou até `maxPages`, e o relatório diz qual dos dois aconteceu.
 */
async function scanCourt(input: {
  authorization: string;
  court: string;
  query: Record<string, unknown>;
  pageSize: number;
  maxPages: number;
  timeoutMs: number;
  fetcher: typeof fetch;
}): Promise<{ processes: DiscoveredProcess[]; report: DiscoveryCourtReport }> {
  const processes: DiscoveredProcess[] = [];
  let searchAfter: unknown[] | null = null;
  let pages = 0;

  for (let page = 0; page < input.maxPages; page += 1) {
    let response: Response;
    try {
      response = await input.fetcher(
        `${DATAJUD_BASE}/api_publica_${input.court}/_search`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: input.authorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: input.query,
            size: input.pageSize,
            // A ordenação estável é o que torna search_after determinístico.
            sort: [{ "@timestamp": { order: "asc" } }, { _id: "asc" }],
            ...(searchAfter ? { search_after: searchAfter } : {}),
          }),
          signal: timeoutSignal(input.timeoutMs),
        },
      );
    } catch {
      return {
        processes,
        report: {
          court: input.court,
          status: pages > 0 ? "partial" : "failed",
          found: processes.length,
          pages,
          errorCode: "datajud_request_failed",
        },
      };
    }

    if (!response.ok) {
      return {
        processes,
        report: {
          court: input.court,
          status: pages > 0 ? "partial" : "failed",
          found: processes.length,
          pages,
          errorCode: errorCodeForStatus(response.status),
        },
      };
    }

    let payload: DataJudSearchResponse;
    try {
      payload = await response.json() as DataJudSearchResponse;
    } catch {
      return {
        processes,
        report: {
          court: input.court,
          status: pages > 0 ? "partial" : "failed",
          found: processes.length,
          pages,
          errorCode: "datajud_invalid_response",
        },
      };
    }

    pages += 1;
    const hits = payload.hits?.hits ?? [];
    for (const hit of hits) {
      const mapped = hit._source ? mapHitToProcess(hit._source, input.court) : null;
      if (mapped) processes.push(mapped);
    }

    if (hits.length < input.pageSize) {
      return {
        processes,
        report: {
          court: input.court,
          status: "ok",
          found: processes.length,
          pages,
          errorCode: null,
        },
      };
    }

    const cursor = hits[hits.length - 1]?.sort;
    if (!Array.isArray(cursor) || cursor.length === 0) {
      // Índice sem campo de ordenação: não dá para continuar com segurança.
      return {
        processes,
        report: {
          court: input.court,
          status: "partial",
          found: processes.length,
          pages,
          errorCode: "datajud_missing_sort_cursor",
        },
      };
    }
    searchAfter = cursor;
  }

  // Saiu pelo teto de páginas: existe mais resultado no índice.
  return {
    processes,
    report: {
      court: input.court,
      status: "partial",
      found: processes.length,
      pages,
      errorCode: "datajud_max_pages_reached",
    },
  };
}

/**
 * Descobre processos de um advogado nos índices da seccional informada.
 * Retorna candidatos: a confirmação de vínculo continua sendo humana.
 */
export async function discoverProcessesByOab(input: {
  authorization: string;
  oabNumber: string;
  oabState: string;
  pageSize?: number;
  maxPages?: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}): Promise<DiscoveryResult> {
  const courts = courtsForOabState(input.oabState);
  if (!courts.length) {
    throw new DataJudApiError(400, "datajud_court_not_supported");
  }

  const query = buildOabQuery(input.oabNumber, input.oabState);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 100));
  const maxPages = Math.min(50, Math.max(1, input.maxPages ?? 20));

  // Os índices são consultados em paralelo: em série, consultas lentas
  // estouram o tempo de espera do navegador antes de a função responder.
  const settled = await Promise.all(
    courts.map((court) =>
      scanCourt({
        authorization: input.authorization,
        court,
        query,
        pageSize,
        maxPages,
        timeoutMs: input.timeoutMs ?? DISCOVERY_TIMEOUT_MS,
        fetcher: input.fetcher ?? fetch,
      })
    ),
  );

  // Um mesmo processo pode aparecer em mais de um índice (ex.: recurso no STJ
  // e origem no TJ). A primeira ocorrência vence, preservando a origem.
  const found = new Map<string, DiscoveredProcess>();
  for (const result of settled) {
    for (const process of result.processes) {
      if (!found.has(process.numeroProcesso)) {
        found.set(process.numeroProcesso, process);
      }
    }
  }

  return {
    processes: Array.from(found.values()),
    reports: settled.map((result) => result.report),
  };
}
