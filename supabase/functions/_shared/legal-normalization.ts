// Contratos internos estáveis para publicações e andamentos.
// A interface e o banco não dependem do formato externo de nenhum provedor.
// Nenhuma função deste módulo acessa rede, segredos ou o runtime do Deno.

export type OriginSystem =
  | "pje"
  | "projudi"
  | "seeu"
  | "dje"
  | "other"
  | "unknown";

export type PublicationProvider = "escavador" | "manual" | "legacy";
export type MovementProvider = "escavador" | "datajud" | "manual";
export type MovementType = "ANDAMENTO" | "DOCUMENTO";

/** Escala aprovada de retentativas: 1min, 5min, 30min, 2h e 6h. */
export const RETRY_DELAYS_MS = [
  60_000,
  300_000,
  1_800_000,
  7_200_000,
  21_600_000,
] as const;

/** Intervalo padrão de reconciliação de uma fonte saudável. */
export const RECONCILIATION_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface NormalizedPublication {
  externalId: string | null;
  tipo: string;
  tribunal: string;
  numeroProcesso: string | null;
  publishedAt: string;
  availableAt: string | null;
  content: string;
  summary: string | null;
  originSystem: OriginSystem;
  sourceName: string | null;
  sourceUrl: string | null;
  possibleDeadline: boolean;
  payload: Record<string, unknown>;
}

export interface NormalizedMovement {
  externalId: string;
  movementType: MovementType;
  occurredAt: string | null;
  title: string | null;
  content: string;
  originSystem: OriginSystem;
  sourceName: string | null;
  sourceUrl: string | null;
  payload: Record<string, unknown>;
}

export interface OriginEvidence {
  /** Campo em que o provedor declara o sistema do evento. */
  systemField?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  content?: string | null;
}

const SYSTEM_TOKENS: Array<[RegExp, OriginSystem]> = [
  [/\bprojudi\b/, "projudi"],
  [/\bseeu\b/, "seeu"],
  [/\bpje\b/, "pje"],
  [/\besaj\b/, "other"],
  [/\beproc\b/, "other"],
];

const DIARY_TOKEN = /\b(dje|di[áa]rio(?:\s+(?:d[ae]\s+)?justi[çc]a)?)\b/;

function searchable(value: string | null | undefined): string {
  return (value ?? "").toLocaleLowerCase("pt-BR");
}

function matchSystem(value: string | null | undefined): OriginSystem | null {
  const text = searchable(value);
  if (!text) return null;
  for (const [pattern, system] of SYSTEM_TOKENS) {
    if (pattern.test(text)) return system;
  }
  return null;
}

/**
 * Classifica o sistema de origem somente com evidência entregue pelo provedor.
 * O tribunal isolado nunca define o sistema: sem evidência, fica desconhecido.
 */
export function resolveOriginSystem(evidence: OriginEvidence): OriginSystem {
  const ordered = [
    evidence.systemField,
    evidence.sourceUrl,
    evidence.sourceName,
    evidence.content,
  ];

  for (const candidate of ordered) {
    const system = matchSystem(candidate);
    if (system) return system;
  }

  if (
    DIARY_TOKEN.test(searchable(evidence.systemField)) ||
    DIARY_TOKEN.test(searchable(evidence.sourceName))
  ) {
    return "dje";
  }

  return "unknown";
}

