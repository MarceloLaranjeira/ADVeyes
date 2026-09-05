import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AlertTriangle, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Clock, Database, Download, Gavel, KeyRound, Link2, Loader2, MapPin, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, Unplug, User } from "lucide-react";
import { exportAudienciasPDF } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DepthCard } from "@/components/dashboard/DepthCard";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
import { usePlatformSupport } from "@/contexts/PlatformSupportContext";
import { loadHearingsWorkspace, type HearingSignalRow } from "@/services/hearings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { legalPortalMessage, legalPortalService, type LegalPortalOverview } from "@/services/legal-portal";
import { defaultHearingFilters, filterHearings, paginateHearings, type HearingFilters } from "@/lib/hearing-filters";

interface Audiencia {
  id: string;
  tipo: string;
  data_hora: string;
  vara?: string;
  juiz?: string;
  local?: string;
  observacoes?: string;
  status: string;
  processo_id?: string;
  processo_numero?: string;
  cliente_nome?: string;
  source_provider?: string;
  review_status?: string;
  event_status?: string;
  court_code?: string;
}

interface Processo {
  id: string;
  numero: string;
  cliente_nome?: string;
}

const tiposAudiencia = ["Instrução e Julgamento", "Interrogatório", "Una", "Custódia", "Conciliação", "Sessão de julgamento", "Júri Popular", "Sustentação Oral", "Justificação", "Admonitória"];
const statusOptions = ["Agendada", "Confirmada", "Realizada", "Adiada", "Cancelada"];

const statusColors: Record<string, string> = {
  Confirmada: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  Agendada: "bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]",
  Adiada: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  Realizada: "bg-primary/10 text-primary",
  Cancelada: "bg-destructive/10 text-destructive",
};

const emptyForm = { tipo: "Instrução e Julgamento", data_hora: "", vara: "", juiz: "", local: "", observacoes: "", status: "Agendada", processo_id: "", processo_numero: "", cliente_nome: "" };

