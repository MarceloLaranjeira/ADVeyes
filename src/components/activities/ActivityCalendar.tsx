import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ActivityWithUserState } from "@/types/activities";

export function ActivityCalendar({ activities, date = new Date(), onOpen }: { activities: ActivityWithUserState[]; date?: Date; onOpen: (activity: ActivityWithUserState) => void }) {
  const from = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const to = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: from, end: to });
  return <div className="overflow-hidden rounded-2xl border bg-card"><div className="border-b p-4"><h2 className="font-semibold capitalize">{format(date, "MMMM 'de' yyyy", { locale: ptBR })}</h2></div><div className="grid grid-cols-7 bg-muted/30 text-center text-xs text-muted-foreground">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => <div key={day} className="p-2">{day}</div>)}</div><div className="grid grid-cols-7">{days.map(day => { const key = format(day, "yyyy-MM-dd"); const dayItems = activities.filter(activity => activity.data_limite === key); return <div key={key} className={`min-h-28 border-r border-t p-1.5 ${isSameMonth(day, date) ? "" : "bg-muted/20 text-muted-foreground"}`}><span className="text-xs font-semibold">{format(day, "d")}</span><div className="mt-1 space-y-1">{dayItems.slice(0, 4).map(activity => <button key={activity.id} type="button" onClick={() => onOpen(activity)} className="block w-full truncate rounded border-l-4 border-l-primary bg-primary/5 px-1.5 py-1 text-left text-xs hover:bg-primary/10">{activity.titulo}</button>)}{dayItems.length > 4 ? <span className="text-xs text-muted-foreground">+{dayItems.length - 4}</span> : null}</div></div>; })}</div></div>;
}

