export type ControladoriaUrgency =
  | "vencido"
  | "hoje"
  | "amanha"
  | "proximo"
  | "sem_prazo";

export type ActionKind = "prazo" | "intimacao";

/** Linha da camada de ação, já normalizada, venha de onde vier. */
export interface ActionItem {
  id: string;
  kind: ActionKind;
  title: string;
  dueDate: string | null;
  processNumber: string | null;
  clientName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  status: string | null;
}

export interface ControladoriaCounters {
  overdue: number;
  today: number;
  nextSevenDays: number;
  withoutAcknowledgement: number;
  withoutAssignee: number;
}

export interface UpcomingHearing {
  id: string;
  tipo: string;
  dataHora: string;
  processId: string | null;
  processNumber: string | null;
  clientName: string | null;
  local: string | null;
}

export interface DoneSummary {
  protocols: number;
  completedDeadlines: number;
}

export interface ControladoriaData {
  generatedAt: string;
  counters: ControladoriaCounters;
  action: ActionItem[];
  upcoming: UpcomingHearing[];
  done: DoneSummary;
  warnings: string[];
}
