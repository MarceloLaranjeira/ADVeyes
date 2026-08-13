import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  CheckCircle2,
  Clock3,
  Gavel,
  Target,
  Users,
} from "lucide-react";
import { DepthCard } from "@/components/dashboard/DepthCard";
import type { OperationalDashboardData } from "@/types/operational-dashboard";

interface OperationalKpisProps {
  data: OperationalDashboardData;
}

export function OperationalKpis({ data }: OperationalKpisProps) {
  const navigate = useNavigate();
  const items = [
    {
      label: "Processos ativos",
      value: data.metrics.activeProcesses,
      detail: `${data.monitoring.monitoredProcesses} monitorados`,
      href: "/processos",
      icon: Briefcase,
    },
    {
      label: "Atividades pendentes",
      value: data.metrics.pendingActivities,
      detail: data.metrics.overdueActivities > 0
        ? `${data.metrics.overdueActivities} em atraso`
        : "Nenhuma atrasada",
      href: "/tarefas",
      icon: Clock3,
      urgent: data.metrics.overdueActivities > 0,
    },
    {
      label: "Concluídas no mês",
      value: data.metrics.completedThisMonth,
      detail: `${data.metrics.pointsThisMonth} pontos acumulados`,
      href: "/tarefas?view=desempenho",
      icon: CheckCircle2,
    },
    {
      label: "Audiências em 7 dias",
      value: data.metrics.hearingsNext7Days,
      detail: data.metrics.hearingsNext7Days > 0 ? "Preparação recomendada" : "Agenda livre",
      href: "/audiencias",
      icon: Gavel,
    },
    {
      label: "Contatos",
      value: data.metrics.contacts,
      detail: `${data.metrics.newLeads} novo(s) lead(s)`,
      href: "/clientes",
      icon: Users,
    },
    {
      label: "Taskscore mensal",
      value: data.metrics.pointsThisMonth,
      detail: `${data.metrics.hoursThisMonth.toFixed(1)}h registradas`,
      href: "/relatorios",
      icon: Target,
    },
  ];

  return (
    <section aria-labelledby="operational-kpis-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="operational-kpis-title" className="font-serif text-lg font-semibold">Visão operacional</h2>
          <p className="text-xs text-muted-foreground">Indicadores do escritório e produtividade do mês</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {items.map(({ label, value, detail, href, icon: Icon, urgent }) => (
          <DepthCard
            key={label}
            interactive
            onActivate={() => navigate(href)}
            className={urgent ? "border-destructive/30 bg-destructive/[0.025] p-4" : "p-4"}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <p className={urgent ? "mt-2 text-3xl font-bold tabular-nums text-destructive" : "mt-2 text-3xl font-bold tabular-nums"}>{value}</p>
              </div>
              <span className={urgent ? "rounded-lg bg-destructive/10 p-2 text-destructive" : "rounded-lg bg-secondary p-2 text-muted-foreground"}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <p className={urgent ? "mt-2 truncate text-[11px] font-medium text-destructive" : "mt-2 truncate text-[11px] text-muted-foreground"}>{detail}</p>
          </DepthCard>
        ))}
      </div>
    </section>
  );
}

