import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AreaBadge } from "../common/AreaBadge";
import { Clock, User, AlertTriangle, Scale, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../ui/button";

interface Processo {
  id: string;
  numero: string;
  cliente_nome?: string;
  area?: string;
  status?: string;
  data_prazo?: string;
  urgente?: boolean;
}

export const RecentProcesses = () => {
  const navigate = useNavigate();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProcessos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("processos")
      .select("id, numero, area, status, data_prazo, urgente, clientes(nome)")
      .order("updated_at", { ascending: false })
      .limit(8);

    if (data) {
      setProcessos(data.map((p) => ({
        id: p.id,
        numero: p.numero,
        cliente_nome: p.clientes?.nome || "—",
        area: p.area || "Geral",
        status: p.status || "Em andamento",
        data_prazo: p.data_prazo,
        urgente: p.urgente || false,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchProcessos(); }, []);

  return (
    <div className="bg-card rounded-xl border">
      <div className="p-5 border-b flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            Processos Recentes
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Últimos processos atualizados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchProcessos} title="Atualizar">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/processos")} className="text-xs gap-1">
            Ver todos
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="p-8 flex justify-center">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : processos.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Nenhum processo cadastrado ainda.
        </div>
      ) : (
        <div className="divide-y">
          {processos.map((p) => (
            <div
              key={p.id}
              className="p-4 hover:bg-muted/40 transition-colors cursor-pointer group"
              onClick={() => navigate("/processos")}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono font-medium truncate text-foreground/80 group-hover:text-foreground transition-colors">
                      {p.numero}
                    </p>
                    {p.urgente && <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--warning))] shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <User className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{p.cliente_nome}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <AreaBadge area={p.area || "Geral"} />
                  <span className="text-[11px] text-muted-foreground">{p.status}</span>
                  {p.data_prazo && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(p.data_prazo).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
