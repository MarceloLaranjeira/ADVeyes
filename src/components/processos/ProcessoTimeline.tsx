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
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  publication: {
    label: "Publicação",
    icon: BellRing,
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  manual: {
    label: "Registro manual",
    icon: NotebookPen,
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
      <div className="overflow-hidden rounded-2xl border bg-card">
        {visible.map((event) => {
          const config = appearance[event.kind];
          const Icon = config.icon;
          const date = eventDate(event.occurredAt);
          const isOpen = expanded.has(event.id);
          const contentDiffers = event.content !== event.summary;
          return (
            <article
              key={event.id}
              className="grid gap-3 border-b p-4 last:border-b-0 hover:bg-muted/20 md:grid-cols-[145px_minmax(0,1fr)] md:p-5"
            >
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground/70">{date.date}</p>
                {date.time && <p className="mt-1">{date.time}</p>}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={config.badge}>
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {config.label}
                </Badge>
                {event.possibleDeadline && (
                  <Badge variant="destructive">Revisar prazo</Badge>
                )}
              </div>
              <h3 className="mt-2 text-sm font-semibold text-foreground sm:text-base">{event.title}</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {isOpen ? event.content : event.summary}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
              </div>
            </article>
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
