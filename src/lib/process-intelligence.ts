import type {
  IntelligenceConfidence,
  IntelligenceRisk,
  ProcessIntelligenceAssessment,
  ProcessIntelligenceEvent,
  ProcessIntelligenceManualOverride,
  ProcessIntelligenceSemanticSuggestion,
  ProcessIntelligenceThresholds,
  ProcessPhase,
  ProcessStage,
  WaitingOn,
} from "@/types/process-intelligence";
import { DEFAULT_PROCESS_INTELLIGENCE_THRESHOLDS } from "@/types/process-intelligence";

const NON_ADVANCING_PATTERNS = [
  /mero expediente/i,
  /disponibiliza(?:ção|do)/i,
  /publica(?:ção|do) no diário/i,
  /alteração cadastral/i,
  /movimento repetido/i,
];

const PHASE_RULES: Array<{ phase: ProcessPhase; stage: ProcessStage; patterns: RegExp[] }> = [
  { phase: "arquivado_encerrado", stage: "arquivado", patterns: [/arquivad/i, /baixa definitiva/i, /processo encerrado/i] },
  { phase: "suspenso_sobrestado", stage: "suspenso", patterns: [/suspens/i, /sobrestad/i] },
  { phase: "cumprimento_execucao", stage: "pagamento", patterns: [/pagamento realizado/i, /alvará expedido/i, /satisfa(?:ção|cao) da obriga/i] },
  { phase: "cumprimento_execucao", stage: "expropriacao", patterns: [/leilão/i, /hasta pública/i, /expropria/i] },
  { phase: "cumprimento_execucao", stage: "penhora", patterns: [/penhora/i, /bloqueio sisbajud/i, /bacenjud/i] },
  { phase: "cumprimento_execucao", stage: "liquidacao", patterns: [/liquida(?:ção|cao)/i, /cálculos?/i] },
  { phase: "cumprimento_execucao", stage: "cobranca", patterns: [/cumprimento de sentença/i, /execu(?:ção|cao)/i, /intimação para pagar/i] },
  { phase: "recursal", stage: "transito_julgado", patterns: [/trânsito em julgado/i, /transitou em julgado/i] },
  { phase: "recursal", stage: "julgamento", patterns: [/acórdão/i, /recurso julgado/i, /sessão de julgamento/i] },
  { phase: "recursal", stage: "remessa", patterns: [/remetidos ao tribunal/i, /remessa.*tribunal/i] },
  { phase: "recursal", stage: "contrarrazoes", patterns: [/contrarraz/i] },
  { phase: "recursal", stage: "preparacao_recurso", patterns: [/apelação/i, /agravo/i, /recurso interposto/i] },
  { phase: "conhecimento", stage: "sentenca", patterns: [/sentença/i] },
  { phase: "conhecimento", stage: "alegacoes_finais", patterns: [/alegações finais/i, /memoriais/i] },
  { phase: "conhecimento", stage: "pericia", patterns: [/perícia/i, /perito/i, /laudo pericial/i] },
  { phase: "conhecimento", stage: "instrucao", patterns: [/audiência de instrução/i, /depoimento/i, /prova testemunhal/i] },
  { phase: "conhecimento", stage: "defesa", patterns: [/contestação/i, /réplica/i, /defesa apresentada/i] },
  { phase: "conhecimento", stage: "citacao", patterns: [/cita(?:ção|do|da)/i] },
  { phase: "conhecimento", stage: "distribuicao", patterns: [/distribu[ií]d/i, /petição inicial/i] },
];

function textOf(event: ProcessIntelligenceEvent): string {
  return `${event.title} ${event.content}`.replace(/\s+/g, " ").trim();
}

