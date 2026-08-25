import { CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UpcomingHearing } from "@/types/controladoria";

export function UpcomingBlock({ hearings }: { hearings: UpcomingHearing[] }): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg">Próximos compromissos</CardTitle>
        <p className="text-xs text-muted-foreground">Audiências previstas para os próximos sete dias</p>
      </CardHeader>
      <CardContent>
        {hearings.length === 0 ? (
          <div className="rounded-xl border border-dashed py-8 text-center">
            <CalendarDays className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma audiência próxima</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hearings.map(hearing => (
              <div key={hearing.id} className="rounded-xl border p-3">
                <p className="text-sm font-semibold">{hearing.tipo}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(hearing.dataHora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  {hearing.processNumber ? ` · ${hearing.processNumber}` : ""}
                </p>
                {hearing.local && <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{hearing.local}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
