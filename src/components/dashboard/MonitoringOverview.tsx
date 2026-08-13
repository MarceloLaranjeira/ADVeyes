import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, RadioTower, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { OperationalDashboardData } from "@/types/operational-dashboard";

interface MonitoringOverviewProps {
  data: OperationalDashboardData;
}

export function MonitoringOverview({ data }: MonitoringOverviewProps) {
  const navigate = useNavigate();
  const lastVerification = data.monitoring.lastVerification
    ? new Date(data.monitoring.lastVerification).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "Ainda não executada";

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <RadioTower className="h-4 w-4 text-primary" />
              <h2 className="font-serif text-lg font-semibold">Monitoramento jurídico</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Cobertura das fontes integradas e última atualização válida</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => navigate("/integracoes-juridicas")}>
            Ver integrações <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => navigate("/processos")} className="rounded-xl border p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><Scale className="h-3.5 w-3.5" /> Processos monitorados</span>
            <span className="mt-2 block text-2xl font-bold tabular-nums">{data.monitoring.monitoredProcesses}</span>
          </button>
          <button type="button" onClick={() => navigate("/integracoes-juridicas")} className="rounded-xl border p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><Activity className="h-3.5 w-3.5" /> Tribunais ativos</span>
            <span className="mt-2 block text-2xl font-bold tabular-nums">{data.monitoring.activeCourts}</span>
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Última verificação: <span className="font-medium text-foreground">{lastVerification}</span></p>
      </CardContent>
    </Card>
  );
}

