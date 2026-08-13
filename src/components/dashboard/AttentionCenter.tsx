import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Gavel,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardAttentionKind, OperationalDashboardData } from "@/types/operational-dashboard";

const kindPresentation: Record<DashboardAttentionKind, {
  icon: typeof AlertTriangle;
  className: string;
}> = {
  overdue: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
  today: { icon: CalendarClock, className: "bg-warning/15 text-warning" },
  upcoming: { icon: CheckCircle2, className: "bg-secondary text-muted-foreground" },
  hearing: { icon: Gavel, className: "bg-secondary text-foreground" },
  publication: { icon: BellRing, className: "bg-secondary text-foreground" },
  finance: { icon: Banknote, className: "bg-secondary text-foreground" },
};

interface AttentionCenterProps {
  data: OperationalDashboardData;
}

export function AttentionCenter({ data }: AttentionCenterProps) {
  const navigate = useNavigate();

  return (
    <Card className="h-full">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <h2 className="font-serif text-lg font-semibold">Centro de atenção</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Prioridades ordenadas por risco e proximidade</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => navigate("/tarefas")}>
            Ver atividades <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {data.attention.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-600" />
            <p className="text-sm font-semibold">Tudo sob controle</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">Nenhum prazo crítico, audiência próxima, intimação pendente ou cobrança atrasada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.attention.map(item => {
              const presentation = kindPresentation[item.kind];
              const Icon = presentation.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => navigate(item.href)}
                  className="group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={`mt-0.5 rounded-lg p-2 ${presentation.className}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

