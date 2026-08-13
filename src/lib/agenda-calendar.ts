import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type {
  OperationalCalendarFilters,
  OperationalCalendarItem,
  OperationalCalendarScope,
  OperationalCalendarView,
} from "@/types/operational-calendar";
import { parseAgendaDate } from "@/lib/compact-calendar";

export interface AgendaRouteState {
  date: Date;
  view: OperationalCalendarView;
  scope: OperationalCalendarScope;
  filters: OperationalCalendarFilters;
}

const views = new Set<OperationalCalendarView>(["month", "week", "day", "list"]);
const scopes = new Set<OperationalCalendarScope>(["mine", "office"]);

export function parseAgendaRoute(
  params: URLSearchParams,
  defaultScope: OperationalCalendarScope,
  now = new Date(),
): AgendaRouteState {
  const rawView = params.get("view") as OperationalCalendarView | null;
  const rawScope = params.get("scope") as OperationalCalendarScope | null;
  const source = params.get("source");

  return {
    date: parseAgendaDate(params.get("date")) ?? now,
    view: rawView && views.has(rawView) ? rawView : "month",
    scope: rawScope && scopes.has(rawScope) ? rawScope : defaultScope,
    filters: {
      assigneeId: params.get("assignee"),
      sourceType: source === "event" || source === "task" || source === "hearing" ? source : "all",
      itemType: params.get("type"),
      status: params.get("status"),
      processId: params.get("process"),
      clientName: params.get("client"),
      query: params.get("q"),
    },
  };
}

export function agendaRouteParams(state: AgendaRouteState): URLSearchParams {
  const params = new URLSearchParams({
    date: format(state.date, "yyyy-MM-dd"),
    view: state.view,
    scope: state.scope,
  });
  if (state.filters.assigneeId) params.set("assignee", state.filters.assigneeId);
  if (state.filters.sourceType && state.filters.sourceType !== "all") params.set("source", state.filters.sourceType);
  if (state.filters.itemType) params.set("type", state.filters.itemType);
  if (state.filters.status) params.set("status", state.filters.status);
  if (state.filters.processId) params.set("process", state.filters.processId);
  if (state.filters.clientName) params.set("client", state.filters.clientName);
  if (state.filters.query?.trim()) params.set("q", state.filters.query.trim());
  return params;
}

export function agendaVisibleRange(date: Date, view: OperationalCalendarView) {
  if (view === "month") {
    return {
      from: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
      to: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
    };
  }
  if (view === "week") {
    return {
      from: startOfWeek(date, { weekStartsOn: 1 }),
      to: endOfWeek(date, { weekStartsOn: 1 }),
    };
  }
  if (view === "day") return { from: startOfDay(date), to: endOfDay(date) };
  return { from: startOfDay(date), to: endOfDay(addDays(date, 30)) };
}

export function filterOperationalCalendar(
  items: OperationalCalendarItem[],
  filters: OperationalCalendarFilters,
): OperationalCalendarItem[] {
  const query = filters.query?.trim().toLocaleLowerCase("pt-BR");
  return items.filter(item => {
    if (filters.assigneeId === "unassigned" && item.assigneeId) return false;
    if (filters.assigneeId && filters.assigneeId !== "unassigned" && item.assigneeId !== filters.assigneeId) return false;
    if (filters.sourceType && filters.sourceType !== "all" && item.sourceType !== filters.sourceType) return false;
    if (filters.itemType && item.type !== filters.itemType) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.processId && item.processId !== filters.processId) return false;
    if (filters.clientName && item.clientName !== filters.clientName) return false;
    if (!query) return true;
    return [item.title, item.description, item.processNumber, item.clientName, item.location]
      .some(value => value?.toLocaleLowerCase("pt-BR").includes(query));
  });
}

export function calendarItemsForDay(items: OperationalCalendarItem[], date: Date) {
  const range = { start: startOfDay(date), end: endOfDay(date) };
  return items.filter(item => isWithinInterval(new Date(item.date), range));
}

export interface CalendarConflict {
  id: string;
  assigneeId: string;
  items: [OperationalCalendarItem, OperationalCalendarItem];
}

export function findCalendarConflicts(items: OperationalCalendarItem[]): CalendarConflict[] {
  const timed = items
    .filter(item => item.assigneeId && item.sourceType !== "task")
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));
  const conflicts: CalendarConflict[] = [];

  for (let index = 0; index < timed.length; index += 1) {
    const left = timed[index];
    const leftStart = new Date(left.date).getTime();
    const leftEnd = left.endDate ? new Date(left.endDate).getTime() : leftStart + 60 * 60 * 1000;
    for (let nextIndex = index + 1; nextIndex < timed.length; nextIndex += 1) {
      const right = timed[nextIndex];
      if (right.assigneeId !== left.assigneeId) continue;
      const rightStart = new Date(right.date).getTime();
      if (rightStart >= leftEnd) break;
      const rightEnd = right.endDate ? new Date(right.endDate).getTime() : rightStart + 60 * 60 * 1000;
      if (leftStart < rightEnd && rightStart < leftEnd) {
        conflicts.push({ id: `${left.id}:${right.id}`, assigneeId: left.assigneeId!, items: [left, right] });
      }
    }
  }
  return conflicts;
}

export function isCalendarItemUrgent(item: OperationalCalendarItem, now = new Date()) {
  if (item.status === "concluída" || item.status === "cancelada") return false;
  const due = new Date(item.date).getTime();
  const remaining = due - startOfDay(now).getTime();
  return remaining <= 3 * 24 * 60 * 60 * 1000;
}
