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
  Pencil,
  Scale,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProcessoForm } from "@/components/processos/ProcessoForm";
import {
  AndamentosManuais,
  type AndamentoManual,
} from "@/components/processos/AndamentosManuais";
import { ProcessoTimeline } from "@/components/processos/ProcessoTimeline";
import { AreaBadge } from "@/components/common/AreaBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { exportProcessosPDF } from "@/lib/pdf-export";
import { buildProcessTimeline, isSafeExternalUrl } from "@/lib/process-timeline";

// As tabelas jurídicas ainda não estão nos tipos gerados do Supabase.
// `id` é declarado porque a timeline depende dele como chave estável.
type RecordRow = Record<string, any> & { id: string };

const emptyCollections = {
  movements: [] as RecordRow[],
  publications: [] as RecordRow[],
  manual: [] as RecordRow[],
  hearings: [] as RecordRow[],
  finance: [] as RecordRow[],
  documents: [] as RecordRow[],
  processDocuments: [] as RecordRow[],
  parties: [] as RecordRow[],
  tasks: [] as RecordRow[],
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
  const [processo, setProcesso] = useState<RecordRow | null>(null);
  const [collections, setCollections] = useState(emptyCollections);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [partialFailure, setPartialFailure] = useState(false);
  const [editing, setEditing] = useState(false);
  const tenantId = currentTenant?.tenantId;

  const load = useCallback(async () => {
    if (!id || !tenantId) return;
    setLoading(true);
    setNotFound(false);
    setPartialFailure(false);
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
      (supabase as any).from("process_documents").select("id, process_id, movement_id, document_type, title, text_content, official_url, complementary_url, provider, external_id, occurred_at, mime_type, availability_status, is_public, source_type, source_id, created_at").eq("tenant_id", tenantId).eq("process_id", id).order("occurred_at", { ascending: false }),
      (supabase as any).from("process_parties").select("id, display_name, person_type, document_masked, side, procedural_role, internal_classification, classification_locked, related_lawyers, contact_data, contact_id, contact:clientes!process_parties_tenant_id_contact_id_fkey(nome, cpf, telefone, email, endereco, relationship_type, source_provider)").eq("tenant_id", tenantId).eq("process_id", id).order("display_name", { ascending: true }),
      (supabase as any).from("tarefas").select("*").eq("tenant_id", tenantId).eq("processo_id", id).order("created_at", { ascending: false }),
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
      processDocuments: values[7] ?? [],
      parties: values[8] ?? [],
      tasks: values[9] ?? [],
    });
    setLoading(false);
  }, [id, tenantId]);

  useEffect(() => { void load(); }, [load]);

  const movementEvents = useMemo(() => buildProcessTimeline({
    movements: collections.movements,
    manual: collections.manual,
  }), [collections.manual, collections.movements]);

  const publicationEvents = useMemo(() => buildProcessTimeline({
    publications: collections.publications,
  }), [collections.publications]);

  const allDocuments = useMemo(() => {
    const linkedMovementIds = new Set(
      collections.processDocuments.map((document) => document.movement_id).filter(Boolean),
    );
    return [
    ...collections.processDocuments.map((item) => ({
      ...item,
      display_name: item.title || item.document_type || "Documento processual",
      display_type: item.document_type || "Documento do tribunal",
      display_date: item.occurred_at || item.created_at,
      display_url: item.official_url || item.complementary_url,
      text_content: item.text_content || null,
      source_kind: "tribunal",
    })),
    ...collections.documents.map((item) => ({
      ...item,
      display_name: item.nome || "Documento do escritório",
      display_type: item.tipo || "Documento interno",
      display_date: item.created_at,
      display_url: item.url,
      text_content: item.text_content || item.conteudo || null,
      source_kind: "escritorio",
    })),
    ...collections.movements
      .filter((item) => {
        const searchable = `${item.title || ""} ${item.document_type || ""}`;
        return !linkedMovementIds.has(item.id) && /despach|decis|senten|ac[oó]rd/i.test(searchable);
      })
      .map((item) => ({
        ...item,
        display_name: item.title || "Ato judicial",
        display_type: item.document_type || "Despacho ou decisão",
        display_date: item.occurred_at,
        display_url: item.document_url || item.source_url,
        text_content: [item.content, item.notes].filter(Boolean).join("\n\n"),
        source_kind: "tribunal",
      })),
    ].sort((left, right) =>
      new Date(right.display_date || 0).getTime() - new Date(left.display_date || 0).getTime()
    );
  }, [collections.documents, collections.movements, collections.processDocuments]);

  const financialSummary = useMemo(() => collections.finance.reduce((summary, item) => {
    const value = Number(item.valor || 0);
    summary.total += value;
    if (item.status === "pago") summary.paid += value;
    return summary;
  }, { total: 0, paid: 0 }), [collections.finance]);

  const activePartiesText = useMemo(() => {
    if (processo?.polo_ativo) return processo.polo_ativo;
    const active = collections.parties
      .filter((p) => p.side === "ativo")
      .map((p) => p.display_name);
    return active.length ? active.join(", ") : null;
  }, [collections.parties, processo?.polo_ativo]);

  const passivePartiesText = useMemo(() => {
    if (processo?.polo_passivo) return processo.polo_passivo;
    const passive = collections.parties
      .filter((p) => p.side === "passivo")
      .map((p) => p.display_name);
    return passive.length ? passive.join(", ") : null;
  }, [collections.parties, processo?.polo_passivo]);

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
              <AreaBadge area={processo.area || processo.class_name || "Cível"} />
              <Badge variant="outline">{processo.status || "Em andamento"}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{processo.cliente_nome || "Cliente não identificado"} · {processo.vara || processo.adjudicating_body || "Vara não informada"}</p>
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

        {processo.legal_sync_status === "pending" && !processo.last_legal_sync_at && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <strong>Primeira sincronização oficial na fila.</strong>{" "}
            Tribunal, classe, assuntos, partes e andamentos aparecerão automaticamente após a coleta do DataJud/CNJ. Não é necessário importar novamente.
          </div>
        )}

        <Tabs defaultValue="resumo" className="space-y-6">
          <div className="overflow-x-auto rounded-xl border bg-muted/30 p-1">
            <TabsList className="h-auto min-w-max justify-start bg-transparent">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="andamentos">Andamentos ({movementEvents.length})</TabsTrigger>
              <TabsTrigger value="intimacoes">Intimações ({publicationEvents.length})</TabsTrigger>
              <TabsTrigger value="documentos">Despachos e documentos ({allDocuments.length})</TabsTrigger>
              <TabsTrigger value="compromissos">Audiências ({collections.hearings.length})</TabsTrigger>
              <TabsTrigger value="partes">Partes ({collections.parties.length})</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
              <TabsTrigger value="prazos">Prazos</TabsTrigger>
              <TabsTrigger value="horas">Horas</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="resumo" className="space-y-8">
            {processo.legal_summary_status === "ready" && processo.legal_summary ? (
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Resumo processual</h2>
                  <span className="text-xs text-muted-foreground">
                    {processo.legal_summary_provider === "escavador"
                      ? "Fonte: Escavador"
                      : "Gerado pelo sistema"}
                    {processo.legal_summary_updated_at
                      ? ` · ${displayDate(processo.legal_summary_updated_at, true)}`
                      : ""}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {processo.legal_summary}
                </p>
              </section>
            ) : (
              <section className="rounded-2xl border border-dashed bg-muted/20 p-5">
                <h2 className="font-semibold">Resumo processual</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {processo.legal_summary_status === "processing"
                    ? "O Escavador está elaborando o resumo. O sistema verificará o resultado automaticamente."
                    : processo.legal_summary_status === "failed"
                      ? "A geração não foi concluída e será tentada novamente sem bloquear os demais dados."
                      : "O resumo será solicitado depois que houver conteúdo processual suficiente."}
                </p>
              </section>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="mb-2 flex items-center gap-2"><Gavel className="h-5 w-5 text-primary" /><h2 className="font-semibold">Dados do processo</h2></div>
                <dl><InfoRow label="Processo" value={processo.numero} /><InfoRow label="Tribunal" value={processo.tribunal} /><InfoRow label="Classe" value={processo.class_name || processo.area} /><InfoRow label="Assuntos" value={Array.isArray(processo.subjects) ? processo.subjects.map((subject: { name?: string }) => subject.name).filter(Boolean).join(", ") : null} /><InfoRow label="Órgão julgador" value={processo.adjudicating_body || processo.vara} /><InfoRow label="Sistema" value={processo.procedural_system} /><InfoRow label="Grau" value={processo.court_level} /><InfoRow label="Status" value={processo.status || "Em andamento"} /><InfoRow label="Ajuizamento" value={displayDate(processo.data_ajuizamento || processo.filed_at)} /><InfoRow label="Última sincronização" value={displayDate(processo.last_legal_sync_at, true)} /><InfoRow label="Fonte" value={processo.legal_data_source || processo.fonte || (processo.last_legal_sync_at ? "DataJud/CNJ" : null)} /></dl>
              </section>
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="mb-2 flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="font-semibold">Partes e responsável</h2></div>
                <dl><InfoRow label="Cliente" value={processo.cliente_nome} /><InfoRow label="Polo ativo" value={activePartiesText} /><InfoRow label="Polo passivo" value={passivePartiesText} /><InfoRow label="Advogado" value={processo.advogado} /><InfoRow label="Vara" value={processo.vara || processo.adjudicating_body} /></dl>
              </section>
            </div>
            {processo.descricao && <section className="rounded-2xl border bg-card p-5 text-sm leading-6 shadow-sm"><h2 className="mb-2 font-semibold">Observações</h2><p className="whitespace-pre-wrap text-muted-foreground">{processo.descricao}</p></section>}
            <section>
              <div className="mb-4"><h2 className="text-lg font-semibold">Últimos andamentos</h2><p className="mt-1 text-sm text-muted-foreground">Movimentações oficiais e registros do escritório, em ordem cronológica.</p></div>
              <ProcessoTimeline events={movementEvents} previewLimit={5} />
            </section>
          </TabsContent>

          <TabsContent value="andamentos" className="space-y-6">
            <AndamentosManuais
              tenantId={currentTenant.tenantId}
              processId={processo.id}
              processNumber={processo.numero}
              currentUserId={user?.id ?? null}
              items={collections.manual as AndamentoManual[]}
              onChanged={load}
            />
            <ProcessoTimeline events={movementEvents} />
          </TabsContent>

          <TabsContent value="intimacoes">
            <ProcessoTimeline events={publicationEvents} emptyMessage="Nenhuma intimação ou publicação oficial vinculada." />
          </TabsContent>

          <TabsContent value="partes" className="space-y-3">
            {collections.parties.length === 0 ? <EmptySection>Nenhuma parte processual importada.</EmptySection> : collections.parties.map((party) => (
              <div key={party.id} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <p className="font-medium">{party.display_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{party.procedural_role || "Papel não informado"} · Polo {party.side || "desconhecido"}</p>
                  {party.document_masked && <p className="mt-1 text-xs text-muted-foreground">Documento: {party.document_masked}</p>}
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(party.contact?.telefone || party.contact_data?.phone) && <p>Telefone: {party.contact?.telefone || party.contact_data?.phone}</p>}
                    {(party.contact?.email || party.contact_data?.email) && <p>E-mail: {party.contact?.email || party.contact_data?.email}</p>}
                    {(party.contact?.endereco || party.contact_data?.address) && <p>Endereço: {party.contact?.endereco || party.contact_data?.address}</p>}
                    {!party.contact?.telefone && !party.contact?.email && !party.contact?.endereco && !party.contact_data?.phone && !party.contact_data?.email && !party.contact_data?.address && <p>Dados de contato não disponibilizados pela fonte.</p>}
                  </div>
                  {Array.isArray(party.related_lawyers) && party.related_lawyers.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Advogados relacionados: {party.related_lawyers.map((lawyer: { nome?: string }) => lawyer.nome).filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{String(party.internal_classification || "terceiro").replace("parte_contraria", "parte contrária")}</Badge>
                  {party.contact_id && <Badge variant="secondary">Contato vinculado</Badge>}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-card p-5"><DollarSign className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Total lançado</p><p className="text-xl font-semibold">R$ {financialSummary.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div><div className="rounded-2xl border bg-card p-5"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><p className="mt-3 text-xs text-muted-foreground">Recebido</p><p className="text-xl font-semibold">R$ {financialSummary.paid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div><div className="rounded-2xl border bg-card p-5"><Clock3 className="h-5 w-5 text-amber-500" /><p className="mt-3 text-xs text-muted-foreground">Pendente</p><p className="text-xl font-semibold">R$ {(financialSummary.total - financialSummary.paid).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div></div>
            {collections.finance.length === 0 ? <EmptySection>Nenhum lançamento financeiro vinculado.</EmptySection> : collections.finance.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border bg-card p-4"><div><p className="font-medium">{item.descricao}</p><p className="text-xs text-muted-foreground">Vencimento: {displayDate(item.data_vencimento)}</p></div><div className="text-right"><p className="font-semibold">R$ {Number(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><Badge variant="outline">{item.status}</Badge></div></div>)}
          </TabsContent>

          <TabsContent value="compromissos" className="space-y-3">{collections.hearings.length === 0 ? <EmptySection>Nenhuma audiência vinculada.</EmptySection> : collections.hearings.map((item) => <div key={item.id} className="rounded-xl border border-l-4 border-l-primary bg-card p-4"><div className="flex flex-wrap items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><p className="font-medium">{item.tipo}</p>{item.review_status === "pending" && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">A confirmar</Badge>}</div><p className="mt-2 text-sm text-muted-foreground">{displayDate(item.data_hora, true)} · {item.local || "Local não informado"}</p>{item.source_evidence && <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.source_evidence}</p>}</div>)}</TabsContent>
          <TabsContent value="tarefas" className="space-y-3">{collections.tasks.length === 0 ? <EmptySection>Nenhuma tarefa vinculada.</EmptySection> : collections.tasks.map((item) => <div key={item.id} className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium">{item.titulo}</p><Badge variant="outline">{item.status}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{item.descricao || "Sem descrição"}</p></div>)}</TabsContent>
          <TabsContent value="prazos" className="space-y-3">{collections.publications.filter((item) => item.possible_deadline || item.data_prazo).length === 0 ? <EmptySection>Nenhum prazo identificado para revisão.</EmptySection> : collections.publications.filter((item) => item.possible_deadline || item.data_prazo).map((item) => <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-medium text-amber-900">{item.tipo || "Possível prazo"}</p><p className="mt-1 text-sm text-amber-800">Prazo sugerido: {displayDate(item.data_prazo)}</p></div>)}</TabsContent>
          <TabsContent value="horas" className="space-y-3">{collections.hours.length === 0 ? <EmptySection>Nenhuma hora trabalhada vinculada.</EmptySection> : collections.hours.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border bg-card p-4"><div><p className="font-medium">{item.descricao}</p><p className="text-xs text-muted-foreground">{displayDate(item.data)} · {item.categoria}</p></div><p className="font-semibold">{Number(item.horas || 0).toLocaleString("pt-BR")} h</p></div>)}</TabsContent>
          <TabsContent value="documentos" className="space-y-3">{allDocuments.length === 0 ? <EmptySection>Nenhum despacho ou documento público disponível.</EmptySection> : allDocuments.map((item) => <div key={`${item.source_kind}:${item.id}`} className="flex items-start gap-3 rounded-xl border bg-card p-4"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.display_name}</p><Badge variant="outline">{item.source_kind === "tribunal" ? "Tribunal" : "Escritório"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.display_type} · {displayDate(item.display_date, true)}</p>{item.text_content && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.text_content}</p>}{isSafeExternalUrl(item.display_url) && <a href={item.display_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">Abrir documento oficial</a>}</div></div>)}</TabsContent>
        </Tabs>

        <ProcessoForm open={editing} onOpenChange={setEditing} onSuccess={load} editData={processo} />
      </div>
    </AppLayout>
  );
};

export default ProcessoDetalhe;
