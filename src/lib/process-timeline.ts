import { decodeHtmlEntities } from "@/lib/html-entities";

export type ProcessTimelineKind = "movement" | "publication" | "manual";

export interface ProcessTimelineEvent {
  id: string;
  kind: ProcessTimelineKind;
  occurredAt: string | null;
  title: string;
  summary: string;
  content: string;
  provider: string;
  sourceName: string | null;
  sourceUrl: string | null;
  tribunal: string | null;
  possibleDeadline: boolean;
}

export interface OfficialMovementInput {
  id: string;
  occurred_at?: string | null;
  title?: string | null;
  content?: string | null;
  provider?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  movement_type?: string | null;
  description?: string | null;
  notes?: string | null;
  document_type?: string | null;
}

export interface PublicationInput {
  id: string;
  data_publicacao?: string | null;
  tipo?: string | null;
  conteudo?: string | null;
  conteudo_simplificado?: string | null;
  provider?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  tribunal?: string | null;
  possible_deadline?: boolean | null;
}

export interface ManualMovementInput {
  id: string;
  data_andamento?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  origem?: string | null;
  tribunal?: string | null;
}

function clean(value?: string | null) {
  return decodeHtmlEntities(value ?? "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function summarizeTimelineText(value: string, limit = 240) {
  const normalized = clean(value);
  if (normalized.length <= limit) return normalized;
  const candidate = normalized.slice(0, limit + 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > limit * 0.65 ? boundary : limit).trim()}…`;
}

function timestamp(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildProcessTimeline(input: {
  movements?: OfficialMovementInput[];
  publications?: PublicationInput[];
  manual?: ManualMovementInput[];
}): ProcessTimelineEvent[] {
  const events: ProcessTimelineEvent[] = [];

  for (const item of input.movements ?? []) {
    const details = [clean(item.content), clean(item.description), clean(item.notes)]
      .filter((value, index, values) => value && values.indexOf(value) === index);
    const content = details.join("\n\n") || "Movimentação registrada sem descrição detalhada.";
    const fallback = item.movement_type === "DOCUMENTO" ? "Documento" : "Andamento";
    events.push({
      id: `movement:${item.id}`,
      kind: "movement",
      occurredAt: item.occurred_at ?? null,
      title: clean(item.title) || clean(item.document_type) || fallback,
      summary: summarizeTimelineText(content),
      content,
      provider: clean(item.provider) || "Fonte oficial",
      sourceName: clean(item.source_name) || null,
      sourceUrl: item.source_url ?? null,
      tribunal: null,
      possibleDeadline: false,
    });
  }

  for (const item of input.publications ?? []) {
    const fullContent = clean(item.conteudo) || "Publicação registrada sem conteúdo extraído.";
    const conciseContent = clean(item.conteudo_simplificado) || fullContent;
    events.push({
      id: `publication:${item.id}`,
      kind: "publication",
      occurredAt: item.data_publicacao ?? null,
      title: clean(item.tipo) || "Publicação",
      summary: summarizeTimelineText(conciseContent),
      content: fullContent,
      provider: clean(item.provider) || "Diário oficial",
      sourceName: clean(item.source_name) || null,
      sourceUrl: item.source_url ?? null,
      tribunal: clean(item.tribunal) || null,
      possibleDeadline: Boolean(item.possible_deadline),
    });
  }

  for (const item of input.manual ?? []) {
    const content = clean(item.descricao) || "Registro manual sem descrição.";
    events.push({
      id: `manual:${item.id}`,
      kind: "manual",
      occurredAt: item.data_andamento ?? null,
      title: clean(item.tipo) || "Registro manual",
      summary: summarizeTimelineText(content),
      content,
      provider: clean(item.origem) || "Manual",
      sourceName: null,
      sourceUrl: null,
      tribunal: clean(item.tribunal) || null,
      possibleDeadline: false,
    });
  }

  return events.sort((left, right) => {
    const byDate = timestamp(right.occurredAt) - timestamp(left.occurredAt);
    return byDate || left.id.localeCompare(right.id);
  });
}

export function isSafeExternalUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
