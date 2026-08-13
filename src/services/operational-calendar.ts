import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type {
  CalendarEventWithProcess,
  CalendarHearing,
  CalendarTaskWithProcess,
  OperationalCalendarData,
  OperationalCalendarFailure,
  OperationalCalendarMember,
  OperationalCalendarItem,
  OperationalCalendarScope,
} from "@/types/operational-calendar";

export interface LoadOperationalCalendarOptions {
  tenantId: string;
  userId?: string | null;
  scope?: OperationalCalendarScope;
  range?: { from: Date; to: Date };
  now?: Date;
}

export function normalizeOperationalCalendar(
  events: CalendarEventWithProcess[],
  tasks: CalendarTaskWithProcess[],
  hearings: CalendarHearing[],
): OperationalCalendarItem[] {
  return [
    ...events.map(event => ({
      id: `event:${event.id}`,
      sourceType: "event" as const,
      sourceId: event.id,
      date: event.data_inicio,
      endDate: event.data_fim,
      title: event.titulo,
      description: event.descricao,
      type: event.tipo,
      assigneeId: event.user_id,
      processId: event.processo_id,
      processNumber: event.processos?.numero ?? null,
      clientName: event.processos?.cliente_nome ?? null,
      status: null,
      priority: null,
      location: event.local,
      googleEventId: event.google_event_id,
    })),
    ...tasks.map(task => ({
      id: `task:${task.id}`,
      sourceType: "task" as const,
      sourceId: task.id,
      date: task.data_limite ? `${task.data_limite}T12:00:00` : task.created_at,
      endDate: null,
      title: task.titulo,
      description: task.descricao,
      type: task.categoria ?? "tarefa",
      assigneeId: task.responsavel_id,
      processId: task.processo_id,
      processNumber: task.processos?.numero ?? null,
      clientName: task.processos?.cliente_nome ?? null,
      status: task.status,
      priority: task.prioridade,
      location: null,
      googleEventId: task.google_event_id,
    })),
    ...hearings.map(hearing => ({
      id: `hearing:${hearing.id}`,
      sourceType: "hearing" as const,
      sourceId: hearing.id,
      date: hearing.data_hora,
      endDate: null,
      title: hearing.tipo,
      description: hearing.observacoes,
      type: hearing.tipo,
      assigneeId: hearing.user_id,
      processId: hearing.processo_id,
      processNumber: hearing.processos?.numero ?? null,
      clientName: hearing.processos?.cliente_nome ?? hearing.cliente_nome,
      status: hearing.status,
      priority: null,
      location: hearing.local ?? hearing.vara,
      googleEventId: hearing.google_event_id,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date));
}

export async function loadOperationalCalendar({
  tenantId,
  userId,
  scope = "office",
  range,
  now = new Date(),
}: LoadOperationalCalendarOptions): Promise<OperationalCalendarData> {
  let eventsQuery = supabase
    .from("eventos")
    .select("*, processos(numero, cliente_nome)")
    .eq("tenant_id", tenantId);
  let tasksQuery = supabase
    .from("tarefas")
    .select("*, processos(numero, cliente_nome)")
    .eq("tenant_id", tenantId)
    .neq("status", "concluída")
    .not("data_limite", "is", null);
  let hearingsQuery = supabase
    .from("audiencias")
    .select("*, processos(numero, cliente_nome)")
    .eq("tenant_id", tenantId);
  const membersQuery = supabase
    .from("equipe")
    .select("id, user_id, nome, avatar_url, cargo")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .order("nome");

  if (scope === "mine" && userId) {
    eventsQuery = eventsQuery.eq("user_id", userId);
    tasksQuery = tasksQuery.eq("responsavel_id", userId);
    hearingsQuery = hearingsQuery.eq("user_id", userId);
  }

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

  const [eventsResult, tasksResult, hearingsResult, membersResult] = await Promise.all([
    eventsQuery.order("data_inicio"),
    tasksQuery.order("data_limite"),
    hearingsQuery.order("data_hora"),
    membersQuery,
  ]);

  const failures: OperationalCalendarFailure[] = [];
  if (eventsResult.error) failures.push({ source: "event", message: eventsResult.error.message });
  if (tasksResult.error) failures.push({ source: "task", message: tasksResult.error.message });
  if (hearingsResult.error) failures.push({ source: "hearing", message: hearingsResult.error.message });
  if (membersResult.error) failures.push({ source: "members", message: membersResult.error.message });

  const events = (eventsResult.data ?? []) as CalendarEventWithProcess[];
  const tasks = (tasksResult.data ?? []) as CalendarTaskWithProcess[];
  const hearings = (hearingsResult.data ?? []) as CalendarHearing[];
  const members = (membersResult.data ?? []).map(member => ({
    id: member.id,
    userId: member.user_id,
    name: member.nome,
    avatarUrl: member.avatar_url,
    role: member.cargo,
  })) as OperationalCalendarMember[];
  const items = normalizeOperationalCalendar(events, tasks, hearings);

  if (failures.filter(failure => failure.source !== "members").length === 3) {
    throw new Error("Não foi possível carregar a Agenda.");
  }

  return { events, tasks, hearings, members, items, failures };
}
