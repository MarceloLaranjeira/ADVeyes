import { supabase } from "@/integrations/supabase/client";
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
      assigneeId: hearing.responsavel_id,
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
): Promise<OperationalCalendarData> {
  const [eventsResult, tasksResult, hearingsResult] = await Promise.all([
    supabase
      .from("eventos")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("data_inicio"),
    supabase
      .from("tarefas")
      .select("*")
      .eq("tenant_id", tenantId)
      .neq("status", "concluída")
      .not("data_limite", "is", null)
      .order("data_limite"),
    supabase
      .from("audiencias")
      .select("*, processos(numero, cliente_nome)")
      .eq("tenant_id", tenantId)
      .gte("data_hora", now.toISOString())
      .order("data_hora")
      .limit(50),
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
