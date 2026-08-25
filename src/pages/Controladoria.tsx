import { useMemo } from "react";
import { AlertCircle, ClipboardCheck, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ActionList } from "@/components/controladoria/ActionList";
import { ControladoriaCounters } from "@/components/controladoria/ControladoriaCounters";
import { DoneBlock } from "@/components/controladoria/DoneBlock";
import { UpcomingBlock } from "@/components/controladoria/UpcomingBlock";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useControladoria } from "@/hooks/useControladoria";
import { classifyDeadline } from "@/lib/controladoria";
import type { ActionItem, ControladoriaCounters as CounterValues } from "@/types/controladoria";

export type ControladoriaScope = "meus" | "escritorio";
const PERIODS = [7, 15, 30] as const;
const focusMap: Record<string, keyof CounterValues> = {
  vencidos: "overdue",
  hoje: "today",
  proximos: "nextSevenDays",
  "sem-ciencia": "withoutAcknowledgement",
  "sem-responsavel": "withoutAssignee",
};

function filterByCounter(items: ActionItem[], counter: keyof CounterValues | null, now: Date): ActionItem[] {
  if (!counter) return items;
  return items.filter(item => {
    const deadline = classifyDeadline(item.dueDate, now);
    if (counter === "overdue") return item.kind === "prazo" && deadline.urgency === "vencido";
    if (counter === "today") return item.kind === "prazo" && deadline.urgency === "hoje";
    if (counter === "nextSevenDays") return item.kind === "prazo" && deadline.days !== null && deadline.days > 0 && deadline.days <= 7;
    if (counter === "withoutAcknowledgement") return item.kind === "intimacao";
    return item.kind === "prazo" && !item.assigneeId;
  });
}

export default function Controladoria() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.tenantId ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const scope: ControladoriaScope = searchParams.get("escopo") === "meus" ? "meus" : "escritorio";
  const requestedPeriod = Number(searchParams.get("periodo"));
  const periodDays = PERIODS.includes(requestedPeriod as typeof PERIODS[number]) ? requestedPeriod : 7;
  const focus = searchParams.get("foco");
  const activeCounter = focus ? focusMap[focus] ?? null : null;
  const query = useControladoria(tenantId, periodDays);
  const now = query.data ? new Date(query.data.generatedAt) : new Date();

  const updateSearch = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setSearchParams(next, { replace: true });
  };
  const selectCounter = (counter: keyof CounterValues | null) => {
    const focusValue = Object.entries(focusMap).find(([, value]) => value === counter)?.[0] ?? null;
    updateSearch({ foco: focusValue });
  };

  const action = useMemo(() => {
    if (!query.data) return [];
    // "Meus" é apenas uma conveniência sobre os registros que a RLS do
    // escritório já permite enxergar; não é uma fronteira de autorização.
    const scoped = scope === "meus"
      ? query.data.action.filter(item => item.assigneeId === user?.id)
      : query.data.action;
    return filterByCounter(scoped, activeCounter, now);
  }, [activeCounter, now, query.data, scope, user?.id]);

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-5">
        <header className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><ClipboardCheck className="h-4 w-4" />Controladoria Jurídica</p>
              <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight sm:text-3xl">O que precisa acontecer agora</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Prazos, intimações, audiências e protocolos do escritório em uma fila operacional única.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={scope} onValueChange={value => updateSearch({ escopo: value === "escritorio" ? null : value })}>
                <SelectTrigger className="w-40" aria-label="Escopo"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="escritorio">Escritório</SelectItem><SelectItem value="meus">Meus itens</SelectItem></SelectContent>
              </Select>
              <Select value={String(periodDays)} onValueChange={value => updateSearch({ periodo: value === "7" ? null : value })}>
                <SelectTrigger className="w-36" aria-label="Período"><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODS.map(period => <SelectItem key={period} value={String(period)}>{period} dias</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" className="gap-2" disabled={!tenantId || query.isFetching} onClick={() => void query.refetch()}>
                <RefreshCw className={query.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Atualizar
              </Button>
            </div>
          </div>
        </header>

        {!tenantId ? (
          <Card><CardContent className="py-16 text-center"><h2 className="text-lg font-semibold">Nenhum escritório ativo</h2><p className="mt-1 text-sm text-muted-foreground">Selecione um escritório para abrir a Controladoria.</p></CardContent></Card>
        ) : query.isLoading ? (
          <div aria-label="Carregando Controladoria" className="space-y-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>
        ) : query.isError || !query.data ? (
          <Card role="alert" className="border-destructive/30"><CardContent className="flex min-h-64 flex-col items-center justify-center text-center"><AlertCircle className="mb-3 h-8 w-8 text-destructive" /><h2 className="font-semibold">Não foi possível carregar a Controladoria</h2><Button className="mt-4" onClick={() => void query.refetch()}>Tentar novamente</Button></CardContent></Card>
        ) : (
          <>
            {query.data.warnings.length > 0 && <div role="status" className="flex gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div><p className="font-semibold">Alguns blocos não puderam ser atualizados</p><p className="text-xs text-muted-foreground">{query.data.warnings.join(" · ")}</p></div></div>}
            <ControladoriaCounters counters={query.data.counters} active={activeCounter} onSelect={selectCounter} />
            <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
              <ActionList items={action} now={now} onOpenProcess={processNumber => navigate(processNumber ? `/processos?busca=${encodeURIComponent(processNumber)}` : "/processos")} />
              <div className="space-y-4"><UpcomingBlock hearings={query.data.upcoming} /><DoneBlock done={query.data.done} periodDays={periodDays} /></div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
