import { useNavigate } from "react-router-dom";
import { ArrowRight, CircleDollarSign, Clock3, ReceiptText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { OperationalDashboardData } from "@/types/operational-dashboard";

interface FinancialOverviewProps {
  data: OperationalDashboardData;
}

export function FinancialOverview({ data }: FinancialOverviewProps) {
  const navigate = useNavigate();
  const { financial } = data;

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold">Financeiro do mês</h2>
            <p className="mt-1 text-xs text-muted-foreground">Recebimentos e despesas registrados no período atual</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => navigate("/financeiro")}>
            Abrir financeiro <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Recebido no mês", value: financial.receivedThisMonth, icon: TrendingUp },
            { label: "Despesas no mês", value: financial.expensesThisMonth, icon: ReceiptText },
            { label: "A receber", value: financial.pending, icon: Clock3 },
            { label: "Em atraso", value: financial.overdue, icon: CircleDollarSign, danger: financial.overdue > 0 },
          ].map(({ label, value, icon: Icon, danger }) => (
            <button
              type="button"
              key={label}
              onClick={() => navigate("/financeiro")}
              className="rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
              </span>
              <span className={danger ? "mt-2 block text-base font-bold tabular-nums text-destructive" : "mt-2 block text-base font-bold tabular-nums"}>{formatCurrency(value)}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-muted/45 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Resultado líquido do mês</span>
            <span className={financial.netThisMonth < 0 ? "font-bold tabular-nums text-destructive" : "font-bold tabular-nums text-emerald-700"}>{formatCurrency(financial.netThisMonth)}</span>
          </div>
          {financial.monthlyGoal ? (
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>Meta: {formatCurrency(financial.monthlyGoal)}</span>
                <span>{financial.goalProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${financial.goalProgress}%` }} />
              </div>
            </div>
          ) : (
            <button type="button" className="mt-2 text-xs font-medium text-primary hover:underline" onClick={() => navigate("/financeiro")}>Definir meta financeira</button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

