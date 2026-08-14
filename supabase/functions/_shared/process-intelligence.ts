export type Phase = "conhecimento" | "recursal" | "cumprimento_execucao" | "suspenso_sobrestado" | "arquivado_encerrado" | "nao_identificada";
export type Stage = "distribuicao" | "citacao" | "defesa" | "instrucao" | "pericia" | "alegacoes_finais" | "sentenca" | "preparacao_recurso" | "contrarrazoes" | "remessa" | "julgamento" | "transito_julgado" | "liquidacao" | "cobranca" | "penhora" | "expropriacao" | "pagamento" | "suspenso" | "arquivado" | "nao_identificada";
export type WaitingOn = "escritorio" | "cliente" | "parte_contraria" | "juizo_tribunal" | "orgao_externo" | "nao_identificado";

export interface IntelligenceEvent {
  id: string;
  kind: "movement" | "publication" | "manual";
  occurredAt: string | null;
  title: string;
  content: string;
}

export interface SemanticSuggestion {
  phase: Phase;
  stage: Stage;
  waitingOn: WaitingOn;
  waitingReason: string | null;
  nextAction: string | null;
  confidence: number;
  evidenceIds: string[];
}

const phaseRules: Array<[Phase, Stage, RegExp[]]> = [
  ["arquivado_encerrado", "arquivado", [/arquivad/i, /baixa definitiva/i, /encerrado/i]],
  ["suspenso_sobrestado", "suspenso", [/suspens/i, /sobrestad/i]],
  ["cumprimento_execucao", "pagamento", [/pagamento realizado/i, /alvará expedido/i]],
  ["cumprimento_execucao", "expropriacao", [/leilão/i, /hasta pública/i, /expropria/i]],
  ["cumprimento_execucao", "penhora", [/penhora/i, /sisbajud/i, /bacenjud/i]],
  ["cumprimento_execucao", "liquidacao", [/liquida(?:ção|cao)/i, /cálculos?/i]],
  ["cumprimento_execucao", "cobranca", [/cumprimento de sentença/i, /execu(?:ção|cao)/i, /intimação para pagar/i]],
  ["recursal", "transito_julgado", [/trânsito em julgado/i, /transitou em julgado/i]],
  ["recursal", "julgamento", [/acórdão/i, /recurso julgado/i, /sessão de julgamento/i]],
  ["recursal", "remessa", [/remetidos ao tribunal/i, /remessa.*tribunal/i]],
  ["recursal", "contrarrazoes", [/contrarraz/i]],
  ["recursal", "preparacao_recurso", [/apelação/i, /agravo/i, /recurso interposto/i]],
  ["conhecimento", "sentenca", [/sentença/i]],
  ["conhecimento", "alegacoes_finais", [/alegações finais/i, /memoriais/i]],
  ["conhecimento", "pericia", [/perícia/i, /perito/i, /laudo pericial/i]],
  ["conhecimento", "instrucao", [/audiência de instrução/i, /depoimento/i, /prova testemunhal/i]],
  ["conhecimento", "defesa", [/contestação/i, /réplica/i, /defesa apresentada/i]],
  ["conhecimento", "citacao", [/cita(?:ção|do|da)/i]],
  ["conhecimento", "distribuicao", [/distribu[ií]d/i, /petição inicial/i]],
];

const nonAdvancing = [/mero expediente/i, /disponibiliza(?:ção|do)/i, /publica(?:ção|do) no diário/i, /alteração cadastral/i, /movimento repetido/i];
const text = (event: IntelligenceEvent) => `${event.title} ${event.content}`.replace(/\s+/g, " ").trim();
const time = (value: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).getTime() : 0;

function deterministicPhase(events: IntelligenceEvent[], status: string | null) {
  const candidates = [{ id: "process-status", kind: "manual", occurredAt: null, title: status ?? "", content: "" } as IntelligenceEvent, ...events];
  for (const event of candidates) {
    const content = text(event);
    const match = phaseRules.find(([, , patterns]) => patterns.some(pattern => pattern.test(content)));
    if (match) return { phase: match[0], stage: match[1], evidenceId: event.id };
  }
  return { phase: "nao_identificada" as Phase, stage: "nao_identificada" as Stage, evidenceId: null };
}