/** Formata um número CNJ; devolve vazio quando não há 20 dígitos. */
export function formatCnj(value: unknown): string {
  const digits = collapse(value).replace(/\D/g, "");
  if (digits.length !== 20) return "";
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}` +
    `.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`;
}

const DEADLINE_PATTERN =
  /\b(prazo|intimad[oa]s?|dias?\s+(?:úteis|uteis|corridos)|sob pena de)\b/i;

/**
 * Marca a publicação como possível prazo. Nunca cria prazo definitivo:
 * a confirmação humana continua obrigatória.
 */
export function detectPossibleDeadline(
  content: string | null | undefined,
): boolean {
  if (!content) return false;
  return DEADLINE_PATTERN.test(content);
}

/**
 * Normaliza espaçamento. Provedores entregam números, booleanos e objetos em
 * campos declarados como texto, então o valor é convertido antes de qualquer
 * operação de string.
 */
function collapse(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Impressão digital determinística usada quando não há ID externo estável. */
export async function buildContentFingerprint(
  parts: Array<string | null | undefined>,
): Promise<string> {
  const seed = parts.map(collapse).join("|");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(seed),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export interface EscavadorPublicationPayload {
  id?: number | string | null;
  tipo?: string | null;
  data_publicacao?: string | null;
  data_disponibilizacao?: string | null;
  conteudo?: string | null;
  conteudo_simplificado?: string | null;
  numero_processo?: string | null;
  tribunal?: { sigla?: string | null; nome?: string | null } | null;
  fonte?:
    | {
      nome?: string | null;
      sigla?: string | null;
      sistema?: string | null;
      url?: string | null;
    }
    | null;
  [key: string]: unknown;
}

/** Converte uma publicação do Escavador no contrato interno. */
export function normalizeEscavadorPublication(
  raw: EscavadorPublicationPayload,
  context: { receivedAt: string },
): NormalizedPublication {
  const content = collapse(raw.conteudo) ||
    collapse(raw.conteudo_simplificado) ||
    "Publicação sem conteúdo textual.";
  const sourceName = raw.fonte?.nome ?? raw.tribunal?.nome ??
    raw.tribunal?.sigla ?? null;
  const sourceUrl = raw.fonte?.url ?? null;

  return {
    externalId: raw.id == null ? null : String(raw.id),
    tipo: raw.tipo?.toLocaleLowerCase("pt-BR").trim() || "publicacao",
    tribunal: raw.tribunal?.sigla ?? sourceName ?? "Não identificado",
    numeroProcesso: formatCnj(raw.numero_processo) || null,
    publishedAt: isoOrNull(raw.data_publicacao) ?? context.receivedAt,
    availableAt: isoOrNull(raw.data_disponibilizacao),
    content,
    summary: collapse(raw.conteudo_simplificado) || null,
    originSystem: resolveOriginSystem({
      systemField: raw.fonte?.sistema ?? null,
      sourceName,
      sourceUrl,
      content,
    }),
    sourceName,
    sourceUrl,
    possibleDeadline: detectPossibleDeadline(content),
    payload: raw as Record<string, unknown>,
  };
}

export interface EscavadorMovementPayload {
  id?: number | string | null;
  data?: string | null;
  tipo?: string | null;
  tipo_publicacao?: string | null;
  conteudo?: string | null;
  texto_categoria?: string | null;
  fonte?:
    | { nome?: string | null; sigla?: string | null; sistema?: string | null }
    | null;
  [key: string]: unknown;
}

/** Converte um andamento do Escavador no contrato interno. */
export function normalizeEscavadorMovement(
  raw: EscavadorMovementPayload,
): NormalizedMovement {
  const content = collapse(raw.conteudo) || "Movimentação sem conteúdo.";
  const sourceName = raw.fonte?.nome ?? raw.fonte?.sigla ?? null;

  return {
    externalId: raw.id == null ? "" : String(raw.id),
    movementType: "ANDAMENTO",
    occurredAt: isoOrNull(raw.data),
    title: collapse(raw.texto_categoria) || collapse(raw.tipo_publicacao) ||
      null,
    content,
    originSystem: resolveOriginSystem({
      systemField: raw.fonte?.sistema ?? null,
      sourceName,
      content,
    }),
    sourceName,
    sourceUrl: null,
    payload: raw as Record<string, unknown>,
  };
}

export interface DataJudMovementPayload {
  codigo?: number | string | null;
  nome?: string | null;
  dataHora?: string | null;
  // O DataJud entrega `valor` e `codigo` como números nos complementos.
  complementosTabelados?:
    | Array<{
      nome?: string | number | null;
      valor?: string | number | null;
      descricao?: string | number | null;
    }>
    | null;
  [key: string]: unknown;
}

export interface DataJudProcessPayload {
  numeroProcesso?: string | null;
  tribunal?: string | null;
  movimentos?: DataJudMovementPayload[] | null;
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Converte movimentos do DataJud em andamentos.
 * Movimento oficial nunca vira publicação: a separação é estrutural.
 */
export function normalizeDataJudMovements(
  source: DataJudProcessPayload,
): NormalizedMovement[] {
  const tribunal = collapse(source.tribunal);
  const sourceName = tribunal ? `DataJud/CNJ — ${tribunal}` : "DataJud/CNJ";

  return (source.movimentos ?? [])
    .map((movement, index): NormalizedMovement | null => {
      const title = collapse(movement.nome);
      if (!title) return null;

      const occurredAt = isoOrNull(movement.dataHora);
      const complements = (movement.complementosTabelados ?? [])
        .map((complement) => {
          // No DataJud, `descricao` nomeia o complemento (por exemplo
          // "tipo_de_documento") e `nome` traz o valor legível ("Certidão").
          // `valor` é o código numérico correspondente.
          const label = collapse(complement.descricao);
          const value = collapse(complement.nome) || collapse(complement.valor);
          if (!label && !value) return "";
          return label && value ? `${label}: ${value}` : label || value;
        })
        .filter((entry) => entry !== "");
      const identity = movement.codigo == null
        ? slug(title) || `movimento-${index}`
        : String(movement.codigo);

      return {
        externalId: `${identity}:${occurredAt ?? `posicao-${index}`}`,
        movementType: "ANDAMENTO",
        occurredAt,
        title,
        content: complements.length
          ? `${title}\n${complements.join("; ")}`
          : title,
        // O DataJud informa o tribunal, não o sistema processual de origem.
        originSystem: "unknown",
        sourceName,
        sourceUrl: null,
        payload: movement as Record<string, unknown>,
      };
    })
    .filter((movement): movement is NormalizedMovement => movement !== null)
    .sort((left, right) =>
      (right.occurredAt ?? "").localeCompare(left.occurredAt ?? "")
    );
}

/**
 * Retorna o intervalo até a próxima tentativa após uma falha transitória.
 * Depois de cinco falhas a fonte é interrompida e exibida no painel.
 */
export function nextAttemptDelayMs(failureCount: number): number | null {
  if (failureCount < 0) return RETRY_DELAYS_MS[0];
  return RETRY_DELAYS_MS[failureCount] ?? null;
}
