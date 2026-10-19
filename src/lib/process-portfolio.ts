import { isArchivedProcess } from "@/lib/process-intelligence-workspace";

export interface PortfolioProcess {
  area: string | null;
  status: string | null;
  /** Último movimento do cadastro; serve de data de encerramento dos processos arquivados. */
  updatedAt: string;
}

export interface ClosureGoal {
  name: string;
  target: number;
  closed: number;
}

export interface PortfolioSummary {
  active: number;
  closedThisMonth: number;
  closedPreviousMonth: number;
  /** Variação percentual sobre o mês anterior; null sem encerramentos no mês anterior. */
  closedChangePct: number | null;
  goals: ClosureGoal[];
}

const monthKey = (iso: string) => iso.slice(0, 7);
const normalize = (value: string | null) => (value ?? "").trim().toLocaleLowerCase("pt-BR");

/**
 * O cadastro não guarda a data de encerramento: o mês de fechamento é o da
 * última atualização do processo arquivado (aproximação documentada na tela).
 */
export function summarizePortfolio(
  processes: PortfolioProcess[],
  goals: Array<{ nome: string; valor: number | null }>,
  now = new Date(),
): PortfolioSummary {
  const thisMonth = now.toISOString().slice(0, 7);
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const closed = processes.filter((p) => isArchivedProcess(p.status));
  const closedThis = closed.filter((p) => monthKey(p.updatedAt) === thisMonth);
  const closedPrev = closed.filter((p) => monthKey(p.updatedAt) === previous).length;

  return {
    active: processes.length - closed.length,
    closedThisMonth: closedThis.length,
    closedPreviousMonth: closedPrev,
    closedChangePct: closedPrev > 0 ? Math.round(((closedThis.length - closedPrev) / closedPrev) * 100) : null,
    goals: goals
      .filter((goal) => goal.valor !== null && goal.valor > 0)
      .map((goal) => ({
        name: goal.nome,
        target: goal.valor as number,
        closed: closedThis.filter((p) => normalize(p.area) === normalize(goal.nome)).length,
      })),
  };
}
