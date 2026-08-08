import type { Database } from "@/integrations/supabase/types";

export type Activity = Database["public"]["Tables"]["tarefas"]["Row"];
export type ActivityInsert = Database["public"]["Tables"]["tarefas"]["Insert"];
export type ActivityUpdate = Database["public"]["Tables"]["tarefas"]["Update"];
export type ActivityUserState = Database["public"]["Tables"]["tarefa_user_state"]["Row"];

export type ActivityStatus = "pendente" | "em_andamento" | "concluída";
export type ActivityPriority = "alta" | "média" | "baixa";

export type ActivityDueKind =
  | "none"
  | "overdue"
  | "today"
  | "tomorrow"
  | "upcoming"
  | "future";

export interface ActivityDueState {
  kind: ActivityDueKind;
  days: number | null;
  label: string | null;
  urgent: boolean;
}

export interface ActivityMetrics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  completedPoints: number;
}

export interface ActivityFilters {
  search: string;
  statuses: ActivityStatus[];
  priorities: ActivityPriority[];
  assigneeId: string | null;
  processId: string | null;
  due: ActivityDueKind | "all";
  favoritesOnly: boolean;
  unreadOnly: boolean;
}

