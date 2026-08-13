import type { Database } from "@/integrations/supabase/types";

export type Activity = Database["public"]["Tables"]["tarefas"]["Row"];
export type ActivityInsert = Database["public"]["Tables"]["tarefas"]["Insert"];
export type ActivityUpdate = Database["public"]["Tables"]["tarefas"]["Update"];
export type ActivityUserState = Database["public"]["Tables"]["tarefa_user_state"]["Row"];

export interface ActivityWithUserState extends Activity {
  userState: ActivityUserState | null;
  process: ActivityProcess | null;
}

export interface ActivityProcess {
  id: string;
  number: string;
  clientId: string | null;
  clientName: string | null;
}

export interface ActivityTeamMember {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
}

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
  category: string | null;
}

export type ActivityView = "overview" | "list" | "kanban" | "calendar" | "performance";
export type ActivityScope = "mine" | "office";
export type ActivitySort = "due_asc" | "due_desc" | "priority" | "newest" | "oldest" | "title" | "points";

export interface ActivityRouteState {
  view: ActivityView;
  scope: ActivityScope;
  filters: ActivityFilters;
  sort: ActivitySort;
  page: number;
  pageSize: number;
}

export interface ActivityBulkInput {
  ids: string[];
  update?: ActivityUpdate;
  markReadAt?: string;
  remove?: boolean;
}

export interface ActivityBulkResult {
  succeeded: string[];
  failed: Array<{ id: string; message: string }>;
}
