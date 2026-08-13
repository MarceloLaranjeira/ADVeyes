import { CalendarClock, CheckSquare2, Gavel, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { OperationalCalendarItem } from "@/types/operational-calendar";
import { Badge } from "@/components/ui/badge";

const sourceMeta = {
  event: { label: "Compromisso", icon: CalendarClock, className: "border-l-blue-500" },
  task: { label: "Tarefa", icon: CheckSquare2, className: "border-l-amber-500" },
  hearing: { label: "Audiência", icon: Gavel, className: "border-l-red-500" },
};

export function CalendarItemCard({
  item,
  assigneeName,
  compact = false,
  onSelect,
}: {
  item: OperationalCalendarItem;
  assigneeName?: string;
  compact?: boolean;
  onSelect: (item: OperationalCalendarItem) => void;
}) {
  const meta = sourceMeta[item.sourceType];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full rounded-lg border border-l-4 bg-card p-2 text-left transition hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${meta.className}`}
      aria-label={`${meta.label}: ${item.title}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-semibold tabular-nums">{format(new Date(item.date), "HH:mm")}</span>
        <span className="truncate text-sm font-medium">{item.title}</span>
      </div>
      {!compact ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-normal">{meta.label}</Badge>
          {assigneeName ? <span>{assigneeName}</span> : <span className="text-amber-700">Sem responsável</span>}
          {item.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.location}</span> : null}
        </div>
      ) : null}
    </button>
  );
}

