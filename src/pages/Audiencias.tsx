import { AppLayout } from "@/components/layout/AppLayout";
import { Gavel, MapPin, Clock, User } from "lucide-react";

const audiencias = [
  { id: "1", data: "04/03/2026", hora: "09:00", tipo: "Instrução e Julgamento", processo: "0001234-56.2024", cliente: "João Silva", vara: "1ª Vara Criminal", juiz: "Dr. Marcos Souza", status: "Confirmada" },
  { id: "2", data: "06/03/2026", hora: "08:30", tipo: "Custódia", processo: "0007890-12.2024", cliente: "Roberto Souza", vara: "Fórum Henoch Reis", juiz: "Dra. Ana Lúcia", status: "Confirmada" },
  { id: "3", data: "08/03/2026", hora: "14:00", tipo: "Conciliação", processo: "0002345-67.2024", cliente: "Maria Santos", vara: "2ª Vara de Família", juiz: "Dr. Paulo Ribeiro", status: "Agendada" },
  { id: "4", data: "10/03/2026", hora: "10:00", tipo: "Júri Popular", processo: "0007890-12.2024", cliente: "Roberto Souza", vara: "Tribunal do Júri", juiz: "Dr. Fernando Costa", status: "Agendada" },
  { id: "5", data: "12/03/2026", hora: "15:00", tipo: "Sustentação Oral", processo: "0005678-90.2024", cliente: "Pedro Lima", vara: "2ª Câmara Criminal - TJAM", juiz: "Des. Ricardo Mendes", status: "Agendada" },
];

const statusColors: Record<string, string> = {
  Confirmada: "bg-success/10 text-success",
  Agendada: "bg-info/10 text-info",
  Adiada: "bg-warning/10 text-warning",
};

const Audiencias = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Audiências</h1>
          <p className="text-muted-foreground text-sm mt-1">Controle de audiências e sessões de julgamento</p>
        </div>

        <div className="space-y-4">
          {audiencias.map((a) => (
            <div key={a.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-lg bg-primary/5 flex flex-col items-center justify-center shrink-0">
                    <Gavel className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{a.tipo}</h3>
                    <p className="text-sm text-muted-foreground font-mono mt-0.5">{a.processo}</p>
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.data} às {a.hora}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.vara}</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.cliente}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Magistrado: {a.juiz}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[a.status]}`}>
                  {a.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Audiencias;
