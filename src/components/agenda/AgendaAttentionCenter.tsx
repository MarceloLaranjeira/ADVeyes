import { AlertTriangle, CalendarSync, Clock3, UserRoundX } from "lucide-react";
import type { CalendarConflict } from "@/lib/agenda-calendar";
import { isCalendarItemUrgent } from "@/lib/agenda-calendar";
import type { OperationalCalendarItem } from "@/types/operational-calendar";

export function AgendaAttentionCenter({ items, conflicts }: { items: OperationalCalendarItem[]; conflicts: CalendarConflict[] }) {
  const urgent = items.filter(item => item.sourceType === "task" && isCalendarItemUrgent(item)).length;
  const unassignedHearings = items.filter(item => item.sourceType === "hearing" && !item.assigneeId).length;
  const pendingSync = items.filter(item => item.sourceType !== "task" && !item.googleEventId).length;
  const stats = [
    { label: "Conflitos", value: conflicts.length, icon: AlertTriangle, tone: "text-red-600 bg-red-50" },
    { label: "Prazos críticos", value: urgent, icon: Clock3, tone: "text-amber-700 bg-amber-50" },
    { label: "Audiências sem responsável", value: unassignedHearings, icon: UserRoundX, tone: "text-orange-700 bg-orange-50" },
    { label: "Sem vínculo Google", value: pendingSync, icon: CalendarSync, tone: "text-blue-700 bg-blue-50" },
  ];
  return <section aria-label="Centro de atenção" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon, tone }) => <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"><div className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div><div><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></div>)}</section>;
}

