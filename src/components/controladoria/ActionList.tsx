import type React from "react";
import { ArrowUpRight, CalendarClock, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { classifyDeadline, formatDeadlineDate } from "@/lib/controladoria";
import type { ActionItem } from "@/types/controladoria";

const urgencyClasses = {
  vencido: "border-destructive/30 bg-destructive/5 text-destructive",
  hoje: "border-warning/30 bg-warning/5 text-warning-foreground",
  amanha: "border-primary/30 bg-primary/5 text-primary",
  proximo: "border-border bg-muted/30 text-foreground",
  sem_prazo: "border-border bg-muted/30 text-muted-foreground",
} as const;

export function ActionList({ items, now, onOpenItem, children }: {
  items: ActionItem[];
  now: Date;
  onOpenItem: (item: ActionItem) => void;
  children?: (item: ActionItem) => React.ReactNode;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="font-serif text-lg">Camada de ação</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">O que precisa de decisão, pela ordem de urgência</p>
          </div>
          <Badge variant="secondary">{items.length} {items.length === 1 ? "item" : "itens"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center">
            <CalendarClock className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nada exige ação agora</p>
            <p className="mt-1 text-xs text-muted-foreground">Os novos prazos e intimações aparecerão aqui.</p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map(item => {
              const deadline = classifyDeadline(item.dueDate, now);
              const activate = () => onOpenItem(item);
              return (
                <article
                  key={`${item.kind}:${item.id}`}
                  role="link"
                  tabIndex={0}
                  aria-label={`Abrir ${item.kind === "prazo" ? "prazo" : "intimação"}: ${item.title}`}
                  onClick={event => {
                    if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea")) return;
                    activate();
                  }}
                  onKeyDown={event => {
                    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    activate();
                  }}
                  className="grid cursor-pointer gap-3 rounded-lg px-2 py-3 transition-colors first:pt-2 last:pb-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.kind === "prazo" ? "Prazo" : "Intimação"}</Badge>
                      {item.kind === "intimacao" ? <Badge variant="outline">Sem ciência</Badge> : <Badge variant="outline" className={urgencyClasses[deadline.urgency]}>{deadline.label}</Badge>}
                    </div>
                    <h3 className="mt-2 truncate text-sm font-semibold">{item.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.processNumber && <span>Processo {item.processNumber}</span>}
                      {item.clientName && <span>{item.clientName}</span>}
                      <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{item.assigneeName ?? "Sem responsável"}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
                      {item.kind === "prazo" ? <span className={deadline.urgency === "vencido" ? "text-destructive" : "text-foreground"}>Vencimento: {formatDeadlineDate(item.dueDate)} · {deadline.label}</span> : <>{item.publishedAt ? <span className="text-muted-foreground">Publicada em {formatDeadlineDate(item.publishedAt)}</span> : null}{item.dueDate ? <span className={deadline.urgency === "vencido" ? "text-destructive" : "text-foreground"}>Prazo final: {formatDeadlineDate(item.dueDate)} · {deadline.label}</span> : null}</>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {children?.(item)}
                    <Button variant="ghost" size="sm" className="gap-1" onClick={activate}>Abrir origem <ArrowUpRight className="h-3.5 w-3.5" /></Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
