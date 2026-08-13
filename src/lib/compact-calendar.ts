import { format, isValid, parseISO } from "date-fns";
import type {
  OperationalCalendarItem,
  OperationalCalendarSource,
} from "@/types/operational-calendar";

export function calendarDayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function operationalItemDayKey(item: OperationalCalendarItem): string {
  return calendarDayKey(new Date(item.date));
}

export function groupOperationalItemsByDay(
  items: OperationalCalendarItem[],
): Record<string, OperationalCalendarItem[]> {
  return items.reduce<Record<string, OperationalCalendarItem[]>>((groups, item) => {
    const key = operationalItemDayKey(item);
    (groups[key] ??= []).push(item);
    groups[key].sort((left, right) => left.date.localeCompare(right.date));
    return groups;
  }, {});
}

export function parseAgendaDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = parseISO(value);
  if (!isValid(date) || calendarDayKey(date) !== value) return null;

  return date;
}

export function buildAgendaUrl(date: Date): string {
  return `/agenda?date=${calendarDayKey(date)}`;
}

export function operationalItemTarget(item: OperationalCalendarItem): string {
  if (item.sourceType === "task") return "/tarefas";
  if (item.sourceType === "hearing") {
    return item.processId ? `/processos/${item.processId}` : "/audiencias";
  }
  return buildAgendaUrl(new Date(item.date));
}

export const operationalSourceLabel: Record<OperationalCalendarSource, string> = {
  event: "Compromisso",
  task: "Tarefa",
  hearing: "Audiência",
};
