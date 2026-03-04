import { CalendarDays, Clock } from "lucide-react";

interface Prazo {
  id: string;
  descricao: string;
  processo: string;
  data: string;
  tipo: "audiência" | "prazo" | "diligência";
  diasRestantes: number;
}

const prazos: Prazo[] = [
  { id: "1", descricao: "Alegações finais - João Silva", processo: "0001234-56.2024", data: "06/03/2026", tipo: "prazo", diasRestantes: 2 },
  { id: "2", descricao: "Audiência de instrução - Maria Santos", processo: "0002345-67.2024", data: "08/03/2026", tipo: "audiência", diasRestantes: 4 },
  { id: "3", descricao: "Juntada de documentos - Carlos Oliveira", processo: "0003456-78.2024", data: "10/03/2026", tipo: "diligência", diasRestantes: 6 },
  { id: "4", descricao: "Recurso especial - Ana Costa", processo: "0004567-89.2024", data: "10/03/2026", tipo: "prazo", diasRestantes: 6 },
  { id: "5", descricao: "Audiência de custódia - Pedro Lima", processo: "0005678-90.2024", data: "12/03/2026", tipo: "audiência", diasRestantes: 8 },
];

export const UpcomingDeadlines = () => {
  return (
    <div className="bg-card rounded-lg border">
      <div className="p-5 border-b">
        <h3 className="font-serif text-lg font-semibold">Próximos Prazos</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Prazos e audiências da semana</p>
      </div>
      <div className="divide-y">
        {prazos.map((p) => (
          <div key={p.id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  p.diasRestantes <= 3 ? "bg-destructive/10" : "bg-primary/5"
                }`}>
                  {p.tipo === "audiência" ? (
                    <CalendarDays className={`w-4 h-4 ${p.diasRestantes <= 3 ? "text-destructive" : "text-primary"}`} />
                  ) : (
                    <Clock className={`w-4 h-4 ${p.diasRestantes <= 3 ? "text-destructive" : "text-primary"}`} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{p.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{p.processo}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium">{p.data}</p>
                <p className={`text-[11px] mt-0.5 font-medium ${
                  p.diasRestantes <= 3 ? "text-destructive" : "text-muted-foreground"
                }`}>
                  {p.diasRestantes === 0 ? "Hoje" : `${p.diasRestantes} dias`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
