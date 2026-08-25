import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ClipboardCheck, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ActionList } from "@/components/controladoria/ActionList";
import { ControladoriaCounters } from "@/components/controladoria/ControladoriaCounters";
import { DoneBlock } from "@/components/controladoria/DoneBlock";
import { UpcomingBlock } from "@/components/controladoria/UpcomingBlock";
import { AudienciasTab } from "@/components/controladoria/tabs/AudienciasTab";
import { DocumentosTab } from "@/components/controladoria/tabs/DocumentosTab";
import { IntimacoesTab } from "@/components/controladoria/tabs/IntimacoesTab";
import { MovimentacoesTab } from "@/components/controladoria/tabs/MovimentacoesTab";
import { PrazosTab } from "@/components/controladoria/tabs/PrazosTab";
import { ProtocolosTab } from "@/components/controladoria/tabs/ProtocolosTab";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useControladoria } from "@/hooks/useControladoria";
import { useActiveTeamMembers } from "@/hooks/useActiveTeamMembers";
import { classifyDeadline } from "@/lib/controladoria";
import {
  acknowledgePublication,
  assignDeadline,
  changeDeadlineStatus,
  reviewPublicationDeadline,
} from "@/services/controladoria-actions";
import { fetchTabPage, type ControladoriaTab } from "@/services/controladoria-tabs";
import type { TabRow } from "@/services/controladoria-tabs";
import type { ActivityStatus } from "@/types/activities";
import type { ActionItem, ControladoriaCounters as CounterValues } from "@/types/controladoria";

