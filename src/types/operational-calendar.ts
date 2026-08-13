import type { Database } from "@/integrations/supabase/types";

export type CalendarEvent = Database["public"]["Tables"]["eventos"]["Row"];
export type CalendarTask = Database["public"]["Tables"]["tarefas"]["Row"];
type Hearing = Database["public"]["Tables"]["audiencias"]["Row"];

export interface CalendarEventWithProcess extends CalendarEvent {
  processos: { numero: string; cliente_nome: string | null } | null;
}

export interface CalendarTaskWithProcess extends CalendarTask {
  processos: { numero: string; cliente_nome: string | null } | null;
}

export interface CalendarHearing extends Hearing {
  processos: { numero: string; cliente_nome: string | null } | null;
}

export type OperationalCalendarSource = "event" | "task" | "hearing";
export type OperationalCalendarScope = "mine" | "office";
export type OperationalCalendarView = "month" | "week" | "day" | "list";

export interface OperationalCalendarFilters {
  assigneeId?: string | null;
  sourceType?: OperationalCalendarSource | "all";
  itemType?: string | null;
  status?: string | null;
  processId?: string | null;
  clientName?: string | null;
  query?: string | null;
}

export interface OperationalCalendarMember {
  id: string;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  role: string | null;
}

export interface OperationalCalendarFailure {
  source: OperationalCalendarSource | "members";
  message: string;
}

export interface OperationalCalendarItem {
  id: string;
  sourceType: OperationalCalendarSource;
  sourceId: string;
  date: string;
  endDate: string | null;
  title: string;
  description: string | null;
  type: string;
  assigneeId: string | null;
  processId: string | null;
  processNumber: string | null;
  clientName: string | null;
  status: string | null;
  priority: string | null;
  location: string | null;
  googleEventId: string | null;
}

export interface OperationalCalendarData {
  events: CalendarEventWithProcess[];
  tasks: CalendarTaskWithProcess[];
  hearings: CalendarHearing[];
  members: OperationalCalendarMember[];
  items: OperationalCalendarItem[];
  failures: OperationalCalendarFailure[];
}
