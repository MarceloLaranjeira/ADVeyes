export interface AgilityTask {
  titulo: string;
  status: string;
  data_limite: string | null;
  concluida_em: string | null;
  created_at: string;
  pontos: number | null;
  assignee: string | null;
  responsavel_id: string | null;
}

export interface AgilitySummary {
  onTime: number;
  late: number;
  pending: number;
  /** Média, em dias, entre criação e conclusão das tarefas entregues no prazo. */
  avgDaysOnTime: number | null;
  /** Média, em dias, de atraso das tarefas concluídas ou abertas fora do prazo. */
  avgDaysLate: number | null;
  topLateTasks: Array<{ name: string; count: number }>;
  topLatePeople: Array<{ name: string; count: number }>;
}

const DAY_MS = 86_400_000;
const days = (from: string, to: number) => Math.max(0, (to - Date.parse(from)) / DAY_MS);
const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) =>
  values.length ? round1(values.reduce((sum, v) => sum + v, 0) / values.length) : null;

export const isDone = (task: AgilityTask) => task.status === "concluída";

/** Uma tarefa está em atraso se concluiu depois do prazo ou segue aberta com prazo vencido. */
export function isLate(task: AgilityTask, now: number): boolean {
  if (!task.data_limite) return false;
  const deadline = Date.parse(task.data_limite);
  if (Number.isNaN(deadline)) return false;
  const reference = isDone(task) ? Date.parse(task.concluida_em ?? "") : now;
  return !Number.isNaN(reference) && reference > deadline;
}

export function personOf(task: AgilityTask): string {
  return task.assignee?.trim() || task.responsavel_id || "Sem responsável";
}

function ranking(tasks: AgilityTask[], key: (task: AgilityTask) => string, limit = 5) {
  const counts = new Map<string, number>();
  for (const task of tasks) counts.set(key(task), (counts.get(key(task)) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
}

export function summarizeAgility(tasks: AgilityTask[], now = Date.now()): AgilitySummary {
  const late = tasks.filter((task) => isLate(task, now));
  const onTime = tasks.filter((task) => isDone(task) && !isLate(task, now));
  const lateDelays = late.map((task) => {
    const reference = isDone(task) ? Date.parse(task.concluida_em ?? "") : now;
    return Math.max(0, (reference - Date.parse(task.data_limite as string)) / DAY_MS);
  });
  return {
    onTime: onTime.length,
    late: late.length,
    pending: tasks.filter((task) => !isDone(task)).length,
    avgDaysOnTime: average(onTime.filter((task) => task.concluida_em)
      .map((task) => days(task.created_at, Date.parse(task.concluida_em as string)))),
    avgDaysLate: average(lateDelays),
    topLateTasks: ranking(late, (task) => task.titulo),
    topLatePeople: ranking(late, personOf),
  };
}

export interface ManagementRow {
  person: string;
  task: string;
  points: number;
  deadline: string | null;
  completedAt: string | null;
}

/** Linhas da tabela de gestão: tarefas concluídas, da mais recente para a mais antiga. */
export function managementRows(tasks: AgilityTask[], person: string | null): ManagementRow[] {
  return tasks
    .filter((task) => isDone(task) && (!person || personOf(task) === person))
    .sort((a, b) => Date.parse(b.concluida_em ?? "") - Date.parse(a.concluida_em ?? ""))
    .map((task) => ({
      person: personOf(task),
      task: task.titulo,
      points: task.pontos ?? 0,
      deadline: task.data_limite,
      completedAt: task.concluida_em,
    }));
}