const Audiencias = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const support = usePlatformSupport();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [audiencias, setAudiencias] = useState<Audiencia[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Audiencia | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signals, setSignals] = useState<HearingSignalRow[]>([]);
  const [coverageCount, setCoverageCount] = useState(0);
  const [portal, setPortal] = useState<LegalPortalOverview | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [selectedPortalCourt, setSelectedPortalCourt] = useState("TJAM");
  const [portalCredentials, setPortalCredentials] = useState({ login: "", password: "" });
  const tenantId = currentTenant?.tenantId ?? null;
  const readOnly = support.isPlatformAccess && !support.active;
  const filters = useMemo<HearingFilters>(() => ({
    query: searchParams.get("q") ?? "",
    period: (["future", "7", "30", "custom", "all"].includes(searchParams.get("period") ?? "")
      ? searchParams.get("period") : "future") as HearingFilters["period"],
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    status: searchParams.get("status") ?? "all",
    type: searchParams.get("type") ?? "all",
    court: searchParams.get("court") ?? "all",
  }), [searchParams]);
  const requestedPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const filteredHearings = useMemo(() => filterHearings(audiencias, filters), [audiencias, filters]);
  const pagination = useMemo(() => paginateHearings(filteredHearings, requestedPage, 25), [filteredHearings, requestedPage]);
  const types = useMemo(() => [...new Set(audiencias.map(item => item.tipo).filter(Boolean))].sort(), [audiencias]);
  const statuses = useMemo(() => [...new Set(audiencias.map(item => item.status).filter(Boolean))].sort(), [audiencias]);
  const courts = useMemo(() => [...new Set(audiencias.map(item => item.court_code || "Não informado"))].sort(), [audiencias]);

  const updateFilters = useCallback((changes: Partial<HearingFilters> & { page?: number }) => {
    const next = { ...filters, ...changes };
    const params = new URLSearchParams();
    if (next.query) params.set("q", next.query);
    if (next.period !== defaultHearingFilters.period) params.set("period", next.period);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.status !== "all") params.set("status", next.status);
    if (next.type !== "all") params.set("type", next.type);
    if (next.court !== "all") params.set("court", next.court);
    if ((changes.page ?? 1) > 1) params.set("page", String(changes.page));
    const focus = searchParams.get("focus");
    if (focus) params.set("focus", focus);
    setSearchParams(params);
  }, [filters, searchParams, setSearchParams]);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoadingData(true);
    setLoadError(null);
    try {
      const data = await loadHearingsWorkspace(tenantId);
      setAudiencias(data.hearings as Audiencia[]);
      setProcessos(data.processes);
      setSignals(data.signals);
      setCoverageCount(data.coverage.length);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as audiências.");
    } finally {
      setLoadingData(false);
    }
  }, [tenantId]);

  const fetchPortalStatus = useCallback(async () => {
    if (!tenantId) return;
    try {
      setPortal(await legalPortalService.status(tenantId, selectedPortalCourt));
    } catch (error) {
      toast({
        title: "Conexão Projudi indisponível",
        description: error instanceof Error ? error.message : "Não foi possível consultar a integração.",
        variant: "destructive",
      });
    }
  }, [selectedPortalCourt, tenantId, toast]);

  useEffect(() => { void fetchData(); void fetchPortalStatus(); }, [fetchData, fetchPortalStatus]);

  const connectPortal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    setPortalLoading(true);
    try {
      const result = await legalPortalService.connect(
        tenantId,
        selectedPortalCourt,
        portalCredentials.login,
        portalCredentials.password,
      );
      setPortal(result);
      setPortalCredentials({ login: "", password: "" });
      setConnectOpen(false);
      await fetchData();
      toast({
        title: "Projudi/TJAM conectado",
        description: `${result.sync?.received ?? 0} audiência(s) recebida(s) da agenda oficial.`,
      });
    } catch (error) {
      toast({ title: "Não foi possível conectar", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
      await fetchPortalStatus();
    } finally {
      setPortalLoading(false);
    }
  };

  const syncPortal = async () => {
    if (!tenantId) return;
    setPortalLoading(true);
    try {
      const result = await legalPortalService.sync(tenantId, selectedPortalCourt);
      setPortal(result);
      await fetchData();
      toast({ title: "Agenda sincronizada", description: `${result.sync?.received ?? 0} audiência(s) conferida(s) no Projudi.` });
    } catch (error) {
      toast({ title: "Falha na sincronização", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
      await fetchPortalStatus();
    } finally {
      setPortalLoading(false);
    }
  };

  const disconnectPortal = async () => {
    if (!tenantId) return;
    setPortalLoading(true);
    try {
      setPortal(await legalPortalService.disconnect(tenantId, selectedPortalCourt));
      setDisconnectOpen(false);
      toast({ title: "Projudi desconectado", description: "A credencial protegida foi removida. As audiências já importadas foram preservadas." });
    } catch (error) {
      toast({ title: "Não foi possível desconectar", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const focusedId = searchParams.get("focus");
  const selectedCourtEntry = portal?.courts.find(court => court.courtCode === selectedPortalCourt) ?? null;
  useEffect(() => {
    if (!focusedId || !audiencias.some(item => item.id === focusedId)) return;
    const timer = window.setTimeout(() => {
      const card = document.getElementById(`audiencia-${focusedId}`);
      if (typeof card?.scrollIntoView === "function") card.scrollIntoView({ behavior: "smooth", block: "center" });
      card?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [audiencias, focusedId]);

  const openEdit = (a: Audiencia) => {
    setEditData(a);
    setForm({
      tipo: a.tipo, data_hora: a.data_hora?.slice(0, 16) || "", vara: a.vara || "", juiz: a.juiz || "",
      local: a.local || "", observacoes: a.observacoes || "", status: a.status,
      processo_id: a.processo_id || "", processo_numero: a.processo_numero || "", cliente_nome: a.cliente_nome || "",
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditData(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleProcessoChange = (processoId: string) => {
    const p = processos.find((pr) => pr.id === processoId);
    setForm({ ...form, processo_id: processoId, processo_numero: p?.numero || "", cliente_nome: p?.cliente_nome || "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data_hora) { toast({ title: "Informe a data/hora", variant: "destructive" }); return; }
    if (!tenantId || readOnly) return;
    setLoading(true);
    const payload = {
      ...form, user_id: user!.id,
      tenant_id: tenantId,
      processo_id: form.processo_id || null,
    };
    const { error } = editData
      ? await supabase.from("audiencias").update(payload).eq("tenant_id", tenantId).eq("id", editData.id)
      : await supabase.from("audiencias").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editData ? "Audiência atualizada!" : "Audiência cadastrada!" });
      setShowForm(false);
      fetchData();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId || !tenantId || readOnly) return;
    const { error } = await supabase.from("audiencias").delete().eq("tenant_id", tenantId).eq("id", deleteId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Audiência excluída!" }); fetchData(); }
    setDeleteId(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Audiências</h1>
            <p className="text-muted-foreground text-sm mt-1">Controle de audiências e sessões de julgamento</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportAudienciasPDF(filteredHearings)} className="gap-2"><Download className="w-4 h-4" /> PDF</Button>
            <Button variant="outline" onClick={() => void fetchData()} disabled={loadingData} className="gap-2"><RefreshCw className={cn("w-4 h-4", loadingData && "animate-spin")} /> Atualizar</Button>
            <Button onClick={openNew} disabled={readOnly} className="gap-2"><Plus className="w-4 h-4" /> Nova Audiência</Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 mb-6">
          <div className="rounded-lg border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Gavel className="h-4 w-4" /> Compromissos confirmados</div><p className="mt-1 text-2xl font-semibold">{audiencias.length}</p></div>
          <div className="rounded-lg border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4 text-amber-600" /> Indícios para revisão</div><p className="mt-1 text-2xl font-semibold">{signals.length}</p></div>
          <div className="rounded-lg border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Database className="h-4 w-4" /> TJs com cobertura pública</div><p className="mt-1 text-2xl font-semibold">{coverageCount}</p></div>
        </div>

        {loadError && <Alert variant="destructive" className="mb-6"><AlertTriangle className="h-4 w-4" /><AlertTitle>Falha ao carregar</AlertTitle><AlertDescription>{loadError} <Button variant="link" onClick={() => void fetchData()}>Tentar novamente</Button></AlertDescription></Alert>}
        {readOnly && <Alert className="mb-6"><ShieldCheck className="h-4 w-4" /><AlertTitle>Visualização da Conta Geral</AlertTitle><AlertDescription>Ative o suporte temporário para cadastrar, editar ou excluir audiências.</AlertDescription></Alert>}

        <section className="mb-6 rounded-xl border bg-card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-slate-100 p-2 text-slate-600"><Link2 className="h-5 w-5" /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">Agenda oficial Projudi — Brasil</h2>
                  {portal?.connection?.status === "active" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Conectado</span>}
                </div>
                {portal?.connection?.status === "active" ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedPortalCourt} · usuário {portal.connection.loginMasked} · última sincronização {portal.connection.lastSuccessAt ? formatDate(portal.connection.lastSuccessAt) : "ainda não concluída"}.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Escolha o tribunal e conecte o acesso autorizado do advogado para importar data e horário da agenda interna.</p>
                )}
                {portal?.connection?.lastErrorCode && <p className="mt-2 text-sm text-destructive">{legalPortalMessage(portal.connection.lastErrorCode)}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {portal?.connection?.status === "active" ? <>
                <Button variant="outline" onClick={() => void syncPortal()} disabled={portalLoading || !portal.access.canManage} className="gap-2"><RefreshCw className={cn("h-4 w-4", portalLoading && "animate-spin")} /> Sincronizar Projudi</Button>
                <Button variant="outline" onClick={() => setConnectOpen(true)} disabled={portalLoading || !portal.access.canManage} className="gap-2"><KeyRound className="h-4 w-4" /> Trocar acesso</Button>
                <Button variant="ghost" onClick={() => setDisconnectOpen(true)} disabled={portalLoading || !portal.access.canManage} className="gap-2 text-destructive"><Unplug className="h-4 w-4" /> Desconectar</Button>
              </> : <Button onClick={() => setConnectOpen(true)} disabled={portalLoading || readOnly || !portal?.access.canManage} className="gap-2"><KeyRound className="h-4 w-4" /> {portal?.connection?.status === "paused" ? "Revalidar acesso" : "Conectar Projudi"}</Button>}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2"><CalendarRange className="h-4 w-4 text-slate-500" /><h2 className="font-semibold">Filtrar agenda confirmada</h2></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Buscar audiências" placeholder="Processo, cliente, vara ou tipo" className="pl-9" value={filters.query} onChange={event => updateFilters({ query: event.target.value })} /></div>
            <Select value={filters.period} onValueChange={value => updateFilters({ period: value as HearingFilters["period"], from: "", to: "" })}><SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="future">Todas as futuras</SelectItem><SelectItem value="7">Próximos 7 dias</SelectItem><SelectItem value="30">Próximos 30 dias</SelectItem><SelectItem value="custom">Período personalizado</SelectItem><SelectItem value="all">Todo o histórico</SelectItem></SelectContent></Select>
            <Select value={filters.status} onValueChange={value => updateFilters({ status: value })}><SelectTrigger aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{statuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.type} onValueChange={value => updateFilters({ type: value })}><SelectTrigger aria-label="Tipo de audiência"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{types.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.court} onValueChange={value => updateFilters({ court: value })}><SelectTrigger aria-label="Tribunal"><SelectValue placeholder="Tribunal" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tribunais</SelectItem>{courts.map(court => <SelectItem key={court} value={court}>{court}</SelectItem>)}</SelectContent></Select>
          </div>
          {filters.period === "custom" ? <div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-2"><div><Label htmlFor="hearing-from" className="text-xs">De</Label><Input id="hearing-from" type="date" value={filters.from} onChange={event => updateFilters({ from: event.target.value })} /></div><div><Label htmlFor="hearing-to" className="text-xs">Até</Label><Input id="hearing-to" type="date" value={filters.to} onChange={event => updateFilters({ to: event.target.value })} /></div></div> : null}
          <p className="mt-3 text-xs text-muted-foreground">{filteredHearings.length} compromisso(s) confirmado(s) nos filtros atuais. Sessões de julgamento aparecem nesta mesma agenda.</p>
        </section>

        <div className="space-y-4">
          {loadingData && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {!loadingData && !loadError && filteredHearings.length === 0 && <p className="rounded-xl border bg-white py-12 text-center text-muted-foreground">Nenhuma audiência confirmada corresponde aos filtros. Os indícios não são misturados à agenda.</p>}
          {pagination.items.map((a) => (
            <DepthCard
              key={a.id}
              id={`audiencia-${a.id}`}
              interactive
              onActivate={() => openEdit(a)}
              aria-label={`Abrir audiência ${a.tipo}${a.processo_numero ? ` do processo ${a.processo_numero}` : ""}`}
              className={cn("p-5 hover:shadow-md transition-all", focusedId === a.id && "bg-primary/5 ring-2 ring-primary/40")}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Gavel className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{a.tipo}</h3>
                    {a.processo_numero && <p className="text-sm text-muted-foreground font-mono mt-0.5">{a.processo_numero}</p>}
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(a.data_hora)}</span>
                      {a.vara && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.vara}</span>}
                      {a.cliente_nome && <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.cliente_nome}</span>}
                    </div>
                    {a.juiz && <p className="text-xs text-muted-foreground mt-1">Magistrado: {a.juiz}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[a.status] || "bg-muted text-muted-foreground"}`}>{a.status}</span>
                  <Button variant="ghost" size="icon" disabled={readOnly} className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" disabled={readOnly} className="h-8 w-8 text-destructive" onClick={() => setDeleteId(a.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </DepthCard>
          ))}
          {!loadingData && pagination.totalPages > 1 ? <div className="flex items-center justify-between rounded-xl border bg-white p-3"><span className="text-sm text-muted-foreground">Página {pagination.page} de {pagination.totalPages} · {pagination.total} compromissos</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => updateFilters({ page: pagination.page - 1 })}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button><Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilters({ page: pagination.page + 1 })}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div> : null}
        </div>

        {signals.length > 0 ? <details className="mt-8 rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">Indícios oficiais para revisão ({signals.length})</summary><p className="mt-2 text-sm text-muted-foreground">Movimentações que mencionam audiência, mas não comprovam data e hora. Elas não entram na agenda até serem confirmadas.</p><div className="mt-4 space-y-2">{signals.slice(0, 20).map(signal => <div key={signal.id} className="rounded-lg border bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><span className="font-medium">{signal.event_type}</span><span className="text-xs uppercase text-muted-foreground">{signal.source_provider}</span></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{signal.evidence}</p></div>)}</div>{signals.length > 20 ? <p className="mt-3 text-sm text-muted-foreground">Mais {signals.length - 20} indícios disponíveis para revisão.</p> : null}</details> : null}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editData ? "Editar Audiência" : "Nova Audiência"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{tiposAudiencia.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data e Hora *</Label>
                <Input type="datetime-local" value={form.data_hora} onChange={(e) => setForm({ ...form, data_hora: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Processo vinculado</Label>
                <Select value={form.processo_id} onValueChange={handleProcessoChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione um processo" /></SelectTrigger>
                  <SelectContent>
                    {processos.map(p => <SelectItem key={p.id} value={p.id}>{p.numero} - {p.cliente_nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Vara/Câmara</Label><Input value={form.vara} onChange={(e) => setForm({ ...form, vara: e.target.value })} /></div>
                <div className="space-y-2"><Label>Magistrado</Label><Input value={form.juiz} onChange={(e) => setForm({ ...form, juiz: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Local</Label><Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editData ? "Atualizar" : "Cadastrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={connectOpen} onOpenChange={open => { setConnectOpen(open); if (!open) setPortalCredentials({ login: "", password: "" }); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Conectar Projudi do tribunal</DialogTitle></DialogHeader>
            <form onSubmit={connectPortal} className="space-y-4">
              <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Acesso protegido</AlertTitle><AlertDescription>A senha é enviada somente à função segura do ADVeyes, validada no tribunal selecionado e armazenada criptografada no Supabase Vault. Cookies da sessão são descartados após a sincronização.</AlertDescription></Alert>
              <div className="space-y-2">
                <Label htmlFor="projudi-court">Tribunal / estado</Label>
                <Select value={selectedPortalCourt} onValueChange={value => { setSelectedPortalCourt(value); setPortalCredentials({ login: "", password: "" }); }}>
                  <SelectTrigger id="projudi-court"><SelectValue placeholder="Selecione o tribunal" /></SelectTrigger>
                  <SelectContent>{(portal?.courts ?? []).map(court => <SelectItem key={court.courtCode} value={court.courtCode}>{court.courtCode} — {court.displayName}{court.authenticatedAvailable ? " · disponível" : " · em homologação"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedCourtEntry && !selectedCourtEntry.authenticatedAvailable && <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>Conector em homologação</AlertTitle><AlertDescription>A cobertura pública DataJud/CNJ deste tribunal já funciona. Login e senha serão liberados somente após a validação do adaptador oficial, sem enviar credenciais ao portal errado.</AlertDescription></Alert>}
              <div className="space-y-2"><Label htmlFor="projudi-login">Login ou CPF/CNPJ</Label><Input id="projudi-login" autoComplete="username" disabled={!selectedCourtEntry?.authenticatedAvailable} value={portalCredentials.login} onChange={event => setPortalCredentials(current => ({ ...current, login: event.target.value }))} required /></div>
              <div className="space-y-2"><Label htmlFor="projudi-password">Senha</Label><Input id="projudi-password" type="password" autoComplete="current-password" disabled={!selectedCourtEntry?.authenticatedAvailable} value={portalCredentials.password} onChange={event => setPortalCredentials(current => ({ ...current, password: event.target.value }))} required /></div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setConnectOpen(false)}>Cancelar</Button><Button type="submit" disabled={portalLoading || !selectedCourtEntry?.authenticatedAvailable}>{portalLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validando no tribunal</> : "Conectar e importar"}</Button></div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir audiência?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desconectar o Projudi de {selectedPortalCourt}?</AlertDialogTitle><AlertDialogDescription>A credencial protegida será removida e as sincronizações automáticas serão interrompidas. As audiências já importadas permanecerão no ADVeyes.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void disconnectPortal()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Desconectar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Audiencias;
