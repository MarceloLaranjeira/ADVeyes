import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, ArrowRight, CalendarDays, Clock, RefreshCw } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOperationalCalendar } from "@/hooks/useOperationalCalendar";
import {
  buildAgendaUrl,
  calendarDayKey,
  groupOperationalItemsByDay,
  operationalItemTarget,
  operationalSourceLabel,
} from "@/lib/compact-calendar";
import type { OperationalCalendarSource } from "@/types/operational-calendar";

const sourceDotClass: Record<OperationalCalendarSource, string> = {
  event: "bg-blue-500",
  task: "bg-emerald-500",
  hearing: "bg-orange-500",
};

interface CompactWorkspaceCalendarProps {
  tenantId: string | null;
}

export function CompactWorkspaceCalendar({ tenantId }: CompactWorkspaceCalendarProps) {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(today);

  const range = useMemo(() => ({
    from: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 }),
    to: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 }),
  }), [visibleMonth]);

  const { items, isLoading, isError, refetch } = useOperationalCalendar(tenantId, range);
  const itemsByDay = useMemo(() => groupOperationalItemsByDay(items), [items]);
  const selectionIsVisible = Boolean(selectedDate && isSameMonth(selectedDate, visibleMonth));
  const selectedItems = selectionIsVisible && selectedDate
    ? itemsByDay[calendarDayKey(selectedDate)] ?? []
    : [];
  const agendaDate = selectionIsVisible && selectedDate ? selectedDate : visibleMonth;

  const handleMonthChange = (month: Date) => {
    setVisibleMonth(startOfMonth(month));
    if (selectedDate && !isSameMonth(selectedDate, month)) setSelectedDate(undefined);
  };

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          <h2 className="font-serif text-sm font-semibold">Calendário do escritório</h2>
        </div>

        {isError ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center">
            <AlertCircle className="mb-2 h-6 w-6 text-destructive" />
            <p className="text-sm font-medium">Não foi possível carregar o calendário</p>
            <Button variant="ghost" size="sm" className="mt-2 gap-1.5" onClick={() => void refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <div className={isLoading ? "min-h-[280px] animate-pulse opacity-55" : "min-h-[280px]"}>
              <Calendar
                mode="single"
                month={visibleMonth}
                onMonthChange={handleMonthChange}
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                className="mx-auto w-fit p-1"
                classNames={{
                  month: "space-y-3",
                  caption_label: "text-sm font-semibold capitalize",
                  day_selected: "bg-blue-950 text-white hover:bg-blue-900 hover:text-white focus:bg-blue-950 focus:text-white",
                  day_today: "ring-1 ring-blue-500 text-blue-700",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const sources = Array.from(new Set(
                      (itemsByDay[calendarDayKey(date)] ?? []).map(item => item.sourceType),
                    ));
                    return (
                      <span className="flex h-full w-full flex-col items-center justify-center leading-none">
                        <span>{format(date, "d")}</span>
                        <span className="mt-0.5 flex h-1 gap-0.5" aria-hidden="true">
                          {sources.slice(0, 3).map(source => (
                            <span key={source} className={`h-1 w-1 rounded-full ${sourceDotClass[source]}`} />
                          ))}
                        </span>
                        {sources.length > 0 && (
                          <span className="sr-only">
                            {sources.map(source => operationalSourceLabel[source]).join(", ")}
                          </span>
                        )}
                      </span>
                    );
                  },
                }}
              />
            </div>

            <div className="mt-2 border-t pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold capitalize">
                  {selectionIsVisible && selectedDate
                    ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : "Selecione um dia"}
                </p>
                {selectedItems.length > 3 && (
                  <button
                    type="button"
                    onClick={() => navigate(buildAgendaUrl(selectedDate!))}
                    className="text-[11px] font-medium text-blue-700 hover:underline"
                  >
                    Ver mais ({selectedItems.length - 3})
                  </button>
                )}
              </div>

              {!selectionIsVisible ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Escolha uma data para ver os compromissos</p>
              ) : selectedItems.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Nenhum compromisso neste dia</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedItems.slice(0, 3).map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => navigate(operationalItemTarget(item))}
                      className="flex w-full items-start gap-2 rounded-lg border p-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sourceDotClass[item.sourceType]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{item.title}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {item.sourceType === "task" ? "Sem horário" : format(new Date(item.date), "HH:mm")}
                          <span aria-hidden="true">•</span>
                          {operationalSourceLabel[item.sourceType]}
                        </span>
                        {item.processNumber && (
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">Processo {item.processNumber}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-8 w-full justify-between text-xs text-blue-700 hover:text-blue-800"
          onClick={() => navigate(buildAgendaUrl(agendaDate))}
        >
          Mostrar agenda completa <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
