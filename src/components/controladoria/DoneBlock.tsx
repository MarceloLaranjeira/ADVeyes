import { CheckCircle2, FileCheck2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DoneSummary } from "@/types/controladoria";

export function DoneBlock({ done, periodDays }: { done: DoneSummary; periodDays: number }): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg">Feito no período</CardTitle>
        <p className="text-xs text-muted-foreground">Últimos {periodDays} dias</p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-muted/20 p-3">
          <FileCheck2 className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-bold tabular-nums">{done.protocols}</p>
          <p className="text-xs text-muted-foreground">Protocolos</p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="mt-2 text-2xl font-bold tabular-nums">{done.completedDeadlines}</p>
          <p className="text-xs text-muted-foreground">Prazos concluídos</p>
        </div>
      </CardContent>
    </Card>
  );
}