function deterministicWaiting(events: IntelligenceEvent[]): WaitingOn {
  const latest = events[0] ? text(events[0]) : "";
  if (/conclusos|aguardando (decisão|sentença|despacho)|remetidos ao tribunal/i.test(latest)) return "juizo_tribunal";
  if (/aguardando.*(laudo|perícia|ofício)|órgão externo|perito/i.test(latest)) return "orgao_externo";
  if (/aguardando.*parte contrária|intimad[oa].*réu|prazo.*réu/i.test(latest)) return "parte_contraria";
  if (/cliente.*(documento|informação|assinatura)|aguardando cliente/i.test(latest)) return "cliente";
  if (/intimad[oa].*(autor|advogado)|manifestar|emendar|apresentar.*(petição|cálculo|documento)/i.test(latest)) return "escritorio";
  return "nao_identificado";
}

export function parseSemanticSuggestion(raw: string, events: IntelligenceEvent[]): SemanticSuggestion | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const value = JSON.parse(cleaned) as Record<string, unknown>;
    const phase = value.phase as Phase;
    const stage = value.stage as Stage;
    const waitingOn = value.waitingOn as WaitingOn;
    const evidenceIds = Array.isArray(value.evidenceIds) ? value.evidenceIds.filter(item => typeof item === "string") as string[] : [];
    const confidence = Number(value.confidence);
    const validPhase = phaseRules.some(rule => rule[0] === phase) || phase === "nao_identificada";
    const validStage = phaseRules.some(rule => rule[1] === stage) || stage === "nao_identificada";
    const validWaiting = ["escritorio", "cliente", "parte_contraria", "juizo_tribunal", "orgao_externo", "nao_identificado"].includes(waitingOn);
    if (!validPhase || !validStage || !validWaiting || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
    if (evidenceIds.some(id => !events.some(event => event.id === id))) return null;
    return {
      phase,
      stage,
      waitingOn,
      waitingReason: typeof value.waitingReason === "string" ? value.waitingReason.slice(0, 600) : null,
      nextAction: typeof value.nextAction === "string" ? value.nextAction.slice(0, 600) : null,
      confidence,
      evidenceIds,
    };
  } catch {
    return null;
  }
}

export function buildIntelligencePrompt(process: Record<string, unknown>, events: IntelligenceEvent[]) {
  const compactEvents = events.slice(0, 40).map(event => ({
    id: event.id,
    date: event.occurredAt,
    title: event.title.slice(0, 180),
    content: event.content.replace(/\s+/g, " ").slice(0, 900),
  }));
  return JSON.stringify({
    process: { number: process.numero, status: process.status, area: process.area, court: process.tribunal, courtUnit: process.adjudicating_body ?? process.vara },
    events: compactEvents,
  });
}

export const PROCESS_INTELLIGENCE_SYSTEM_PROMPT = `Você classifica processos judiciais brasileiros para apoio operacional interno. Responda somente JSON válido com: phase, stage, waitingOn, waitingReason, nextAction, confidence (0 a 1) e evidenceIds. Use apenas IDs fornecidos. Fases: conhecimento, recursal, cumprimento_execucao, suspenso_sobrestado, arquivado_encerrado, nao_identificada. Etapas: distribuicao, citacao, defesa, instrucao, pericia, alegacoes_finais, sentenca, preparacao_recurso, contrarrazoes, remessa, julgamento, transito_julgado, liquidacao, cobranca, penhora, expropriacao, pagamento, suspenso, arquivado, nao_identificada. waitingOn: escritorio, cliente, parte_contraria, juizo_tribunal, orgao_externo, nao_identificado. Se não houver evidência suficiente, use nao_identificada/nao_identificado, confiança baixa e não invente motivo.`;

