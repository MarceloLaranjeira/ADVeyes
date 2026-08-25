import type { ProcessSituation } from "@/lib/process-workspace";
import type { IntelligenceRisk, ProcessIntelligenceItem, ProcessPhase, WaitingOn } from "@/types/process-intelligence";

export const PHASE_LABELS: Record<ProcessPhase, string> = {
  conhecimento: "Conhecimento",
  recursal: "Recursal",
  cumprimento_execucao: "Cumprimento / execução",
  suspenso_sobrestado: "Suspenso / sobrestado",
  arquivado_encerrado: "Arquivado / encerrado",
  nao_identificada: "Fase não identificada",
};

export const WAITING_LABELS: Record<WaitingOn, string> = {
  escritorio: "Escritório",
  cliente: "Cliente",
  parte_contraria: "Parte contrária",
  juizo_tribunal: "Juízo / tribunal",
  orgao_externo: "Órgão externo",
  nao_identificado: "Não identificado",
};

export const RISK_LABELS: Record<IntelligenceRisk, string> = {
  normal: "Normal",
  atencao: "Atenção",
  alto: "Alto",
  critico: "Crítico",
};

export interface IntelligenceFilters {
  search: string;
  phase: ProcessPhase | "all";
  waitingOn: WaitingOn | "all";
  risk: IntelligenceRisk | "all";
  area: string;
  stalledOnly: boolean;
}

export const EMPTY_INTELLIGENCE_FILTERS: IntelligenceFilters = {
  search: "",
  phase: "all",
  waitingOn: "all",
  risk: "all",
  area: "all",
  stalledOnly: false,
};

export function filterProcessIntelligence(items: ProcessIntelligenceItem[], filters: IntelligenceFilters) {
  const search = filters.search.trim().toLocaleLowerCase("pt-BR");
  return items.filter(item => {
    const intelligence = item.intelligence;
    if (search && ![item.number, item.clientName, item.clientDocument, item.lawyer, item.court, intelligence?.waitingReason, intelligence?.nextAction]
      .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(search)) return false;
    if (filters.phase !== "all" && intelligence?.phase !== filters.phase) return false;
    if (filters.waitingOn !== "all" && intelligence?.waitingOn !== filters.waitingOn) return false;
    if (filters.risk !== "all" && intelligence?.risk !== filters.risk) return false;
    if (filters.area !== "all" && item.area !== filters.area) return false;
    if (filters.stalledOnly && !intelligence?.isStalled) return false;
    return true;
  });
}

export function intelligenceMetrics(items: ProcessIntelligenceItem[]) {
  return items.reduce((metrics, item) => {
    metrics.total += 1;
    if (!item.intelligence) metrics.pending += 1;
    if (item.intelligence?.isStalled) metrics.stalled += 1;
    if (item.intelligence?.waitingOn === "escritorio") metrics.office += 1;
    if (item.intelligence?.risk === "critico") metrics.critical += 1;
    return metrics;
  }, { total: 0, stalled: 0, office: 0, critical: 0, pending: 0 });
}

/**
 * Situação cadastrada, não a fase inferida das movimentações: tirar um
 * processo da mesa por leitura automática esconderia trabalho real.
 */
const ARCHIVED = new Set(["arquivado", "encerrado"]);

export function isArchivedProcess(status: string | null): boolean {
  return ARCHIVED.has((status ?? "").trim().toLocaleLowerCase("pt-BR"));
}

export function applySituation(
  items: ProcessIntelligenceItem[],
  situation: ProcessSituation,
): ProcessIntelligenceItem[] {
  if (situation === "todos") return items;
  const wantArchived = situation === "arquivados";
  return items.filter(item => isArchivedProcess(item.status) === wantArchived);
}

export function sortByAttention(items: ProcessIntelligenceItem[]) {
  const weights: Record<IntelligenceRisk, number> = { critico: 4, alto: 3, atencao: 2, normal: 1 };
  return [...items].sort((a, b) => {
    const risk = (weights[b.intelligence?.risk ?? "normal"] - weights[a.intelligence?.risk ?? "normal"]);
    return risk || ((b.intelligence?.stalledDays ?? -1) - (a.intelligence?.stalledDays ?? -1));
  });
}