function asTime(value: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isRelevantProcessAdvance(event: ProcessIntelligenceEvent): boolean {
  const text = textOf(event);
  if (!text || !event.occurredAt) return false;
  return !NON_ADVANCING_PATTERNS.some(pattern => pattern.test(text));
}

export function inferProcessPhase(
  events: ProcessIntelligenceEvent[],
  processStatus?: string | null,
): { phase: ProcessPhase; stage: ProcessStage; evidenceId: string | null } {
  const statusEvent: ProcessIntelligenceEvent = {
    id: "process-status",
    kind: "manual",
    occurredAt: null,
    title: processStatus ?? "",
    content: "",
  };
  for (const event of [statusEvent, ...events]) {
    const text = textOf(event);
    const match = PHASE_RULES.find(rule => rule.patterns.some(pattern => pattern.test(text)));
    if (match) return { phase: match.phase, stage: match.stage, evidenceId: event.id };
  }
  return { phase: "nao_identificada", stage: "nao_identificada", evidenceId: null };
}

export function inferWaitingOn(events: ProcessIntelligenceEvent[]): WaitingOn {
  const latest = events[0] ? textOf(events[0]) : "";
  if (/conclusos|aguardando (decisão|sentença|despacho)|remetidos ao tribunal/i.test(latest)) return "juizo_tribunal";
  if (/aguardando.*(laudo|perícia|ofício)|órgão externo|perito/i.test(latest)) return "orgao_externo";
  if (/aguardando.*parte contrária|intimad[oa].*réu|prazo.*réu/i.test(latest)) return "parte_contraria";
  if (/cliente.*(documento|informação|assinatura)|aguardando cliente/i.test(latest)) return "cliente";
  if (/intimad[oa].*(autor|advogado)|manifestar|emendar|apresentar.*(petição|cálculo|documento)/i.test(latest)) return "escritorio";
  return "nao_identificado";
}

function confidenceLabel(score: number): IntelligenceConfidence {
  if (score >= 0.8) return "alta";
  if (score >= 0.55) return "media";
  return "baixa";
}

function daysBetween(from: string | null, to: Date): number {
  if (!from) return 0;
  return Math.max(0, Math.floor((to.getTime() - asTime(from)) / 86_400_000));
}

function thresholdFor(waitingOn: WaitingOn, thresholds: ProcessIntelligenceThresholds): number | null {
  if (waitingOn === "escritorio" || waitingOn === "cliente") return thresholds.officeDays;
  if (waitingOn === "parte_contraria") return thresholds.counterpartyDays;
  if (waitingOn === "juizo_tribunal" || waitingOn === "orgao_externo") return thresholds.courtDays;
  return thresholds.courtDays;
}

function calculateRisk(input: {
  overdue: boolean;
  isStalled: boolean;
  waitingOn: WaitingOn;
  stalledDays: number;
  threshold: number | null;
}): IntelligenceRisk {
  if (input.overdue) return "critico";
  if (input.waitingOn === "escritorio" && input.isStalled) return "alto";
  if (input.isStalled && input.threshold && input.stalledDays >= input.threshold * 2) return "alto";
  if (input.isStalled) return "atencao";
  return "normal";
}

export function assessProcessIntelligence(input: {
  status?: string | null;
  events: ProcessIntelligenceEvent[];
  dueAt?: string | null;
  now?: Date;
  thresholds?: ProcessIntelligenceThresholds;
  semantic?: ProcessIntelligenceSemanticSuggestion | null;
  manualOverride?: ProcessIntelligenceManualOverride | null;
}): ProcessIntelligenceAssessment {
  const now = input.now ?? new Date();
  const thresholds = input.thresholds ?? DEFAULT_PROCESS_INTELLIGENCE_THRESHOLDS;
  const events = [...input.events].sort((left, right) => asTime(right.occurredAt) - asTime(left.occurredAt));
  const inferred = inferProcessPhase(events, input.status);
  const semanticIds = new Set(input.semantic?.evidenceIds ?? []);
  const validSemantic = input.semantic
    && input.semantic.confidence >= 0
    && input.semantic.confidence <= 1
    && input.semantic.evidenceIds.every(id => events.some(event => event.id === id));
  const basePhase = validSemantic ? input.semantic!.phase : inferred.phase;
  const baseStage = validSemantic ? input.semantic!.stage : inferred.stage;
  const baseWaiting = validSemantic ? input.semantic!.waitingOn : inferWaitingOn(events);
  const phase = input.manualOverride?.phase ?? basePhase;
  const stage = input.manualOverride?.stage ?? baseStage;
  const waitingOn = input.manualOverride?.waitingOn ?? baseWaiting;
  const operationalFallback = {
    escritorio: ["Há uma providência pendente do escritório.", "Revisar o último andamento e executar a providência interna."],
    cliente: ["O processo depende de informação, documento ou decisão do cliente.", "Contatar o cliente e registrar a pendência necessária."],
    parte_contraria: ["O próximo avanço depende de manifestação da parte contrária.", "Monitorar o encerramento do prazo da parte contrária."],
    juizo_tribunal: ["Os autos aguardam ato do juízo ou tribunal.", "Monitorar o órgão julgador e avaliar pedido de impulso se cabível."],
    orgao_externo: ["O processo aguarda resposta de perito ou órgão externo.", "Cobrar ou monitorar a diligência externa pendente."],
    nao_identificado: [null, "Revisar o último andamento e definir quem deve agir."],
  }[waitingOn];
  const lastEventAt = events[0]?.occurredAt ?? null;
  const lastAdvance = events.find(isRelevantProcessAdvance) ?? null;
  const lastAdvanceAt = lastAdvance?.occurredAt ?? null;
  const stalledDays = daysBetween(lastAdvanceAt, now);
  const terminal = phase === "suspenso_sobrestado" || phase === "arquivado_encerrado";
  const threshold = terminal ? null : thresholdFor(waitingOn, thresholds);
  const isStalled = Boolean(threshold && lastAdvanceAt && stalledDays >= threshold);
  const overdue = Boolean(input.dueAt && asTime(input.dueAt) < now.getTime());
  const evidenceEvents = events.filter(event =>
    event.id === inferred.evidenceId || event.id === lastAdvance?.id || semanticIds.has(event.id),
  );
  const confidenceScore = input.manualOverride
    ? 1
    : validSemantic
      ? input.semantic!.confidence
      : inferred.evidenceId ? 0.72 : 0.25;

  return {
    phase,
    stage,
    waitingOn,
    waitingReason: input.manualOverride?.waitingReason
      ?? (validSemantic ? input.semantic!.waitingReason : operationalFallback[0]),
    nextAction: input.manualOverride?.nextAction
      ?? (validSemantic ? input.semantic!.nextAction : operationalFallback[1]),
    lastEventAt,
    lastAdvanceAt,
    stalledDays,
    isStalled: terminal ? false : isStalled,
    risk: terminal ? "normal" : calculateRisk({ overdue, isStalled, waitingOn, stalledDays, threshold }),
    confidence: confidenceLabel(confidenceScore),
    confidenceScore,
    evidence: evidenceEvents.map(event => ({
      id: event.id,
      kind: event.kind,
      occurredAt: event.occurredAt,
      title: event.title,
      excerpt: event.content.replace(/\s+/g, " ").trim().slice(0, 240),
    })),
    origin: input.manualOverride ? "manual" : "automatico",
  };
}
