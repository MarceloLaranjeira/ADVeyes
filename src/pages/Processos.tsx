import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AreaBadge } from "@/components/common/AreaBadge";
import {
  Search, Plus, Pencil, Trash2, Filter, Download,
  DollarSign, ChevronRight, X, Clock, FileText,
  Gavel, ListTodo, TrendingUp, Calendar, CircleDot,
  CheckCircle2, AlertCircle, Layers,
} from "lucide-react";
import { exportProcessosPDF } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ProcessoForm } from "@/components/processos/ProcessoForm";
import { HonorarioParcelas } from "@/components/processos/HonorarioParcelas";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const areas   = ["Todas", "Penal", "Cível", "Família", "Execução Penal", "Recurso", "Trabalhista"];
const statuses = ["Todos", "Em andamento", "Aguardando audiência", "Sentença proferida", "Recurso interposto", "Arquivado"];

const TIPO_ANDAMENTO = ["Despacho", "Decisão", "Sentença", "Publicação", "Petição", "Audiência", "Juntada", "Certidão", "Outro"];

function fmtDateTime(dt: string) {
  return new Date(dt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

// ─── Andamento Form Dialog ─────────────────────────────────────────────────────
function AndamentoForm({
  open, onClose, processoId, numeroProcesso, userId, onSuccess,
}: {
  open: boolean; onClose: () => void;
  processoId: string; numeroProcesso: string;
  userId: string; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ tipo: "Despacho", descricao: "", data_andamento: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim()) { toast({ title: "Descrição obrigatória", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await supabase.from("andamentos").insert({
      user_id: userId, processo_id: processoId,
      numero_processo: numeroProcesso,
      tipo: form.tipo, descricao: form.descricao,
      data_andamento: form.data_andamento + "T12:00:00",
      origem: "manual",
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Andamento registrado!" }); onSuccess(); onClose(); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo Andamento</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPO_ANDAMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.data_andamento} onChange={e => setForm({ ...form, data_andamento: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea rows={4} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva o andamento processual..." required />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Registrar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Timeline de andamentos ────────────────────────────────────────────────────
function AndamentosTimeline({ andamentos }: { andamentos: any[] }) {
  if (andamentos.length === 0)
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum andamento registrado</p>;

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-5">
        {andamentos.map((a, i) => (
          <div key={a.id} className="relative">
            <div className={`absolute -left-[21px] w-3.5 h-3.5 rounded-full border-2 border-background ${
              a.tipo === "Sentença" ? "bg-green-500" :
              a.tipo === "Decisão" ? "bg-blue-500" :
              a.tipo === "Audiência" ? "bg-purple-500" :
              a.tipo === "Publicação" ? "bg-orange-500" :
              "bg-primary"
            }`} />
            <div className="bg-muted/30 rounded-xl border p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">{a.tipo}</span>
                  {a.origem !== "manual" && (
                    <Badge variant="outline" className="text-[9px] py-0 h-4">DataJud</Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {fmtDateTime(a.data_andamento)}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{a.descricao}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Processo Detail Drawer ────────────────────────────────────────────────────
function ProcessoDetalhe({
  processo, onClose, onEdit, userId,
}: {
  processo: any; onClose: () => void; onEdit: () => void; userId: string;
}) {
  const [andamentos, setAndamentos]   = useState<any[]>([]);
  const [tarefas, setTarefas]         = useState<any[]>([]);
  const [audiencias, setAudiencias]   = useState<any[]>([]);
  const [financeiro, setFinanceiro]   = useState<any[]>([]);
  const [publicacoes, setPublicacoes] = useState<any[]>([]);
  const [showAndForm, setShowAndForm] = useState(false);
  const { toast } = useToast();

  const fetchAll = async () => {
    const [and, tar, aud, fin, pub] = await Promise.all([
      supabase.from("andamentos").select("*").eq("processo_id", processo.id).order("data_andamento", { ascending: false }),
      supabase.from("tarefas").select("*").eq("processo_id", processo.id).order("data_limite"),
      supabase.from("audiencias").select("*").eq("processo_id", processo.id).order("data_hora", { ascending: false }),
      supabase.from("financeiro").select("*").eq("processo_id", processo.id).order("created_at", { ascending: false }),
      supabase.from("publicacoes").select("*").eq("numero_processo", processo.numero).order("data_publicacao", { ascending: false }).limit(20),
    ]);
    setAndamentos(and.data || []);
    setTarefas(tar.data || []);
    setAudiencias(aud.data || []);
    setFinanceiro(fin.data || []);
    // Merge publicações as andamentos in timeline
    const pubAsAnd = (pub.data || []).map((p: any) => ({
      id: "pub_" + p.id,
      tipo: "Publicação",
      descricao: p.conteudo?.slice(0, 300) || p.tipo,
      data_andamento: p.data_publicacao,
      origem: "diario_oficial",
      tribunal: p.tribunal,
    }));
    setPublicacoes(pubAsAnd);
  };

  useEffect(() => { fetchAll(); }, [processo.id]);

  const allAndamentos = [...andamentos, ...publicacoes].sort(
    (a, b) => new Date(b.data_andamento).getTime() - new Date(a.data_andamento).getTime()
  );

  const totalHonorarios = financeiro.filter(f => f.tipo === "honorario").reduce((s, f) => s + Number(f.valor || 0), 0);
  const totalRecebido   = financeiro.filter(f => f.tipo === "honorario" && f.status === "pago").reduce((s, f) => s + Number(f.valor || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-background border-l shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-sm text-primary font-semibold">{processo.numero}</p>
              <h2 className="text-xl font-bold font-serif mt-0.5">{processo.cliente_nome || "Sem cliente"}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <AreaBadge area={processo.area} />
                <span className="text-xs text-muted-foreground">{processo.status}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              <Button size="icon" variant="ghost" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="resumo" className="p-5">
          <TabsList className="mb-5 flex-wrap h-auto gap-1 bg-muted/50">
            <TabsTrigger value="resumo" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" /> Resumo</TabsTrigger>
            <TabsTrigger value="andamentos" className="gap-1.5 text-xs"><CircleDot className="w-3.5 h-3.5" /> Andamentos <span className="ml-0.5 text-[10px] bg-primary/10 text-primary px-1 rounded">{allAndamentos.length}</span></TabsTrigger>
            <TabsTrigger value="tarefas" className="gap-1.5 text-xs"><ListTodo className="w-3.5 h-3.5" /> Tarefas <span className="ml-0.5 text-[10px] bg-primary/10 text-primary px-1 rounded">{tarefas.length}</span></TabsTrigger>
            <TabsTrigger value="audiencias" className="gap-1.5 text-xs"><Gavel className="w-3.5 h-3.5" /> Audiências <span className="ml-0.5 text-[10px] bg-primary/10 text-primary px-1 rounded">{audiencias.length}</span></TabsTrigger>
            <TabsTrigger value="financeiro" className="gap-1.5 text-xs"><DollarSign className="w-3.5 h-3.5" /> Financeiro <span className="ml-0.5 text-[10px] bg-primary/10 text-primary px-1 rounded">{financeiro.length}</span></TabsTrigger>
          </TabsList>

          {/* === RESUMO === */}
          <TabsContent value="resumo" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Número do Processo", value: processo.numero },
                { label: "Natureza da Ação",   value: processo.area   },
                { label: "Vara / Câmara",       value: processo.vara   || "—" },
                { label: "Advogado Responsável",value: processo.advogado || "—" },
                { label: "Status",              value: processo.status || "—" },
                { label: "Percentual de Êxito", value: processo.percentual_exito ? processo.percentual_exito + "%" : "—" },
              ].map(item => (
                <div key={item.label} className="bg-muted/30 rounded-xl p-3.5 border">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wide">{item.label}</p>
                  <p className="font-medium mt-1 text-sm">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Partes */}
            {(processo.polo_ativo || processo.polo_passivo || processo.descricao) && (
              <div className="space-y-3">
                {processo.polo_ativo && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5">
                    <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Polo Ativo</p>
                    <p className="text-sm">{processo.polo_ativo}</p>
                  </div>
                )}
                {processo.polo_passivo && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3.5">
                    <p className="text-[11px] font-semibold text-destructive uppercase tracking-wide mb-1">Polo Passivo</p>
                    <p className="text-sm">{processo.polo_passivo}</p>
                  </div>
                )}
                {processo.descricao && (
                  <div className="bg-muted/30 rounded-xl p-3.5 border">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Observações</p>
                    <p className="text-sm whitespace-pre-wrap">{processo.descricao}</p>
                  </div>
                )}
              </div>
            )}

            {/* Resumo financeiro */}
            {financeiro.length > 0 && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3.5">
                <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-2">Resumo Financeiro</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-bold text-sm">R$ {totalHonorarios.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recebido</p>
                    <p className="font-bold text-sm text-green-600">R$ {totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pendente</p>
                    <p className="font-bold text-sm text-orange-600">R$ {(totalHonorarios - totalRecebido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* === ANDAMENTOS === */}
          <TabsContent value="andamentos" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{allAndamentos.length} movimentação(ões)</p>
              <Button size="sm" className="gap-1.5" onClick={() => setShowAndForm(true)}>
                <Plus className="w-3.5 h-3.5" /> Registrar
              </Button>
            </div>
            <AndamentosTimeline andamentos={allAndamentos} />
          </TabsContent>

          {/* === TAREFAS === */}
          <TabsContent value="tarefas" className="space-y-2.5">
            {tarefas.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa vinculada</p>
              : tarefas.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${t.status === "concluída" ? "text-green-500" : "text-muted-foreground/30"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${t.status === "concluída" ? "line-through text-muted-foreground" : ""}`}>{t.titulo}</p>
                    {t.data_limite && <p className="text-xs text-muted-foreground mt-0.5">Prazo: {fmtDate(t.data_limite)}</p>}
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${
                    t.prioridade === "alta" ? "border-red-500/30 text-red-600" :
                    t.prioridade === "baixa" ? "" : "border-primary/30 text-primary"
                  }`}>{t.prioridade}</Badge>
                </div>
              ))
            }
          </TabsContent>

          {/* === AUDIÊNCIAS === */}
          <TabsContent value="audiencias" className="space-y-2.5">
            {audiencias.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-8">Nenhuma audiência registrada</p>
              : audiencias.map(a => (
                <div key={a.id} className="p-3.5 rounded-xl border bg-card border-l-4 border-l-purple-500">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{a.tipo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {fmtDateTime(a.data_hora)}
                      </p>
                      {a.local && <p className="text-xs text-muted-foreground mt-0.5">{a.local}</p>}
                    </div>
                    {a.resultado && (
                      <Badge variant="outline" className="text-[10px]">{a.resultado}</Badge>
                    )}
                  </div>
                  {a.descricao && <p className="text-xs text-muted-foreground mt-2">{a.descricao}</p>}
                </div>
              ))
            }
          </TabsContent>

          {/* === FINANCEIRO === */}
          <TabsContent value="financeiro">
            {financeiro.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro financeiro</p>
              : (
                <div className="space-y-2">
                  {financeiro.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border bg-card">
                      <div>
                        <p className="text-sm font-medium">{f.descricao}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {f.tipo} · {f.data_vencimento ? fmtDate(f.data_vencimento) : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">R$ {Number(f.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        <Badge variant="outline" className={`text-[10px] mt-0.5 ${
                          f.status === "pago" ? "border-green-500/30 text-green-600" :
                          f.status === "pendente" ? "border-orange-500/30 text-orange-600" : ""
                        }`}>{f.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </TabsContent>
        </Tabs>
      </div>

      <AndamentoForm
        open={showAndForm}
        onClose={() => setShowAndForm(false)}
        processoId={processo.id}
        numeroProcesso={processo.numero}
        userId={userId}
        onSuccess={fetchAll}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const Processos = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [processos, setProcessos]       = useState<any[]>([]);
  const [search, setSearch]             = useState("");
  const [showForm, setShowForm]         = useState(false);
  const [editData, setEditData]         = useState<any>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [honorarioProcesso, setHonorarioProcesso] = useState<any>(null);
  const [detalheProcesso, setDetalheProcesso]     = useState<any>(null);
  const [filterArea, setFilterArea]     = useState("Todas");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo]     = useState("");

  const fetchProcessos = async () => {
    const { data } = await supabase.from("processos").select("*").order("created_at", { ascending: false });
    if (data) setProcessos(data);
  };

  useEffect(() => { fetchProcessos(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("processos").delete().eq("id", deleteId);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else { toast({ title: "Processo excluído!" }); fetchProcessos(); }
    setDeleteId(null);
  };

  const filtered = processos.filter((p) => {
    const matchSearch = p.numero.toLowerCase().includes(search.toLowerCase()) ||
      (p.cliente_nome || "").toLowerCase().includes(search.toLowerCase());
    const matchArea   = filterArea   === "Todas"  || p.area   === filterArea;
    const matchStatus = filterStatus === "Todos"  || p.status === filterStatus;
    const matchFrom   = !filterDateFrom || new Date(p.created_at) >= new Date(filterDateFrom);
    const matchTo     = !filterDateTo   || new Date(p.created_at) <= new Date(filterDateTo + "T23:59:59");
    return matchSearch && matchArea && matchStatus && matchFrom && matchTo;
  });

  const areaCount = processos.reduce((acc, p) => { acc[p.area] = (acc[p.area] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <AppLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Processos</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerenciamento de processos do escritório</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportProcessosPDF(filtered)} className="gap-2">
              <Download className="w-4 h-4" /> PDF
            </Button>
            <Button onClick={() => { setEditData(null); setShowForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Processo
            </Button>
          </div>
        </div>

        {/* Stats por área */}
        <div className="flex gap-2 flex-wrap mb-5">
          {Object.entries(areaCount).map(([area, cnt]) => (
            <button
              key={area}
              onClick={() => setFilterArea(area === filterArea ? "Todas" : area)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                filterArea === area ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              }`}
            >
              {area} <span className="opacity-70">({cnt as number})</span>
            </button>
          ))}
          {filterArea !== "Todas" && (
            <button onClick={() => setFilterArea("Todas")} className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted text-muted-foreground">
              Limpar filtro ×
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por número ou cliente..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" className="w-[150px]" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          <Input type="date" className="w-[150px]" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Número</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Área</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vara/Câmara</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Advogado</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum processo encontrado</td></tr>
              )}
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setDetalheProcesso(p)}
                >
                  <td className="p-4 text-sm font-mono text-primary">{p.numero}</td>
                  <td className="p-4 text-sm font-medium">{p.cliente_nome}</td>
                  <td className="p-4"><AreaBadge area={p.area} /></td>
                  <td className="p-4 text-sm text-muted-foreground">{p.vara || "—"}</td>
                  <td className="p-4 text-sm">{p.status}</td>
                  <td className="p-4 text-sm text-muted-foreground">{p.advogado || "—"}</td>
                  <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhes" onClick={() => setDetalheProcesso(p)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHonorarioProcesso(p)} title="Honorários">
                        <DollarSign className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditData(p); setShowForm(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Drawer */}
        {detalheProcesso && (
          <ProcessoDetalhe
            processo={detalheProcesso}
            onClose={() => setDetalheProcesso(null)}
            onEdit={() => { setEditData(detalheProcesso); setDetalheProcesso(null); setShowForm(true); }}
            userId={user!.id}
          />
        )}

        <ProcessoForm open={showForm} onOpenChange={setShowForm} onSuccess={fetchProcessos} editData={editData} />

        <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita. O processo será removido permanentemente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!honorarioProcesso} onOpenChange={o => !o && setHonorarioProcesso(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Honorários — {honorarioProcesso?.numero}</DialogTitle></DialogHeader>
            {honorarioProcesso && (
              <HonorarioParcelas
                processoId={honorarioProcesso.id}
                processoNumero={honorarioProcesso.numero}
                clienteNome={honorarioProcesso.cliente_nome}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Processos;
