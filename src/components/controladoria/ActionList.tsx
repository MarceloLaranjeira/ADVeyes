import type React from "react";
import { ArrowUpRight, CalendarClock, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { classifyDeadline } from "@/lib/controladoria";
import type { ActionItem } from "@/types/controladoria";

const urgencyClasses = {
  vencido: "border-destructive/30 bg-destructive/5 text-destructive",
  hoje: "border-warning/30 bg-warning/5 text-warning-foreground",
  amanha: "border-primary/30 bg-primary/5 text-primary",
  proximo: "border-border bg-muted/30 text-foreground",
  sem_prazo: "border-border bg-muted/30 text-muted-foreground",
} as const;

export function ActionList({ items, now, onOpenProcess, children }: {
  items: ActionItem[];
  now: Date;
  onOpenProcess: (processNumber: string | null) => void;
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
              return (
                <article key={`${item.kind}:${item.id}`} className="grid gap-3 py-3 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.kind === "prazo" ? "Prazo" : "Intimação"}</Badge>
                      <Badge variant="outline" className={urgencyClasses[deadline.urgency]}>
                        {item.kind === "intimacao" ? "sem ciência" : deadline.label}
                      </Badge>
                    </div>
                    <h3 className="mt-2 truncate text-sm font-semibold">{item.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.processNumber && <span>Processo {item.processNumber}</span>}
                      {item.clientName && <span>{item.clientName}</span>}
                      <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{item.assigneeName ?? "Sem responsável"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {children?.(item)}
                    {item.processNumber && (
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => onOpenProcess(item.processNumber)}>
                        Abrir processo <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
