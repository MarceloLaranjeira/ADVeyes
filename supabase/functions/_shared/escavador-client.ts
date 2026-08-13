const ESCAVADOR_API_BASE = "https://api.escavador.com/api/v2";
const MAX_DISCOVERY_PAGES = 20;
const MAX_PROCESS_DETAIL_PAGES = 20;

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

export interface EscavadorProcessCover extends EscavadorProcessItem {
  fontes?: Array<{
    id?: number | string | null;
    sigla?: string | null;
    sistema?: string | null;
    grau_formatado?: string | null;
    envolvidos?: Array<Record<string, unknown>> | null;
    audiencias?: Array<Record<string, unknown>> | null;
    capa?: Record<string, unknown> | null;
    [key: string]: unknown;
  }> | null;
}

interface EscavadorLawyerProcessesResponse {
  advogado_encontrado?: EscavadorLawyer | null;
  items?: EscavadorProcessItem[];
  links?: { next?: string | null };
}

export interface EscavadorMovementItem {
  id: number | string;
  data?: string | null;
  tipo?: string | null;
  tipo_publicacao?: string | null;
  conteudo?: string | null;
  texto_categoria?: string | null;
  fonte?: {
    fonte_id?: number | string | null;
    nome?: string | null;
    tipo?: string | null;
    sigla?: string | null;
    grau?: number | string | null;
    grau_formatado?: string | null;
    sistema?: string | null;
  } | null;
  [key: string]: unknown;
}

export interface EscavadorPublicDocumentItem {
  id: number | string;
  titulo?: string | null;
  descricao?: string | null;
  data?: string | null;
  tipo?: string | null;
  extensao_arquivo?: string | null;
  quantidade_paginas?: number | null;
  key?: string | null;
  links?: { api?: string | null } | null;
  [key: string]: unknown;
}

interface EscavadorPaginatedResponse<T> {
  items?: T[];
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

function errorCodeForStatus(status: number): string {
  if (status === 401) return "escavador_unauthorized";
  if (status === 402) return "escavador_insufficient_balance";
  if (status === 429) return "escavador_rate_limited";
  return "escavador_request_failed";
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

function unwrapPayload<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    if (obj.resposta && typeof obj.resposta === "object") {
      return obj.resposta as T;
    }
    if (obj.data && typeof obj.data === "object") {
      return obj.data as T;
    }
  }
  return payload as T;
}

async function getJson<T>(token: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!response.ok) {
    throw new EscavadorApiError(
      response.status,
      errorCodeForStatus(response.status),
    );
  }
  const raw = await response.json();
  return unwrapPayload<T>(raw);
}

async function fetchPaginated<T>(input: {
  token: string;
  initialUrl: string;
}): Promise<{ items: T[]; pages: number }> {
  let next: string | null = input.initialUrl;
  let page = 0;
  const items: T[] = [];

  while (next && page < MAX_PROCESS_DETAIL_PAGES) {
    const raw = await getJson<unknown>(input.token, next);
    const payload = unwrapPayload<EscavadorPaginatedResponse<T>>(raw);
    const pageItems = payload.items ?? (raw as Record<string, unknown>)?.items ?? [];
    if (Array.isArray(pageItems)) {
      items.push(...pageItems);
    }
    next = safeNextUrl(payload.links?.next ?? (raw as Record<string, unknown>)?.links?.next as string);
    page += 1;
  }
  // Se o limite de páginas for atingido, preserva os itens obtidos até o momento sem derrubar o ciclo.
  return { items, pages: page };
}

export interface EscavadorProcessSummary {
  numero_cnj: string;
  conteudo: string;
  resumo?: string;
  texto?: string;
  atualizado_em: string | null;
  [key: string]: unknown;
}

export interface EscavadorSummaryJob {
  id: number | string;
  status: "PENDENTE" | "FINALIZADO" | "ERRO" | string;
  numero_cnj?: string;
  criado_em?: string | null;
  concluido_em?: string | null;
  [key: string]: unknown;
}

