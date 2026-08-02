/* The generated Supabase types predate the tenant and legal movement migrations. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  FileText,
  Gavel,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProcessoForm } from "@/components/processos/ProcessoForm";
import { ProcessoTimeline } from "@/components/processos/ProcessoTimeline";
import { AreaBadge } from "@/components/common/AreaBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportProcessosPDF } from "@/lib/pdf-export";
import { buildProcessTimeline } from "@/lib/process-timeline";

type RecordRow = Record<string, any>;

const emptyCollections = {
  movements: [] as RecordRow[],
  publications: [] as RecordRow[],
  manual: [] as RecordRow[],
  hearings: [] as RecordRow[],
  finance: [] as RecordRow[],
  documents: [] as RecordRow[],
  hours: [] as RecordRow[],
};

function displayDate(value?: string | null, withTime = false) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return format(parsed, withTime ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy", { locale: ptBR });
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] border-b border-border/60 py-3 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value || "Não informado"}</dd>
    </div>
  );
}

function EmptySection({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">{children}</div>;
}

const ProcessoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [processo, setProcesso] = useState<RecordRow | null>(null);
  const [collections, setCollections] = useState(emptyCollections);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [partialFailure, setPartialFailure] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [manualForm, setManualForm] = useState({ tipo: "Andamento", descricao: "", tribunal: "" });

  const load = useCallback(async () => {
    if (!id || !currentTenant) return;
    setLoading(true);
    setNotFound(false);
    setPartialFailure(false);
    const tenantId = currentTenant.tenantId;
    const processResult = await (supabase as any)
      .from("processos")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();

    if (processResult.error || !processResult.data) {
      setProcesso(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    const current = processResult.data as RecordRow;
    setProcesso(current);
    const queries = await Promise.allSettled([
      (supabase as any).from("process_movements").select("*").eq("tenant_id", tenantId).eq("process_id", id).order("occurred_at", { ascending: false }),
      (supabase as any).from("publicacoes").select("*").eq("tenant_id", tenantId).or(`process_id.eq.${id},numero_processo.eq.${current.numero}`).order("data_publicacao", { ascending: false }),
      (supabase as any).from("andamentos").select("*").eq("tenant_id", tenantId).eq("processo_id", id).order("data_andamento", { ascending: false }),
      (supabase as any).from("audiencias").select("*").eq("tenant_id", tenantId).eq("processo_id", id).order("data_hora", { ascending: true }),
      (supabase as any).from("financeiro").select("*").eq("tenant_id", tenantId).eq("processo_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("documentos").select("*").eq("tenant_id", tenantId).eq("processo_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("time_entries").select("*").eq("tenant_id", tenantId).eq("processo_id", id).order("data", { ascending: false }),
    ]);

    const values = queries.map((result) => {
      if (result.status === "rejected" || result.value.error) return null;
      return result.value.data ?? [];
    });
    setPartialFailure(values.some((value) => value === null));
    setCollections({
      movements: values[0] ?? [],
      publications: values[1] ?? [],
      manual: values[2] ?? [],
      hearings: values[3] ?? [],
      finance: values[4] ?? [],
      documents: values[5] ?? [],
      hours: values[6] ?? [],
    });
    setLoading(false);
  }, [currentTenant, id]);

  useEffect(() => { void load(); }, [load]);

  const timeline = useMemo(() => buildProcessTimeline({
    movements: collections.movements,
    publications: collections.publications,
    manual: collections.manual,
  }), [collections.manual, collections.movements, collections.publications]);

  const financialSummary = useMemo(() => collections.finance.reduce((summary, item) => {
    const value = Number(item.valor || 0);
    summary.total += value;
    if (item.status === "pago") summary.paid += value;
    return summary;
  }, { total: 0, paid: 0 }), [collections.finance]);

  const saveManualMovement = async () => {
    if (!manualForm.descricao.trim() || !processo || !currentTenant || !user) return;
    setSavingMovement(true);
    const { error } = await (supabase as any).from("andamentos").insert({
      tenant_id: currentTenant.tenantId,
      user_id: user.id,
      processo_id: processo.id,
      numero_processo: processo.numero,
      tipo: manualForm.tipo.trim() || "Andamento",
      descricao: manualForm.descricao.trim(),
      tribunal: manualForm.tribunal.trim() || null,
      origem: "manual",
    });
    setSavingMovement(false);
    if (error) {
      toast({ title: "Não foi possível registrar o andamento", description: error.message, variant: "destructive" });
      return;
    }
    setManualForm({ tipo: "Andamento", descricao: "", tribunal: "" });
    toast({ title: "Andamento registrado" });
    await load();
  };

  if (loading) {
    return (
      <AppLayout><div className="space-y-5"><Skeleton className="h-10 w-80" /><Skeleton className="h-28 w-full" /><Skeleton className="h-[440px] w-full" /></div></AppLayout>
    );
  }

  if (notFound || !processo) {
    return (
      <AppLayout>
        <div className="mx-auto mt-16 max-w-xl rounded-2xl border bg-card p-10 text-center shadow-sm">
          <Scale className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Processo não encontrado ou sem acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">O endereço pode estar incorreto ou este processo pertence a outro escritório.</p>
          <Button className="mt-6" onClick={() => navigate("/processos")}>Voltar aos processos</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="-ml-3 mb-2 gap-2 text-muted-foreground" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-xl font-bold tracking-tight sm:text-2xl">{processo.numero}</h1>
              <AreaBadge area={processo.area || "Cível"} />
              <Badge variant="outline">{processo.status || "Em andamento"}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{processo.cliente_nome || "Cliente não identificado"} · {processo.vara || "Vara não informada"}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => exportProcessosPDF([processo as any])}><Download className="h-4 w-4" /> Relatório</Button>
            <Button className="gap-2" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar processo</Button>
          </div>
        </div>

        {partialFailure && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Parte das informações complementares está temporariamente indisponível. O processo e os demais módulos continuam acessíveis.
          </div>
        )}

        <Tabs defaultValue="resumo" className="space-y-6">
          <div className="overflow-x-auto rounded-xl border bg-muted/30 p-1">
            <TabsList className="h-auto min-w-max justify-start bg-transparent">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="andamentos">Andamentos ({timeline.length})</TabsTrigger>
              <TabsTrigger value="partes">Partes</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              <TabsTrigger value="compromissos">Compromissos</TabsTrigger>
              <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
              <TabsTrigger value="prazos">Prazos</TabsTrigger>
              <TabsTrigger value="horas">Horas</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="resumo" className="space-y-8">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="mb-2 flex items-center gap-2"><Gavel className="h-5 w-5 text-primary" /><h2 className="font-semibold">Dados do processo</h2></div>
                <dl><InfoRow label="Processo" value={processo.numero} /><InfoRow label="Natureza" value={processo.area} /><InfoRow label="Status" value={processo.status} /><InfoRow label="Ajuizamento" value={displayDate(processo.data_ajuizamento)} /><InfoRow label="Fonte" value={processo.fonte} /></dl>
              </section>
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="mb-2 flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="font-semibold">Partes e responsável</h2></div>
                <dl><InfoRow label="Cliente" value={processo.cliente_nome} /><InfoRow label="Polo ativo" value={processo.polo_ativo} /><InfoRow label="Polo passivo" value={processo.polo_passivo} /><InfoRow label="Advogado" value={processo.advogado} /><InfoRow label="Vara" value={processo.vara} /></dl>
              </section>
            </div>
            {processo.descricao && <section className="rounded-2xl border bg-card p-5 text-sm leading-6 shadow-sm"><h2 className="mb-2 font-semibold">Observações</h2><p className="whitespace-pre-wrap text-muted-foreground">{processo.descricao}</p></section>}
            <section>
              <div className="mb-5 text-center"><h2 className="text-xl font-semibold">Timeline do processo</h2><p className="mt-1 text-sm text-muted-foreground">Publicações, movimentações oficiais e registros do escritório</p></div>
              <ProcessoTimeline events={timeline} previewLimit={5} />
            </section>
          </TabsContent>

          <TabsContent value="andamentos" className="space-y-6">
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /><h2 className="font-semibold">Registrar andamento do escritório</h2></div>
              <div className="grid gap-3 md:grid-cols-3"><div><Label>Tipo</Label><Input className="mt-1.5" value={manualForm.tipo} onChange={(event) => setManualForm((current) => ({ ...current, tipo: event.target.value }))} /></div><div><Label>Tribunal</Label><Input className="mt-1.5" placeholder="Opcional" value={manualForm.tribunal} onChange={(event) => setManualForm((current) => ({ ...current, tribunal: event.target.value }))} /></div><div className="md:col-span-3"><Label>Descrição</Label><Textarea className="mt-1.5" value={manualForm.descricao} onChange={(event) => setManualForm((current) => ({ ...current, descricao: event.target.value }))} /></div></div>
              <div className="mt-3 text-right"><Button onClick={saveManualMovement} disabled={savingMovement || !manualForm.descricao.trim()}>{savingMovement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar</Button></div>
            </section>
            <ProcessoTimeline events={timeline} />
          </TabsContent>

          <TabsContent value="partes"><div className="grid gap-4 md:grid-cols-2"><section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Polo ativo</h2><p className="mt-3 text-sm text-muted-foreground">{processo.polo_ativo || processo.cliente_nome || "Não informado"}</p></section><section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Polo passivo</h2><p className="mt-3 text-sm text-muted-foreground">{processo.polo_passivo || "Não informado"}</p></section></div></TabsContent>

          <TabsContent value="financeiro" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-card p-5"><DollarSign className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Total lançado</p><p className="text-xl font-semibold">R$ {financialSummary.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div><div className="rounded-2xl border bg-card p-5"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><p className="mt-3 text-xs text-muted-foreground">Recebido</p><p className="text-xl font-semibold">R$ {financialSummary.paid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div><div className="rounded-2xl border bg-card p-5"><Clock3 className="h-5 w-5 text-amber-500" /><p className="mt-3 text-xs text-muted-foreground">Pendente</p><p className="text-xl font-semibold">R$ {(financialSummary.total - financialSummary.paid).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div></div>
            {collections.finance.length === 0 ? <EmptySection>Nenhum lançamento financeiro vinculado.</EmptySection> : collections.finance.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border bg-card p-4"><div><p className="font-medium">{item.descricao}</p><p className="text-xs text-muted-foreground">Vencimento: {displayDate(item.data_vencimento)}</p></div><div className="text-right"><p className="font-semibold">R$ {Number(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><Badge variant="outline">{item.status}</Badge></div></div>)}
          </TabsContent>

          <TabsContent value="compromissos" className="space-y-3">{collections.hearings.length === 0 ? <EmptySection>Nenhuma audiência ou compromisso vinculado.</EmptySection> : collections.hearings.map((item) => <div key={item.id} className="rounded-xl border border-l-4 border-l-violet-500 bg-card p-4"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-violet-500" /><p className="font-medium">{item.tipo}</p></div><p className="mt-2 text-sm text-muted-foreground">{displayDate(item.data_hora, true)} · {item.local || "Local não informado"}</p></div>)}</TabsContent>
          <TabsContent value="tarefas"><EmptySection>As tarefas gerais ainda não possuem vínculo técnico com um processo. Os prazos sugeridos pelas publicações aparecem na aba Prazos.</EmptySection></TabsContent>
          <TabsContent value="prazos" className="space-y-3">{collections.publications.filter((item) => item.possible_deadline || item.data_prazo).length === 0 ? <EmptySection>Nenhum prazo identificado para revisão.</EmptySection> : collections.publications.filter((item) => item.possible_deadline || item.data_prazo).map((item) => <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-medium text-amber-900">{item.tipo || "Possível prazo"}</p><p className="mt-1 text-sm text-amber-800">Prazo sugerido: {displayDate(item.data_prazo)}</p></div>)}</TabsContent>
          <TabsContent value="horas" className="space-y-3">{collections.hours.length === 0 ? <EmptySection>Nenhuma hora trabalhada vinculada.</EmptySection> : collections.hours.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border bg-card p-4"><div><p className="font-medium">{item.descricao}</p><p className="text-xs text-muted-foreground">{displayDate(item.data)} · {item.categoria}</p></div><p className="font-semibold">{Number(item.horas || 0).toLocaleString("pt-BR")} h</p></div>)}</TabsContent>
          <TabsContent value="documentos" className="space-y-3">{collections.documents.length === 0 ? <EmptySection>Nenhum documento vinculado.</EmptySection> : collections.documents.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border bg-card p-4"><FileText className="h-5 w-5 text-primary" /><div><p className="font-medium">{item.nome}</p><p className="text-xs text-muted-foreground">{item.tipo} · {displayDate(item.created_at, true)}</p></div></div>)}</TabsContent>
        </Tabs>

        <ProcessoForm open={editing} onOpenChange={setEditing} onSuccess={load} editData={processo} />
      </div>
    </AppLayout>
  );
};

export default ProcessoDetalhe;
