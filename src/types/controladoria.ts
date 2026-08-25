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
  processId?: string | null;
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

/**
 * Atos aceitos pela função `register_protocol`. A lista espelha o `check` da
 * migration: divergir aqui produz um erro `invalid_tipo` vindo do banco.
 */
export const PROTOCOL_TYPES = [
  { value: "peticao", label: "Petição" },
  { value: "contestacao", label: "Contestação" },
  { value: "recurso", label: "Recurso" },
  { value: "apelacao", label: "Apelação" },
  { value: "embargos", label: "Embargos" },
  { value: "manifestacao", label: "Manifestação" },
  { value: "cumprimento", label: "Cumprimento de sentença" },
  { value: "outro", label: "Outro" },
] as const;

export type ProtocoloTipo = (typeof PROTOCOL_TYPES)[number]["value"];
