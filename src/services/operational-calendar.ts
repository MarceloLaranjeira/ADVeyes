import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type {
  CalendarEvent,
  CalendarHearing,
  CalendarTask,
  OperationalCalendarData,
  OperationalCalendarItem,
} from "@/types/operational-calendar";

function ensure(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function normalizeOperationalCalendar(
  events: CalendarEvent[],
  tasks: CalendarTask[],
  hearings: CalendarHearing[],
): OperationalCalendarItem[] {
  return [
    ...events.map(event => ({
      id: `event:${event.id}`,
      sourceType: "event" as const,
      sourceId: event.id,
      date: event.data_inicio,
      title: event.titulo,
      description: event.descricao,
      assigneeId: event.user_id,
      processId: null,
      processNumber: null,
      status: null,
      priority: null,
      location: event.local,
    })),
    ...tasks.map(task => ({
      id: `task:${task.id}`,
      sourceType: "task" as const,
      sourceId: task.id,
      date: task.data_limite ? `${task.data_limite}T12:00:00` : task.created_at,
      title: task.titulo,
      description: task.descricao,
      assigneeId: task.responsavel_id,
      processId: task.processo_id,
      processNumber: null,
      status: task.status,
      priority: task.prioridade,
      location: null,
    })),
    ...hearings.map(hearing => ({
      id: `hearing:${hearing.id}`,
      sourceType: "hearing" as const,
      sourceId: hearing.id,
      date: hearing.data_hora,
      title: hearing.tipo,
      description: hearing.observacoes,
      assigneeId: hearing.user_id,
      processId: hearing.processo_id,
      processNumber: hearing.processos?.numero ?? null,
      status: hearing.status,
      priority: null,
      location: hearing.local ?? hearing.vara,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date));
}

export async function loadOperationalCalendar(
  tenantId: string,
  now = new Date(),
  range?: { from: Date; to: Date },
): Promise<OperationalCalendarData> {
  let eventsQuery = supabase
    .from("eventos")
    .select("*")
    .eq("tenant_id", tenantId);
  let tasksQuery = supabase
    .from("tarefas")
    .select("*")
    .eq("tenant_id", tenantId)
    .neq("status", "concluída")
    .not("data_limite", "is", null);
  let hearingsQuery = supabase
    .from("audiencias")
    .select("*, processos(numero, cliente_nome)")
    .eq("tenant_id", tenantId);

  if (range) {
    const fromIso = range.from.toISOString();
    const toIso = range.to.toISOString();
    const fromDate = format(range.from, "yyyy-MM-dd");
    const toDate = format(range.to, "yyyy-MM-dd");
    eventsQuery = eventsQuery.gte("data_inicio", fromIso).lte("data_inicio", toIso);
    tasksQuery = tasksQuery.gte("data_limite", fromDate).lte("data_limite", toDate);
    hearingsQuery = hearingsQuery.gte("data_hora", fromIso).lte("data_hora", toIso);
  } else {
    hearingsQuery = hearingsQuery.gte("data_hora", now.toISOString()).limit(50);
  }

  const [eventsResult, tasksResult, hearingsResult] = await Promise.all([
    eventsQuery.order("data_inicio"),
    tasksQuery.order("data_limite"),
    hearingsQuery.order("data_hora"),
  ]);

  ensure(eventsResult.error);
  ensure(tasksResult.error);
  ensure(hearingsResult.error);

  const events = (eventsResult.data ?? []) as CalendarEvent[];
  const tasks = (tasksResult.data ?? []) as CalendarTask[];
  const hearings = (hearingsResult.data ?? []) as CalendarHearing[];
  const items = normalizeOperationalCalendar(events, tasks, hearings);

  return { events, tasks, hearings, items };
}
