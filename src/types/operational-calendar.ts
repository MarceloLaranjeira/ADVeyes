import type { Database } from "@/integrations/supabase/types";

export type CalendarEvent = Database["public"]["Tables"]["eventos"]["Row"];
export type CalendarTask = Database["public"]["Tables"]["tarefas"]["Row"];
type Hearing = Database["public"]["Tables"]["audiencias"]["Row"];

export interface CalendarHearing extends Hearing {
  processos: { numero: string; cliente_nome: string | null } | null;
}

export type OperationalCalendarSource = "event" | "task" | "hearing";

export interface OperationalCalendarItem {
  id: string;
  sourceType: OperationalCalendarSource;
  sourceId: string;
  date: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  processId: string | null;
  processNumber: string | null;
  status: string | null;
  priority: string | null;
  location: string | null;
}

export interface OperationalCalendarData {
  events: CalendarEvent[];
  tasks: CalendarTask[];
  hearings: CalendarHearing[];
  items: OperationalCalendarItem[];
}
