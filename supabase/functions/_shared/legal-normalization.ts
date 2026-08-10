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

export type PublicationProvider = "djen" | "escavador" | "manual" | "legacy";
export type MovementProvider = "escavador" | "datajud" | "manual";
export type MovementType = "ANDAMENTO" | "DOCUMENTO";

export interface NormalizedSubject {
  code: string | null;
  name: string;
}

export interface NormalizedProcessMetadata {
  processNumber: string;
  tribunal: string | null;
  classCode: string | null;
  className: string | null;
  subjects: NormalizedSubject[];
  adjudicatingBody: string | null;
  proceduralSystem: string | null;
  courtLevel: string | null;
  publicSecrecyLevel: number | null;
  filedAt: string | null;
  lastUpdatedAt: string | null;
  provider: "datajud";
  payload: Record<string, unknown>;
}

export interface NormalizedParty {
  externalId: string | null;
  displayName: string;
  normalizedName: string;
  personType: "pessoa_fisica" | "pessoa_juridica" | "orgao_publico" | "desconhecido";
  documentMasked: string | null;
  documentHash: string | null;
  side: "ativo" | "passivo" | "interessado" | "terceiro" | "desconhecido";
  proceduralRole: string | null;
  internalClassification: "cliente" | "parte_contraria" | "terceiro";
  relatedLawyers: Array<Record<string, unknown>>;
  provider: "datajud" | "djen" | "escavador" | "manual" | "legacy";
  payload: Record<string, unknown>;
}

/** Identidade canônica da parte dentro do processo, independente do provedor. */
export function buildPartyIdentityFingerprint(input: {
  tenantId: string;
  processId: string;
  party: Pick<NormalizedParty, "documentHash" | "normalizedName" | "personType" | "side">;
}): Promise<string> {
  return buildContentFingerprint([
    input.tenantId,
    input.processId,
    input.party.documentHash,
    input.party.normalizedName,
    input.party.personType,
    input.party.side,
  ]);
}

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

/** O DJEN é verificado a cada dez minutos. */
export const DJEN_RECONCILIATION_INTERVAL_MS = 10 * 60 * 1000;

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
  communicationType: string | null;
  recipients: Array<Record<string, unknown>>;
  recipientLawyers: Array<Record<string, unknown>>;
  courtBody: string | null;
  hearingEvidence: string | null;
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
  tpuCode: string | null;
  description: string | null;
  complements: Array<{ key: string; label: string; value: string }>;
  notes: string | null;
  documentType: string | null;
  fullTextAvailable: boolean;
  documentUrl: string | null;
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
  meiocompleto?: string | null;
  link?: string | null;
  tipoDocumento?: string | null;
  nomeClasse?: string | null;
  destinatarios?: unknown[] | null;
  destinatarioadvogados?: unknown[] | null;
  [key: string]: unknown;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  Aacute: "Á", aacute: "á", Acirc: "Â", acirc: "â", Agrave: "À",
  agrave: "à", Atilde: "Ã", atilde: "ã", Ccedil: "Ç", ccedil: "ç",
  Eacute: "É", eacute: "é", Ecirc: "Ê", ecirc: "ê", Iacute: "Í",
  iacute: "í", Oacute: "Ó", oacute: "ó", Ocirc: "Ô", ocirc: "ô",
  Otilde: "Õ", otilde: "õ", Uacute: "Ú", uacute: "ú", Uuml: "Ü",
  uuml: "ü", ordm: "º", ordf: "ª", ndash: "–", mdash: "—",
  laquo: "«", raquo: "»",
};

function decodeOneHtmlLayer(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const code = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (entity.startsWith("#")) {
        const code = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return HTML_ENTITIES[entity] ?? match;
    },
  );
}

