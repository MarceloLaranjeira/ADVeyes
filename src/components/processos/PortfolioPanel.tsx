import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { summarizePortfolio, type PortfolioProcess } from "@/lib/process-portfolio";
import { officeService } from "@/services/office";

type Goal = { nome: string; valor: number | null };

export function PortfolioPanel({ tenantId, processes }: { tenantId: string; processes: PortfolioProcess[] }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    let cancelled = false;
    officeService.listCatalog(tenantId, "meta")
      .then((items) => { if (!cancelled) setGoals(items.filter((item) => item.ativo)); })
      .catch(() => { if (!cancelled) setGoals([]); });
    return () => { cancelled = true; };
  }, [tenantId]);

  const summary = useMemo(() => summarizePortfolio(processes, goals), [processes, goals]);
  const change = summary.closedChangePct;

  return (
    <section aria-label="Resumo da carteira" className="grid gap-3 lg:grid-cols-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Processos ativos</p>
          <p className="text-3xl font-bold tabular-nums">{summary.active.toLocaleString("pt-BR")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Encerrados e arquivados no mês</p>
          <p className="text-3xl font-bold tabular-nums">{summary.closedThisMonth.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {change === null ? "Sem base no mês anterior" : `${change > 0 ? "+" : ""}${change}% sobre o mês anterior (${summary.closedPreviousMonth})`}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Meta de fechamentos por área</p>
          {summary.goals.length === 0 ? (
            <p className="text-xs text-muted-foreground">Cadastre metas em Configurações → Cadastros, usando o nome da área.</p>
          ) : (
            <ul className="space-y-2">
              {summary.goals.slice(0, 5).map((goal) => (
                <li key={goal.name}>
                  <div className="flex justify-between text-xs"><span>{goal.name}</span><span className="tabular-nums">{goal.closed}/{goal.target}</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-label={`Meta de ${goal.name}`} aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={Math.min(goal.closed, goal.target)}>
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.round((goal.closed / goal.target) * 100))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="lg:col-span-3 text-xs text-muted-foreground">
        O cadastro não guarda a data de encerramento: o mês considerado é o da última atualização do processo arquivado.
      </p>
    </section>
  );
}
