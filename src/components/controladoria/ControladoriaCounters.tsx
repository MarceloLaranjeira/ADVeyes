import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CircleUserRound,
  MailWarning,
} from "lucide-react";
import type { ControladoriaCounters as CounterValues } from "@/types/controladoria";

const definitions: Array<{
  key: keyof CounterValues;
  label: string;
  description: string;
  icon: typeof AlertTriangle;
  tone: string;
}> = [
  { key: "overdue", label: "Vencidos", description: "Exigem ação imediata", icon: AlertTriangle, tone: "text-destructive" },
  { key: "today", label: "Vencem hoje", description: "Prazo no dia atual", icon: CalendarClock, tone: "text-warning" },
  { key: "nextSevenDays", label: "Próximos 7 dias", description: "Antecipe as entregas", icon: CalendarDays, tone: "text-primary" },
  { key: "withoutAcknowledgement", label: "Sem ciência", description: "Intimações pendentes", icon: MailWarning, tone: "text-warning" },
  { key: "withoutAssignee", label: "Sem responsável", description: "Prazos não distribuídos", icon: CircleUserRound, tone: "text-muted-foreground" },
];

export function ControladoriaCounters({ counters, active, onSelect }: {
  counters: CounterValues;
  active: keyof CounterValues | null;
  onSelect: (counter: keyof CounterValues | null) => void;
}): JSX.Element {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores da Controladoria">
      {definitions.map(({ key, label, description, icon: Icon, tone }) => {
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : key)}
            className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary ring-1 ring-primary" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{counters[key]}</p>
              </div>
              <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{description}</p>
          </button>
        );
      })}
    </section>
  );
}
