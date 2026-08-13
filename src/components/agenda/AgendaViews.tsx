import { addDays, eachDayOfInterval, format, isSameDay, isSameMonth, isToday, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarX2 } from "lucide-react";
import { CalendarItemCard } from "@/components/agenda/CalendarItemCard";
import { Button } from "@/components/ui/button";
import { calendarItemsForDay } from "@/lib/agenda-calendar";
import type { OperationalCalendarItem, OperationalCalendarMember, OperationalCalendarView } from "@/types/operational-calendar";

const hours = Array.from({ length: 13 }, (_, index) => index + 7);

function memberName(members: OperationalCalendarMember[], userId: string | null) {
  return members.find(member => member.userId === userId)?.name;
}

function EmptyAgenda({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-card p-8 text-center">
      <div><CalendarX2 className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-3 font-semibold">Nenhum item neste período</h3><p className="mt-1 text-sm text-muted-foreground">Crie um compromisso ou ajuste os filtros.</p><Button className="mt-4" onClick={onNew}>Criar compromisso</Button></div>
    </div>
  );
}

export function AgendaViews({
  view,
  date,
  range,
  items,
  members,
  onSelect,
  onNewAt,
}: {
  view: OperationalCalendarView;
  date: Date;
  range: { from: Date; to: Date };
  items: OperationalCalendarItem[];
  members: OperationalCalendarMember[];
  onSelect: (item: OperationalCalendarItem) => void;
  onNewAt: (date: Date) => void;
}) {
  if (items.length === 0) return <EmptyAgenda onNew={() => onNewAt(date)} />;

  if (view === "list") {
    const groups = items.reduce<Record<string, OperationalCalendarItem[]>>((result, item) => {
      const key = format(new Date(item.date), "yyyy-MM-dd");
      (result[key] ??= []).push(item);
      return result;
    }, {});
    return <div className="space-y-4">{Object.entries(groups).map(([key, dayItems]) => <section key={key} className="rounded-2xl border bg-card p-4"><h3 className="mb-3 capitalize font-semibold">{format(new Date(`${key}T12:00:00`), "EEEE, dd 'de' MMMM", { locale: ptBR })}</h3><div className="space-y-2">{dayItems.map(item => <CalendarItemCard key={item.id} item={item} assigneeName={memberName(members, item.assigneeId)} onSelect={onSelect} />)}</div></section>)}</div>;
  }

  if (view === "month") {
    const days = eachDayOfInterval({ start: range.from, end: range.to });
    return (
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/30">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(label => <div key={label} className="p-2 text-center text-xs font-medium text-muted-foreground">{label}</div>)}</div>
        <div className="grid grid-cols-7">{days.map(day => { const dayItems = calendarItemsForDay(items, day); return <div key={day.toISOString()} className={`min-h-28 border-b border-r p-1.5 ${!isSameMonth(day, date) ? "bg-muted/20 text-muted-foreground" : ""}`}><button type="button" onClick={() => onNewAt(day)} className={`mb-1 grid h-7 w-7 place-items-center rounded-full text-xs font-semibold hover:bg-accent ${isToday(day) ? "bg-primary text-primary-foreground" : ""}`} aria-label={`Criar compromisso em ${format(day, "dd/MM")}`}>{format(day, "d")}</button><div className="space-y-1">{dayItems.slice(0, 3).map(item => <CalendarItemCard key={item.id} item={item} compact onSelect={onSelect} />)}{dayItems.length > 3 ? <p className="px-1 text-xs text-muted-foreground">+{dayItems.length - 3} itens</p> : null}</div></div>; })}</div>
      </div>
    );
  }

  const days = view === "week" ? Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date, { weekStartsOn: 1 }), index)) : [date];
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(160px, 1fr))` }}>
        <div className="border-b p-2" />{days.map(day => <button type="button" key={day.toISOString()} onClick={() => onNewAt(day)} className={`border-b border-l p-3 text-center hover:bg-accent ${isToday(day) ? "bg-primary/5" : ""}`}><span className="block text-xs capitalize text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</span><span className="text-lg font-bold">{format(day, "dd")}</span></button>)}
        {hours.flatMap(hour => [<div key={`hour-${hour}`} className="border-b p-2 text-right text-xs text-muted-foreground">{String(hour).padStart(2, "0")}:00</div>, ...days.map(day => { const slot = new Date(day); slot.setHours(hour, 0, 0, 0); const slotItems = items.filter(item => isSameDay(new Date(item.date), day) && new Date(item.date).getHours() === hour); return <div key={`${day.toISOString()}-${hour}`} className="min-h-16 space-y-1 border-b border-l p-1">{slotItems.length ? slotItems.map(item => <CalendarItemCard key={item.id} item={item} compact onSelect={onSelect} />) : <button type="button" className="h-full min-h-12 w-full rounded text-left text-transparent hover:bg-accent hover:text-muted-foreground focus-visible:text-muted-foreground" aria-label={`Criar compromisso às ${hour}:00`} onClick={() => onNewAt(slot)}>Adicionar</button>}</div>; })])}
      </div>
    </div>
  );
}
