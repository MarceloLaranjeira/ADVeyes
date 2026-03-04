import { AreaBadge } from "../common/AreaBadge";
import { Clock, User, AlertTriangle } from "lucide-react";

interface Processo {
  id: string;
  numero: string;
  cliente: string;
  area: string;
  status: string;
  prazo?: string;
  urgente?: boolean;
}

const processos: Processo[] = [
  { id: "1", numero: "0001234-56.2024.8.04.0001", cliente: "João Silva", area: "Penal", status: "Em andamento", prazo: "15/03/2026", urgente: true },
  { id: "2", numero: "0002345-67.2024.8.04.0001", cliente: "Maria Santos", area: "Família", status: "Aguardando audiência", prazo: "20/03/2026" },
  { id: "3", numero: "0003456-78.2024.8.04.0001", cliente: "Carlos Oliveira", area: "Cível", status: "Sentença proferida" },
  { id: "4", numero: "0004567-89.2024.8.04.0001", cliente: "Ana Costa", area: "Execução Penal", status: "Recurso interposto", prazo: "10/03/2026", urgente: true },
  { id: "5", numero: "0005678-90.2024.8.04.0001", cliente: "Pedro Lima", area: "Recurso", status: "Distribuído ao relator", prazo: "25/03/2026" },
  { id: "6", numero: "0006789-01.2024.8.04.0001", cliente: "Lucia Ferreira", area: "Penal", status: "Instrução processual", prazo: "18/03/2026" },
];

export const RecentProcesses = () => {
  return (
    <div className="bg-card rounded-lg border">
      <div className="p-5 border-b">
        <h3 className="font-serif text-lg font-semibold">Processos Recentes</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Últimos processos atualizados</p>
      </div>
      <div className="divide-y">
        {processos.map((p) => (
          <div key={p.id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-medium truncate">{p.numero}</p>
                  {p.urgente && <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{p.cliente}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <AreaBadge area={p.area} />
                <span className="text-[11px] text-muted-foreground">{p.status}</span>
                {p.prazo && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {p.prazo}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
