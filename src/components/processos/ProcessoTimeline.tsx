import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BellRing,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  NotebookPen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  isSafeExternalUrl,
  type ProcessTimelineEvent,
} from "@/lib/process-timeline";

interface ProcessoTimelineProps {
  events: ProcessTimelineEvent[];
  previewLimit?: number;
  emptyMessage?: string;
}

const appearance = {
  movement: {
    label: "Andamento",
    icon: Gavel,
    dot: "bg-emerald-500 ring-emerald-100",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  publication: {
    label: "Publicação",
    icon: BellRing,
    dot: "bg-amber-500 ring-amber-100",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  manual: {
    label: "Registro manual",
    icon: NotebookPen,
    dot: "bg-violet-500 ring-violet-100",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

function eventDate(value: string | null) {
  if (!value) return { date: "Data não informada", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "Data não informada", time: "" };
  return {
    date: format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    time: format(parsed, "HH:mm", { locale: ptBR }),
  };
}

export function ProcessoTimeline({
  events,
  previewLimit,
  emptyMessage = "Nenhuma movimentação registrada neste processo.",
}: ProcessoTimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(!previewLimit);
  const visible = showAll || !previewLimit ? events : events.slice(0, previewLimit);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="relative space-y-6 py-2 md:space-y-8 md:py-4">
        <div className="absolute bottom-4 left-[19px] top-4 w-px bg-gradient-to-b from-primary/20 via-primary/70 to-primary/10 md:left-1/2" />

        {visible.map((event, index) => {
          const config = appearance[event.kind];
          const Icon = config.icon;
          const date = eventDate(event.occurredAt);
          const isOpen = expanded.has(event.id);
          const contentDiffers = event.content !== event.summary;
          const card = (
            <article className="rounded-2xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={config.badge}>
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {config.label}
                </Badge>
                {event.possibleDeadline && (
                  <Badge variant="destructive">Revisar prazo</Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground md:hidden">
                  {date.date}{date.time ? ` · ${date.time}` : ""}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">{event.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {isOpen ? event.content : event.summary}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
                <span>{event.sourceName || event.provider}</span>
                {event.tribunal && <span>· {event.tribunal}</span>}
                {isSafeExternalUrl(event.sourceUrl) && (
                  <a
                    href={event.sourceUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Ver fonte <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {contentDiffers && (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggle(event.id)}
                    className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {isOpen ? "Recolher" : "Ver íntegra"}
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </article>
          );

          const dateBlock = (
            <div className="hidden px-6 text-sm text-muted-foreground md:block">
              <p className="font-medium text-foreground/70">{date.date}</p>
              {date.time && <p className="mt-1 text-xs">{date.time}</p>}
            </div>
          );

          return (
            <div key={event.id} className="relative grid grid-cols-[40px_minmax(0,1fr)] items-center md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)]">
              <div className={`absolute left-[13px] top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-background ring-4 md:left-1/2 md:-translate-x-1/2 ${config.dot}`} />

              <div className="col-start-2 md:col-start-1">
                {index % 2 === 0 ? card : dateBlock}
              </div>
              <div className="hidden md:block" />
              <div className="hidden md:col-start-3 md:block">
                {index % 2 === 0 ? dateBlock : card}
              </div>
            </div>
          );
        })}
      </div>

      {previewLimit && events.length > previewLimit && (
        <div className="mt-5 text-center">
          <Button variant="outline" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Mostrar menos" : `Ver todos os ${events.length} eventos`}
          </Button>
        </div>
      )}
    </div>
  );
}