export type ControladoriaScope = "meus" | "escritorio";
const PERIODS = [7, 15, 30] as const;
const CONTROLADORIA_TABS: ControladoriaTab[] = ["prazos", "intimacoes", "audiencias", "protocolos", "movimentacoes", "documentos"];
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
  const { toast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [reviewingPublication, setReviewingPublication] = useState<ActionItem | null>(null);
  const [deadlineForm, setDeadlineForm] = useState({ date: "", days: "", reason: "", title: "" });
  const scope: ControladoriaScope = searchParams.get("escopo") === "meus" ? "meus" : "escritorio";
  const requestedPeriod = Number(searchParams.get("periodo"));
  const periodDays = PERIODS.includes(requestedPeriod as typeof PERIODS[number]) ? requestedPeriod : 7;
  const focus = searchParams.get("foco");
  const activeCounter = focus ? focusMap[focus] ?? null : null;
  const query = useControladoria(tenantId, periodDays);
  const members = useActiveTeamMembers(tenantId);
  const now = query.data ? new Date(query.data.generatedAt) : new Date();
  const tabParam = searchParams.get("aba") as ControladoriaTab | null;
  const activeTab = tabParam && CONTROLADORIA_TABS.includes(tabParam) ? tabParam : "prazos";
  const tabPage = Math.max(1, Number(searchParams.get("pagina")) || 1);
  const tabParams = {
    tenantId: tenantId ?? "",
    page: tabPage,
    pageSize: Number(searchParams.get("porPagina")) || 20,
    assigneeId: searchParams.get("responsavel"),
    status: searchParams.get("status"),
    processId: searchParams.get("processo"),
    from: searchParams.get("de"),
    to: searchParams.get("ate"),
  };
  const tabQuery = useQuery({
    queryKey: ["controladoria-tab", activeTab, tabParams],
    enabled: Boolean(tenantId),
    queryFn: () => fetchTabPage(activeTab, tabParams),
    staleTime: 30_000,
  });

  const updateSearch = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setSearchParams(next, { replace: true });
  };
  const selectCounter = (counter: keyof CounterValues | null) => {
    const focusValue = Object.entries(focusMap).find(([, value]) => value === counter)?.[0] ?? null;
    updateSearch({ foco: focusValue });
  };
  const domainProps = {
    data: tabQuery.data,
    loading: tabQuery.isLoading,
    error: tabQuery.isError,
    onRetry: () => void tabQuery.refetch(),
    onPage: (page: number) => updateSearch({ pagina: page === 1 ? null : String(page) }),
  };
  const refreshControladoria = async () => {
    await Promise.all([query.refetch(), tabQuery.refetch()]);
  };
  const runAction = async (key: string, success: string, action: () => Promise<void>): Promise<boolean> => {
    setBusyAction(key);
    try {
      await action();
      toast({ title: success });
      await refreshControladoria();
      return true;
    } catch (error) {
      toast({ title: "Não foi possível concluir", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
      return false;
    } finally {
      setBusyAction(null);
    }
  };
  const openDeadlineReview = (item: ActionItem) => {
    setReviewingPublication(item);
    setDeadlineForm({ date: "", days: "", reason: "", title: `Cumprir prazo — ${item.processNumber ?? "intimação"}` });
  };
  const submitDeadlineReview = async () => {
    if (!tenantId || !reviewingPublication || !deadlineForm.date || !deadlineForm.reason.trim()) return;
    const succeeded = await runAction(`review:${reviewingPublication.id}`, "Prazo confirmado e tarefa criada", () => reviewPublicationDeadline({
      tenantId,
      publicationId: reviewingPublication.id,
      proposedDate: deadlineForm.date,
      proposedDays: deadlineForm.days ? Number.parseInt(deadlineForm.days, 10) : null,
      reason: deadlineForm.reason.trim(),
      taskTitle: deadlineForm.title.trim() || `Cumprir prazo — ${reviewingPublication.processNumber ?? "intimação"}`,
    }));
    if (succeeded) setReviewingPublication(null);
  };
  const deadlineActions = (id: string, assigneeId: string | null, status: string | null) => tenantId ? <div className="flex flex-wrap justify-end gap-2">
    <Select disabled={busyAction === `assign:${id}`} value={assigneeId ?? "none"} onValueChange={value => void runAction(`assign:${id}`, "Responsável atualizado", () => assignDeadline(tenantId, id, value === "none" ? null : value))}>
      <SelectTrigger className="h-8 w-40" aria-label="Alterar responsável"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="none">Sem responsável</SelectItem>{(members.data ?? []).map(member => <SelectItem key={member.userId} value={member.userId}>{member.name}</SelectItem>)}</SelectContent>
    </Select>
    <Select disabled={busyAction === `status:${id}`} value={status ?? "pendente"} onValueChange={value => void runAction(`status:${id}`, "Status atualizado", () => changeDeadlineStatus(tenantId, id, value as ActivityStatus))}>
      <SelectTrigger className="h-8 w-36" aria-label="Alterar status"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="pendente">A fazer</SelectItem><SelectItem value="em_andamento">Fazendo</SelectItem><SelectItem value="concluída">Concluída</SelectItem></SelectContent>
    </Select>
  </div> : null;
  const publicationActions = (item: ActionItem) => tenantId && user?.id ? <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" disabled={busyAction === `ack:${item.id}`} onClick={() => void runAction(`ack:${item.id}`, "Ciência registrada", () => acknowledgePublication(tenantId, item.id, user.id))}>Dar ciência</Button>
    <Button size="sm" onClick={() => openDeadlineReview(item)}>Gerar prazo</Button>
  </div> : null;
  const publicationRowActions = (row: TabRow) => publicationActions({ id: row.id, kind: "intimacao", title: String(row.tipo ?? "Intimação"), dueDate: row.data_publicacao ? String(row.data_publicacao) : null, processNumber: row.numero_processo ? String(row.numero_processo) : null, processId: row.process_id ? String(row.process_id) : null, clientName: row.cliente_nome ? String(row.cliente_nome) : null, assigneeId: null, assigneeName: null, status: row.ciencia_em ? "com_ciencia" : "sem_ciencia" });

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
              <ActionList items={action} now={now} onOpenProcess={processNumber => navigate(processNumber ? `/processos?busca=${encodeURIComponent(processNumber)}` : "/processos")}>
                {item => item.kind === "intimacao" ? publicationActions(item) : deadlineActions(item.id, item.assigneeId, item.status)}
              </ActionList>
              <div className="space-y-4"><UpcomingBlock hearings={query.data.upcoming} /><DoneBlock done={query.data.done} periodDays={periodDays} /></div>
            </section>

            <section aria-labelledby="dominios-controladoria" className="space-y-3">
              <div>
                <h2 id="dominios-controladoria" className="font-serif text-xl font-semibold">Visão por domínio</h2>
                <p className="text-sm text-muted-foreground">Consulte o histórico completo sem sair do posto de comando.</p>
              </div>
              <Tabs value={activeTab} onValueChange={value => updateSearch({ aba: value === "prazos" ? null : value, pagina: null })}>
                <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1">
                  <TabsTrigger value="prazos">Prazos</TabsTrigger>
                  <TabsTrigger value="intimacoes">Intimações</TabsTrigger>
                  <TabsTrigger value="audiencias">Audiências</TabsTrigger>
                  <TabsTrigger value="protocolos">Protocolos</TabsTrigger>
                  <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
                  <TabsTrigger value="documentos">Documentos</TabsTrigger>
                </TabsList>
                <div className="mt-3 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Select value={tabParams.assigneeId ?? "all"} onValueChange={value => updateSearch({ responsavel: value === "all" ? null : value, pagina: null })}>
                    <SelectTrigger aria-label="Filtrar responsável"><SelectValue placeholder="Responsável" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos os responsáveis</SelectItem>{(members.data ?? []).map(member => <SelectItem key={member.userId} value={member.userId}>{member.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input aria-label="Filtrar status" placeholder="Status" value={tabParams.status ?? ""} onChange={event => updateSearch({ status: event.target.value || null, pagina: null })} />
                  <Input aria-label="Filtrar processo" placeholder="ID do processo" value={tabParams.processId ?? ""} onChange={event => updateSearch({ processo: event.target.value || null, pagina: null })} />
                  <Input aria-label="Data inicial" type="date" value={tabParams.from ?? ""} onChange={event => updateSearch({ de: event.target.value || null, pagina: null })} />
                  <Input aria-label="Data final" type="date" value={tabParams.to ?? ""} onChange={event => updateSearch({ ate: event.target.value || null, pagina: null })} />
                </div>
                <TabsContent value="prazos" className="mt-3"><PrazosTab {...domainProps} actions={row => deadlineActions(row.id, row.responsavel_id ? String(row.responsavel_id) : null, row.status ? String(row.status) : null)} /></TabsContent>
                <TabsContent value="intimacoes" className="mt-3"><IntimacoesTab {...domainProps} actions={publicationRowActions} /></TabsContent>
                <TabsContent value="audiencias" className="mt-3"><AudienciasTab {...domainProps} /></TabsContent>
                <TabsContent value="protocolos" className="mt-3"><ProtocolosTab {...domainProps} /></TabsContent>
                <TabsContent value="movimentacoes" className="mt-3"><MovimentacoesTab {...domainProps} /></TabsContent>
                <TabsContent value="documentos" className="mt-3"><DocumentosTab {...domainProps} /></TabsContent>
              </Tabs>
            </section>
          </>
        )}
      </div>
      <Dialog open={Boolean(reviewingPublication)} onOpenChange={open => { if (!open) setReviewingPublication(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar prazo da intimação</DialogTitle><DialogDescription>Confirme a data e registre o fundamento. O cálculo e a criação continuam na função jurídica oficial do sistema.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="deadline-date">Data do prazo</Label><Input id="deadline-date" type="date" value={deadlineForm.date} onChange={event => setDeadlineForm(current => ({ ...current, date: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="deadline-days">Dias</Label><Input id="deadline-days" type="number" min="1" value={deadlineForm.days} onChange={event => setDeadlineForm(current => ({ ...current, days: event.target.value }))} /></div></div>
            <div className="space-y-2"><Label htmlFor="deadline-title">Título da tarefa</Label><Input id="deadline-title" value={deadlineForm.title} onChange={event => setDeadlineForm(current => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="deadline-reason">Fundamento da revisão</Label><Textarea id="deadline-reason" value={deadlineForm.reason} onChange={event => setDeadlineForm(current => ({ ...current, reason: event.target.value }))} placeholder="Ex.: prazo expresso de 15 dias úteis no texto" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReviewingPublication(null)}>Cancelar</Button><Button disabled={!deadlineForm.date || !deadlineForm.reason.trim() || Boolean(busyAction)} onClick={() => void submitDeadlineReview()}>Confirmar e criar prazo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
