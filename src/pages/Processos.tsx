import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Download, FilterX, Loader2, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { CorrectionDialog, IntelligenceCentral, IntelligenceList, IntelligenceMetricCards, IntelligencePipeline } from "@/components/processos/ProcessIntelligenceWorkspace";
import { ProcessoForm } from "@/components/processos/ProcessoForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useProcessIntelligence } from "@/hooks/useProcessIntelligence";
import { applySituation, EMPTY_INTELLIGENCE_FILTERS, PHASE_LABELS, WAITING_LABELS, filterProcessIntelligence, intelligenceMetrics } from "@/lib/process-intelligence-workspace";
import { parseProcessRoute, processRouteParams, PROCESS_PAGE_SIZE, type ProcessRouteState, type ProcessSituation, type ProcessTab } from "@/lib/process-workspace";
import type { IntelligenceRisk, ProcessIntelligenceItem, ProcessPhase, WaitingOn } from "@/types/process-intelligence";

function exportCsv(items: ProcessIntelligenceItem[]) {
  const rows = [["Processo", "Cliente", "Área", "Fase", "Etapa", "Aguardando", "Dias sem avanço", "Motivo", "Próxima ação", "Risco"], ...items.map(item => [item.number, item.clientName ?? "", item.area ?? "", item.intelligence ? PHASE_LABELS[item.intelligence.phase] : "Não analisada", item.intelligence?.stage ?? "", item.intelligence ? WAITING_LABELS[item.intelligence.waitingOn] : "", String(item.intelligence?.stalledDays ?? ""), item.intelligence?.waitingReason ?? "", item.intelligence?.nextAction ?? "", item.intelligence?.risk ?? ""])];
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `inteligencia-processual-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

export default function Processos() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const intelligence = useProcessIntelligence(currentTenant?.tenantId ?? null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<ProcessIntelligenceItem | null>(null);
  const route = useMemo(() => parseProcessRoute(searchParams), [searchParams]);
  const { filters, tab, limit } = route;

  // `replace` e não `push`: sem isso cada tecla digitada na busca vira uma
  // entrada de histórico e o botão Voltar passa a desfazer letra por letra.
  const updateRoute = useCallback((patch: Partial<ProcessRouteState>) => {
    setSearchParams(processRouteParams({ ...route, ...patch }), { replace: true });
  }, [route, setSearchParams]);

  const setFilters = useCallback((patch: Partial<typeof filters>) => {
    updateRoute({ filters: { ...filters, ...patch }, limit: PROCESS_PAGE_SIZE });
  }, [filters, updateRoute]);

  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [deferredSearch, filters]);
  const inSituation = useMemo(() => applySituation(intelligence.items, route.situation), [intelligence.items, route.situation]);
  const filtered = useMemo(() => filterProcessIntelligence(inSituation, effectiveFilters), [effectiveFilters, inSituation]);
  const visibleItems = useMemo(() => filtered.slice(0, limit), [limit, filtered]);
  const metrics = useMemo(() => intelligenceMetrics(inSituation), [inSituation]);
  const areas = useMemo(() => [...new Set(inSituation.map(item => item.area).filter(Boolean) as string[])].sort(), [inSituation]);

  const queueAll = async () => {
    try { const result = await intelligence.backfill.mutateAsync(); toast({ title: "Varredura iniciada", description: `${result.queued} processos foram colocados na fila.` }); }
    catch { toast({ title: "Não foi possível iniciar a varredura", variant: "destructive" }); }
  };

  return (
    <AppLayout><div className="animate-fade-in space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Inteligência processual</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Central Processual</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Descubra onde cada processo está, há quanto tempo não avança, por quê e quem precisa agir agora.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" onClick={() => exportCsv(filtered)}><Download className="h-4 w-4" /> Exportar</Button><Button variant="outline" className="gap-2" disabled={intelligence.backfill.isPending} onClick={() => void queueAll()}>{intelligence.backfill.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analisar todos</Button><Button className="gap-2" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Novo processo</Button></div>
      </header>

      <IntelligenceMetricCards {...metrics} />

      <div className="rounded-xl border bg-card p-3 sm:p-4"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
        <div className="relative md:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={filters.search} onChange={event => setFilters({ search: event.target.value })} className="pl-9" placeholder="Buscar processo, cliente, advogado, motivo ou ação..." /></div>
        <Select value={filters.phase} onValueChange={value => setFilters({ phase: value as ProcessPhase | "all" })}><SelectTrigger><SelectValue placeholder="Fase" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as fases</SelectItem>{Object.entries(PHASE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={filters.waitingOn} onValueChange={value => setFilters({ waitingOn: value as WaitingOn | "all" })}><SelectTrigger><SelectValue placeholder="Aguardando" /></SelectTrigger><SelectContent><SelectItem value="all">Quem precisa agir</SelectItem>{Object.entries(WAITING_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={filters.risk} onValueChange={value => setFilters({ risk: value as IntelligenceRisk | "all" })}><SelectTrigger><SelectValue placeholder="Risco" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os riscos</SelectItem><SelectItem value="critico">Crítico</SelectItem><SelectItem value="alto">Alto</SelectItem><SelectItem value="atencao">Atenção</SelectItem><SelectItem value="normal">Normal</SelectItem></SelectContent></Select>
        <Select value={filters.area} onValueChange={value => setFilters({ area: value })}><SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as áreas</SelectItem>{areas.map(area => <SelectItem key={area} value={area}>{area}</SelectItem>)}</SelectContent></Select>
        <Select value={route.situation} onValueChange={value => updateRoute({ situation: value as ProcessSituation, limit: PROCESS_PAGE_SIZE })}><SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger><SelectContent><SelectItem value="ativos">Ativos e em andamento</SelectItem><SelectItem value="arquivados">Arquivados</SelectItem><SelectItem value="todos">Todos</SelectItem></SelectContent></Select>
      </div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Button variant={filters.stalledOnly ? "secondary" : "outline"} size="sm" onClick={() => setFilters({ stalledOnly: !filters.stalledOnly })}>Somente sem avanço</Button><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{filtered.length} de {inSituation.length} processos</span><Button variant="ghost" size="sm" className="gap-1" onClick={() => updateRoute({ filters: EMPTY_INTELLIGENCE_FILTERS, limit: PROCESS_PAGE_SIZE })}><FilterX className="h-3.5 w-3.5" /> Limpar</Button><Button variant="ghost" size="icon" aria-label="Atualizar central" onClick={() => void intelligence.refetch()}><RefreshCw className={`h-4 w-4 ${intelligence.loading ? "animate-spin" : ""}`} /></Button></div></div></div>

      {intelligence.loading ? <div className="flex min-h-72 items-center justify-center rounded-xl border"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="ml-3 text-sm text-muted-foreground">Lendo a carteira processual...</span></div> : intelligence.error ? <div role="alert" className="rounded-xl border border-destructive/30 p-8 text-center"><p className="font-semibold">Não foi possível carregar a inteligência processual</p><Button className="mt-4" onClick={() => void intelligence.refetch()}>Tentar novamente</Button></div> : <><Tabs value={tab} onValueChange={value => updateRoute({ tab: value as ProcessTab })}><TabsList><TabsTrigger value="central">Central</TabsTrigger><TabsTrigger value="pipeline">Pipeline</TabsTrigger><TabsTrigger value="lista">Lista</TabsTrigger></TabsList><TabsContent value="central" className="mt-4"><IntelligenceCentral items={visibleItems} onCorrect={setSelected} /></TabsContent><TabsContent value="pipeline" className="mt-4"><IntelligencePipeline items={visibleItems} /></TabsContent><TabsContent value="lista" className="mt-4"><IntelligenceList items={visibleItems} /></TabsContent></Tabs>{visibleItems.length < filtered.length ? <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-4"><p className="text-xs text-muted-foreground">Exibindo {visibleItems.length} de {filtered.length} processos para manter a Central rápida.</p><Button variant="outline" onClick={() => updateRoute({ limit: limit + PROCESS_PAGE_SIZE })}>Mostrar mais 40</Button></div> : null}</>}

      <ProcessoForm open={showForm} onOpenChange={setShowForm} onSuccess={() => void intelligence.refetch()} />
      <CorrectionDialog key={selected?.id ?? "none"} item={selected} open={Boolean(selected)} busy={intelligence.correct.isPending} onOpenChange={open => { if (!open) setSelected(null); }} onSubmit={async (correction, justification) => { if (!selected) return; try { await intelligence.correct.mutateAsync({ processId: selected.id, correction, justification }); toast({ title: "Leitura corrigida", description: "A revisão humana foi registrada e passa a prevalecer." }); setSelected(null); } catch { toast({ title: "Não foi possível salvar a correção", variant: "destructive" }); } }} />
    </div></AppLayout>
  );
}