function decodeHtmlEntities(value: string): string {
  let decoded = value;

  for (let layer = 0; layer < 4; layer += 1) {
    const next = decodeOneHtmlLayer(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

function plainText(value: unknown): string {
  return decodeHtmlEntities(collapse(value))
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> =>
    Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

function hearingEvidence(content: string): string | null {
  const match = content.match(/[^.!?]*(?:audi[êe]ncia|sess[ãa]o de julgamento)[^.!?]*[.!?]?/i);
  return match?.[0]?.trim().slice(0, 500) || null;
}

/** Converte uma comunicação oficial do DJEN no contrato interno. */
export function normalizeDjenPublication(
  raw: DjenPublicationPayload,
  context: { receivedAt: string },
): NormalizedPublication {
  const content = plainText(raw.texto) || "Publicação sem conteúdo textual.";
  const sourceName = collapse(raw.nomeOrgao) || collapse(raw.meiocompleto) ||
    "DJEN/CNJ";
  const sourceUrl = collapse(raw.link) || null;
  const availableAt = isoOrNull(raw.data_disponibilizacao) ??
    isoOrNull(raw.datadisponibilizacao);
  const externalId = raw.id == null
    ? collapse(raw.hash) || null
    : String(raw.id);
  const tipo = collapse(raw.tipoComunicacao) ||
    collapse(raw.tipoDocumento) || "publicacao";
  const summaryParts = [
    collapse(raw.tipoDocumento),
    collapse(raw.nomeClasse),
    content.slice(0, 240),
  ].filter(Boolean);

  return {
    externalId,
    tipo: tipo.toLocaleLowerCase("pt-BR"),
    tribunal: collapse(raw.siglaTribunal) || "Não identificado",
    numeroProcesso: formatCnj(
      raw.numero_processo ?? raw.numeroprocessocommascara,
    ) || null,
    publishedAt: availableAt ?? context.receivedAt,
    availableAt,
    content,
    summary: summaryParts.join(" — ") || null,
    originSystem: resolveOriginSystem({ sourceName, sourceUrl, content }),
    sourceName,
    sourceUrl,
    possibleDeadline: detectPossibleDeadline(content),
    communicationType: collapse(raw.tipoComunicacao) || null,
    recipients: recordArray(raw.destinatarios),
    recipientLawyers: recordArray(raw.destinatarioadvogados),
    courtBody: collapse(raw.nomeOrgao) || null,
    hearingEvidence: hearingEvidence(content),
    payload: raw as Record<string, unknown>,
  };
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
    communicationType: collapse(raw.tipo) || null,
    recipients: [],
    recipientLawyers: [],
    courtBody: null,
    hearingEvidence: hearingEvidence(content),
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
    tpuCode: null,
    description: null,
    complements: [],
    notes: null,
    documentType: null,
    fullTextAvailable: false,
    documentUrl: null,
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
  classe?: { codigo?: number | string | null; nome?: string | null } | string | null;
  assuntos?: Array<{ codigo?: number | string | null; nome?: string | null }> | null;
  orgaoJulgador?: { codigo?: number | string | null; nome?: string | null } | string | null;
  sistema?: { codigo?: number | string | null; nome?: string | null } | string | null;
  grau?: string | null;
  nivelSigilo?: number | string | null;
  dataAjuizamento?: string | null;
  dataHoraUltimaAtualizacao?: string | null;
  partes?: Array<Record<string, unknown>> | null;
  movimentos?: DataJudMovementPayload[] | null;
  [key: string]: unknown;
}

function objectText(
  value: unknown,
  field: "codigo" | "nome",
): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return collapse((value as Record<string, unknown>)[field]);
}

/** Metadados oficiais de capa processual entregues pelo DataJud. */
export function normalizeDataJudProcessMetadata(
  source: DataJudProcessPayload,
): NormalizedProcessMetadata {
  const className = typeof source.classe === "string"
    ? collapse(source.classe)
    : objectText(source.classe, "nome");
  const courtBody = typeof source.orgaoJulgador === "string"
    ? collapse(source.orgaoJulgador)
    : objectText(source.orgaoJulgador, "nome");
  const system = typeof source.sistema === "string"
    ? collapse(source.sistema)
    : objectText(source.sistema, "nome");
  const secrecy = Number(source.nivelSigilo);

  return {
    processNumber: formatCnj(source.numeroProcesso) || collapse(source.numeroProcesso),
    tribunal: collapse(source.tribunal) || null,
    classCode: objectText(source.classe, "codigo") || null,
    className: className || null,
    subjects: (source.assuntos ?? [])
      .map((subject) => ({
        code: collapse(subject.codigo) || null,
        name: collapse(subject.nome),
      }))
      .filter((subject) => Boolean(subject.name)),
    adjudicatingBody: courtBody || null,
    proceduralSystem: system || null,
    courtLevel: collapse(source.grau) || null,
    publicSecrecyLevel: Number.isInteger(secrecy) && secrecy >= 0
      ? secrecy
      : null,
    filedAt: isoOrNull(source.dataAjuizamento),
    lastUpdatedAt: isoOrNull(source.dataHoraUltimaAtualizacao),
    provider: "datajud",
    payload: source as Record<string, unknown>,
  };
}

export function normalizePartyName(value: unknown): string {
  return collapse(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Partes só são emitidas quando a própria fonte pública as fornece. */
export function normalizeDataJudParties(
  source: DataJudProcessPayload,
): NormalizedParty[] {
  return (source.partes ?? []).flatMap((party) => {
    const displayName = collapse(party.nome ?? party.nomeParte ?? party.name);
    if (!displayName) return [];
    const sideRaw = searchable(collapse(party.polo ?? party.side));
    const side: NormalizedParty["side"] = sideRaw.includes("ativ")
      ? "ativo"
      : sideRaw.includes("passiv")
      ? "passivo"
      : sideRaw.includes("terceir")
      ? "terceiro"
      : sideRaw.includes("interess")
      ? "interessado"
      : "desconhecido";
    const typeRaw = normalizePartyName(party.tipoPessoa ?? party.tipo)
      .toLocaleLowerCase("pt-BR");
    const personType: NormalizedParty["personType"] = typeRaw.includes("jur")
      ? "pessoa_juridica"
      : typeRaw.includes("fis")
      ? "pessoa_fisica"
      : typeRaw.includes("orgao")
      ? "orgao_publico"
      : "desconhecido";

    return [{
      externalId: collapse(party.id) || null,
      displayName,
      normalizedName: normalizePartyName(displayName),
      personType,
      documentMasked: collapse(party.documentoMascarado ?? party.documento) || null,
      documentHash: null,
      side,
      proceduralRole: collapse(party.tipoParte ?? party.papel) || null,
      internalClassification: side === "passivo" ? "parte_contraria" : "terceiro",
      relatedLawyers: recordArray(party.advogados),
      provider: "datajud",
      payload: party,
    }];
  });
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const COMPLEMENT_LABELS: Record<string, string> = {
  tipo_de_documento: "Tipo de documento",
  tipo_documento: "Tipo de documento",
  tipo: "Tipo",
  resultado: "Resultado",
  quantidade: "Quantidade",
  nome_da_parte: "Parte",
  nome_parte: "Parte",
  parte: "Parte",
  destinatario: "Destinatário",
  modalidade: "Modalidade",
  motivo: "Motivo",
  situacao: "Situação",
};

const GENERIC_MOVEMENT_TITLES = new Set([
  "documento",
  "movimento",
  "movimentacao",
  "movimentação",
]);

function readableLabel(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("pt-BR");
  if (COMPLEMENT_LABELS[normalized]) return COMPLEMENT_LABELS[normalized];
  const words = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return words
    ? `${words.charAt(0).toLocaleUpperCase("pt-BR")}${words.slice(1)}`
    : "Detalhe";
}

function looksLikeComplementKey(value: string): boolean {
  const normalized = value.toLocaleLowerCase("pt-BR").trim();
  return normalized in COMPLEMENT_LABELS || /[_-]/.test(normalized);
}

function normalizeComplement(complement: {
  nome?: string | number | null;
  valor?: string | number | null;
  descricao?: string | number | null;
}): { key: string; label: string; value: string } | null {
  const description = collapse(complement.descricao);
  const name = collapse(complement.nome);
  const rawValue = collapse(complement.valor);

  let key = description;
  let value = name || rawValue;
  if (looksLikeComplementKey(name) && !looksLikeComplementKey(description)) {
    key = name;
    value = description || rawValue;
  }
  if (!key && value) key = "detalhe";
  if (!key || !value) return null;

  return { key, label: readableLabel(key), value };
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
      const rawTitle = collapse(movement.nome);
      if (!rawTitle) return null;

      const occurredAt = isoOrNull(movement.dataHora);
      const complements = (movement.complementosTabelados ?? [])
        .map(normalizeComplement)
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      const normalizedRawTitle = rawTitle.toLocaleLowerCase("pt-BR");
      const documentComplement = complements.find((entry) =>
        ["tipo_de_documento", "tipo_documento"].includes(
          entry.key.toLocaleLowerCase("pt-BR"),
        )
      );
      const title = GENERIC_MOVEMENT_TITLES.has(normalizedRawTitle) &&
          documentComplement?.value
        ? documentComplement.value
        : rawTitle;
      const detailLines = complements
        .filter((entry) =>
          !(entry === documentComplement && entry.value === title)
        )
        .map((entry) => `${entry.label}: ${entry.value}`);
      const identity = movement.codigo == null
        ? slug(rawTitle) || `movimento-${index}`
        : String(movement.codigo);

      return {
        externalId: `${identity}:${occurredAt ?? `posicao-${index}`}`,
        movementType: documentComplement || normalizedRawTitle === "documento"
          ? "DOCUMENTO"
          : "ANDAMENTO",
        occurredAt,
        title,
        content: detailLines.length
          ? detailLines.join("\n")
          : title === rawTitle
          ? title
          : `Documento registrado: ${title}.`,
        // O DataJud informa o tribunal, não o sistema processual de origem.
        originSystem: "unknown",
        sourceName,
        sourceUrl: null,
        tpuCode: movement.codigo == null ? null : String(movement.codigo),
        description: detailLines.length ? detailLines.join("\n") : null,
        complements,
        notes: complements.find((entry) =>
          ["observacao", "observações", "observacoes", "nota"].includes(
            entry.key.toLocaleLowerCase("pt-BR"),
          )
        )?.value ?? null,
        documentType: documentComplement?.value ?? null,
        fullTextAvailable: false,
        documentUrl: null,
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
