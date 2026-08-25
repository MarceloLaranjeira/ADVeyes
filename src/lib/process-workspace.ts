/**
 * Estado da Central Processual espelhado na URL.
 *
 * Sem isso o estado vive em `useState` e morre quando o componente desmonta:
 * voltar da ficha de um processo devolve a tela em branco. Na URL, voltar
 * devolve a busca, os filtros, a aba e a quantidade já carregada.
 */

import {
  EMPTY_INTELLIGENCE_FILTERS,
  type IntelligenceFilters,
} from "@/lib/process-intelligence-workspace";
import type {
  IntelligenceRisk,
  ProcessPhase,
  WaitingOn,
} from "@/types/process-intelligence";

export type ProcessTab = "central" | "pipeline" | "lista";
export type ProcessSituation = "ativos" | "arquivados" | "todos";

export interface ProcessRouteState {
  tab: ProcessTab;
  situation: ProcessSituation;
  limit: number;
  filters: IntelligenceFilters;
}

const TABS = new Set<ProcessTab>(["central", "pipeline", "lista"]);
const SITUATIONS = new Set<ProcessSituation>(["ativos", "arquivados", "todos"]);
const PHASES = new Set<ProcessPhase>([
  "conhecimento",
  "recursal",
  "cumprimento_execucao",
  "suspenso_sobrestado",
  "arquivado_encerrado",
  "nao_identificada",
]);
const WAITING = new Set<WaitingOn>([
  "escritorio",
  "cliente",
  "parte_contraria",
  "juizo_tribunal",
  "orgao_externo",
  "nao_identificado",
]);
const RISKS = new Set<IntelligenceRisk>(["critico", "alto", "atencao", "normal"]);

/** Página carrega de quarenta em quarenta para a Central seguir rápida. */
export const PROCESS_PAGE_SIZE = 40;

/** Atalhos vindos de outras telas continuam valendo como estado inicial. */
function focusFilters(focus: string | null): Partial<IntelligenceFilters> {
  if (focus === "stalled") return { stalledOnly: true };
  if (focus === "office") return { waitingOn: "escritorio" };
  if (focus === "critical") return { risk: "critico" };
  return {};
}

export function parseProcessRoute(params: URLSearchParams): ProcessRouteState {
  const tab = params.get("tab") as ProcessTab | null;
  const situation = params.get("situacao") as ProcessSituation | null;
  const phase = params.get("fase") as ProcessPhase | null;
  const waitingOn = params.get("aguardando") as WaitingOn | null;
  const risk = params.get("risco") as IntelligenceRisk | null;
  const limit = Number.parseInt(params.get("limit") ?? "", 10);

  return {
    tab: tab && TABS.has(tab) ? tab : "central",
    situation: situation && SITUATIONS.has(situation) ? situation : "ativos",
    limit: Number.isFinite(limit) && limit > 0 ? limit : PROCESS_PAGE_SIZE,
    filters: {
      ...EMPTY_INTELLIGENCE_FILTERS,
      search: params.get("q")?.trim() ?? "",
      phase: phase && PHASES.has(phase) ? phase : "all",
      waitingOn: waitingOn && WAITING.has(waitingOn) ? waitingOn : "all",
      risk: risk && RISKS.has(risk) ? risk : "all",
      area: params.get("area") ?? "all",
      stalledOnly: params.get("parados") === "1",
      ...focusFilters(params.get("focus")),
    },
  };
}

export function processRouteParams(state: ProcessRouteState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.tab !== "central") params.set("tab", state.tab);
  if (state.situation !== "ativos") params.set("situacao", state.situation);
  if (state.limit !== PROCESS_PAGE_SIZE) params.set("limit", String(state.limit));

  const { filters } = state;
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.phase !== "all") params.set("fase", filters.phase);
  if (filters.waitingOn !== "all") params.set("aguardando", filters.waitingOn);
  if (filters.risk !== "all") params.set("risco", filters.risk);
  if (filters.area !== "all") params.set("area", filters.area);
  if (filters.stalledOnly) params.set("parados", "1");
  return params;
}