export async function requestEscavadorProcessSummary(input: {
  token: string;
  processNumber: string;
}): Promise<EscavadorSummaryJob> {
  const number = encodeURIComponent(input.processNumber);
  const response = await fetch(
    `${ESCAVADOR_API_BASE}/processos/numero_cnj/${number}/ia/resumo/solicitar-atualizacao`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.token}`,
        "X-Requested-With": "XMLHttpRequest",
      },
    },
  );
  if (!response.ok) {
    throw new EscavadorApiError(response.status, errorCodeForStatus(response.status));
  }
  const raw = await response.json();
  const unwrapped = unwrapPayload<EscavadorSummaryJob>(raw);
  return {
    id: unwrapped.id ?? (raw as Record<string, unknown>)?.id ?? (raw as Record<string, unknown>)?.solicitacao_id ?? "",
    status: unwrapped.status ?? (raw as Record<string, unknown>)?.status ?? "PENDENTE",
    ...unwrapped,
  };
}

export async function fetchEscavadorProcessSummaryStatus(input: {
  token: string;
  processNumber: string;
  requestId: string;
}): Promise<EscavadorSummaryJob> {
  const number = encodeURIComponent(input.processNumber);
  const requestId = encodeURIComponent(input.requestId);
  const raw = await getJson<unknown>(
    input.token,
    `${ESCAVADOR_API_BASE}/processos/numero_cnj/${number}/ia/resumo/status?id=${requestId}`,
  );
  const unwrapped = unwrapPayload<EscavadorSummaryJob>(raw);
  return {
    id: unwrapped.id ?? (raw as Record<string, unknown>)?.id ?? requestId,
    status: unwrapped.status ?? (raw as Record<string, unknown>)?.status ?? "PENDENTE",
    ...unwrapped,
  };
}

export async function fetchEscavadorProcessSummary(input: {
  token: string;
  processNumber: string;
}): Promise<EscavadorProcessSummary> {
  const number = encodeURIComponent(input.processNumber);
  const raw = await getJson<unknown>(
    input.token,
    `${ESCAVADOR_API_BASE}/processos/numero_cnj/${number}/ia/resumo`,
  );
  const unwrapped = unwrapPayload<EscavadorProcessSummary>(raw);
  const conteudo = unwrapped.conteudo ??
    unwrapped.resumo ??
    unwrapped.texto ??
    ((raw as Record<string, unknown>)?.conteudo as string) ??
    ((raw as Record<string, unknown>)?.resumo as string) ??
    "";
  return {
    numero_cnj: unwrapped.numero_cnj ?? input.processNumber,
    conteudo,
    atualizado_em: unwrapped.atualizado_em ?? null,
    ...unwrapped,
  };
}

/** Capa complementar V2; inclui envolvidos e audiências por fonte. */
export function fetchEscavadorProcessCover(input: {
  token: string;
  processNumber: string;
}): Promise<EscavadorProcessCover> {
  const number = encodeURIComponent(input.processNumber);
  return getJson<EscavadorProcessCover>(
    input.token,
    `${ESCAVADOR_API_BASE}/processos/numero_cnj/${number}`,
  );
}

/** Movimentações completas, seguindo o cursor oficial sem expor o PAT. */
export function fetchEscavadorProcessMovements(input: {
  token: string;
  processNumber: string;
}): Promise<{ items: EscavadorMovementItem[]; pages: number }> {
  const number = encodeURIComponent(input.processNumber);
  return fetchPaginated<EscavadorMovementItem>({
    token: input.token,
    initialUrl: `${ESCAVADOR_API_BASE}/processos/numero_cnj/${number}/movimentacoes?limit=100&ordem=desc`,
  });
}

/** Metadados dos documentos públicos disponíveis para o processo. */
export function fetchEscavadorPublicDocuments(input: {
  token: string;
  processNumber: string;
}): Promise<{ items: EscavadorPublicDocumentItem[]; pages: number }> {
  const number = encodeURIComponent(input.processNumber);
  return fetchPaginated<EscavadorPublicDocumentItem>({
    token: input.token,
    initialUrl: `${ESCAVADOR_API_BASE}/processos/numero_cnj/${number}/documentos-publicos?limit=100`,
  });
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

    if (response.status === 404) {
      return {
        lawyer: null,
        processes: [],
        pages: 0,
      };
    }

    if (!response.ok) {
      throw new EscavadorApiError(
        response.status,
        errorCodeForStatus(response.status),
      );
    }

    const raw = await response.json();
    const payload = unwrapPayload<EscavadorLawyerProcessesResponse>(raw);
    lawyer ??= payload.advogado_encontrado ?? (raw as Record<string, unknown>)?.advogado_encontrado as EscavadorLawyer ?? null;
    const items = payload.items ?? (raw as Record<string, unknown>)?.items as EscavadorProcessItem[] ?? [];
    for (const process of items) {
      if (typeof process.numero_cnj === "string") {
        processes.set(process.numero_cnj, process);
      }
    }

    next = safeNextUrl(payload.links?.next ?? (raw as Record<string, unknown>)?.links?.next as string);
    page += 1;
  }

  return {
    lawyer,
    processes: Array.from(processes.values()),
    pages: page,
  };
}

interface EscavadorMonitorResponse {
  id: number | string;
  numero?: string;
  frequencia?: string;
  status?: string;
  documentos_publicos?: boolean;
  [key: string]: unknown;
}

export async function createProcessMonitor(input: {
  token: string;
  processNumber: string;
  tribunal?: string | null;
  frequency: "DIARIA" | "SEMANAL";
  includePublicDocuments: boolean;
}): Promise<EscavadorMonitorResponse> {
  const response = await fetch(`${ESCAVADOR_API_BASE}/monitoramentos/processos`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      numero: input.processNumber,
      ...(input.tribunal ? { tribunal: input.tribunal } : {}),
      frequencia: input.frequency,
      documentos_publicos: input.includePublicDocuments,
    }),
  });

  if (!response.ok) {
    throw new EscavadorApiError(
      response.status,
      errorCodeForStatus(response.status),
    );
  }

  const raw = await response.json();
  const unwrapped = unwrapPayload<EscavadorMonitorResponse>(raw);
  const monitorId = unwrapped.id ?? (raw as Record<string, unknown>)?.id ?? (raw as Record<string, unknown>)?.monitoramento_id ?? "";
  return {
    id: monitorId,
    ...unwrapped,
  };
}

