import { AppLayout } from "@/components/layout/AppLayout";
import { CalendarDays, Clock, MapPin } from "lucide-react";

const dias = ["Seg 02", "Ter 03", "Qua 04", "Qui 05", "Sex 06"];
const eventos = [
  { dia: 0, hora: "09:00", titulo: "Audiência - João Silva", local: "1ª Vara Criminal", tipo: "audiência" },
  { dia: 0, hora: "14:00", titulo: "Prazo - Alegações Finais", local: "", tipo: "prazo" },
  { dia: 1, hora: "10:00", titulo: "Reunião com cliente - Ana Costa", local: "Escritório", tipo: "reunião" },
  { dia: 2, hora: "08:30", titulo: "Audiência de Custódia", local: "Fórum Henoch Reis", tipo: "audiência" },
  { dia: 2, hora: "15:00", titulo: "Sustentação Oral - TJAM", local: "2ª Câmara Criminal", tipo: "audiência" },
  { dia: 3, hora: "09:00", titulo: "Prazo - Recurso Especial", local: "", tipo: "prazo" },
  { dia: 4, hora: "11:00", titulo: "Júri Popular - Roberto Souza", local: "Tribunal do Júri", tipo: "audiência" },
];

const tipoColors: Record<string, string> = {
  audiência: "border-l-destructive bg-destructive/5",
  prazo: "border-l-warning bg-warning/5",
  reunião: "border-l-info bg-info/5",
};

const Agenda = () => {
  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Agenda</h1>
          <p className="text-muted-foreground text-sm mt-1">Semana de 02/03/2026 a 06/03/2026</p>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {dias.map((dia, idx) => (
            <div key={dia} className="bg-card rounded-lg border">
              <div className="p-3 border-b text-center">
                <p className="text-sm font-semibold">{dia}</p>
              </div>
              <div className="p-3 space-y-2 min-h-[400px]">
                {eventos
                  .filter((e) => e.dia === idx)
                  .map((e, i) => (
                    <div key={i} className={`p-3 rounded-md border-l-4 ${tipoColors[e.tipo]} cursor-pointer hover:shadow-sm transition-shadow`}>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3 h-3" />
                        {e.hora}
                      </div>
                      <p className="text-xs font-medium leading-snug">{e.titulo}</p>
                      {e.local && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                          <MapPin className="w-3 h-3" />
                          {e.local}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Agenda;