export function assessIntelligence(input: {
  process: Record<string, unknown>;
  events: IntelligenceEvent[];
  semantic?: SemanticSuggestion | null;
  thresholds: { officeDays: number; counterpartyDays: number; courtDays: number };
  dueAt?: string | null;
  manualOverride?: Record<string, unknown> | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const events = [...input.events].sort((a, b) => time(b.occurredAt) - time(a.occurredAt));
  const inferred = deterministicPhase(events, String(input.process.status ?? ""));
  const semantic = input.semantic;
  const override = input.manualOverride ?? {};
  const phase = (override.phase as Phase | undefined) ?? semantic?.phase ?? inferred.phase;
  const stage = (override.stage as Stage | undefined) ?? semantic?.stage ?? inferred.stage;
  const waitingOn = (override.waitingOn as WaitingOn | undefined) ?? semantic?.waitingOn ?? deterministicWaiting(events);
  const operationalFallback = {
    escritorio: ["Há uma providência pendente do escritório.", "Revisar o último andamento e executar a providência interna."],
    cliente: ["O processo depende de informação, documento ou decisão do cliente.", "Contatar o cliente e registrar a pendência necessária."],
    parte_contraria: ["O próximo avanço depende de manifestação da parte contrária.", "Monitorar o encerramento do prazo da parte contrária."],
    juizo_tribunal: ["Os autos aguardam ato do juízo ou tribunal.", "Monitorar o órgão julgador e avaliar pedido de impulso se cabível."],
    orgao_externo: ["O processo aguarda resposta de perito ou órgão externo.", "Cobrar ou monitorar a diligência externa pendente."],
    nao_identificado: [null, "Revisar o último andamento e definir quem deve agir."],
  }[waitingOn];
  const lastEventAt = events[0]?.occurredAt ?? null;
  const lastAdvance = events.find(event => event.occurredAt && !nonAdvancing.some(pattern => pattern.test(text(event)))) ?? null;
  const lastAdvanceAt = lastAdvance?.occurredAt ?? null;
  const stalledDays = lastAdvanceAt ? Math.max(0, Math.floor((now.getTime() - time(lastAdvanceAt)) / 86_400_000)) : 0;
  const terminal = phase === "suspenso_sobrestado" || phase === "arquivado_encerrado";
  const threshold = waitingOn === "escritorio" || waitingOn === "cliente" ? input.thresholds.officeDays : waitingOn === "parte_contraria" ? input.thresholds.counterpartyDays : input.thresholds.courtDays;
  const isStalled = !terminal && Boolean(lastAdvanceAt) && stalledDays >= threshold;
  const overdue = Boolean(input.dueAt && time(input.dueAt) < now.getTime());
  const risk = terminal ? "normal" : overdue ? "critico" : waitingOn === "escritorio" && isStalled ? "alto" : isStalled && stalledDays >= threshold * 2 ? "alto" : isStalled ? "atencao" : "normal";
  const confidenceScore = input.manualOverride ? 1 : semantic?.confidence ?? (inferred.evidenceId ? 0.72 : 0.25);
  const evidenceIds = new Set([inferred.evidenceId, lastAdvance?.id, ...(semantic?.evidenceIds ?? [])].filter(Boolean));
  return {
    phase,
    stage,
    waiting_on: waitingOn,
    waiting_reason: (override.waitingReason as string | undefined) ?? semantic?.waitingReason ?? operationalFallback[0],
    next_action: (override.nextAction as string | undefined) ?? semantic?.nextAction ?? operationalFallback[1],
    last_event_at: lastEventAt,
    last_advance_at: lastAdvanceAt,
    stalled_days: stalledDays,
    is_stalled: isStalled,
    risk,
    confidence: confidenceScore >= .8 ? "alta" : confidenceScore >= .55 ? "media" : "baixa",
    confidence_score: confidenceScore,
    evidence: events.filter(event => evidenceIds.has(event.id)).map(event => ({ id: event.id, kind: event.kind, occurredAt: event.occurredAt, title: event.title, excerpt: event.content.replace(/\s+/g, " ").slice(0, 240) })),
  };
}
