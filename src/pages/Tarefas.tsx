import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, CheckCircle2, Clock, AlertCircle, Trash2, Pencil, LayoutList, Columns3, Calendar, Search, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  prioridade: string;
  status: string;
  data_limite?: string | null;
  processo_id?: string | null;
}

interface Processo {
  id: string;
  numero: string;
  area?: string;
  cliente_id?: string | null;
  cliente_nome?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KANBAN_COLS = [
  { id: "pendente",     label: "A Fazer",    color: "bg-warning/10 text-warning border-warning/20",    dot: "bg-orange-400"  },
  { id: "em_andamento", label: "Fazendo",    color: "bg-info/10 text-info border-info/20",              dot: "bg-blue-400"    },
  { id: "concluída",    label: "Concluída",  color: "bg-success/10 text-success border-success/20",     dot: "bg-green-400"   },
];

const PRIORIDADE_BORDER: Record<string, string> = {
  alta:  "border-l-destructive",
  média: "border-l-primary",
  baixa: "border-l-muted-foreground/30",
};

const PRIORIDADE_BADGE: Record<string, string> = {
  alta:  "bg-red-500/10 text-red-600 border-red-500/20",
  média: "bg-primary/10 text-primary border-primary/20",
  baixa: "bg-muted text-muted-foreground border-muted-foreground/20",
};

const prioridades = ["alta", "média", "baixa"];
const statusList  = ["pendente", "em_andamento", "concluída"];
const statusLabels: Record<string, string> = {
  pendente: "A Fazer",
  em_andamento: "Fazendo",
  concluída: "Concluída",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  const dt = new Date(d + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((dt.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { label: "Hoje", urgent: true };
  if (diff === 1) return { label: "Amanhã", urgent: false };
  if (diff < 0)  return { label: `${Math.abs(diff)}d atrasada`, urgent: true };
  return { label: dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), urgent: false };
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({
  tarefa, processos, onEdit, onDelete, onDragStart,
}: {
  tarefa: Tarefa; processos: Processo[];
  onEdit: (t: Tarefa) => void; onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  const processo = processos.find(p => p.id === tarefa.processo_id);
  const date = fmtDate(tarefa.data_limite);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(tarefa.id)}
      className={`bg-card border border-l-4 ${PRIORIDADE_BORDER[tarefa.prioridade] || "border-l-muted"} rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-snug flex-1">{tarefa.titulo}</p>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onEdit(tarefa)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(tarefa.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {tarefa.descricao && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{tarefa.descricao}</p>
      )}

      {processo && (
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 truncate">
          {processo.numero} · {processo.cliente_nome || processo.area}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-dashed">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${PRIORIDADE_BADGE[tarefa.prioridade]}`}>
          {tarefa.prioridade}
        </span>
        {date && (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${date.urgent ? "text-destructive" : "text-muted-foreground"}`}>
            <Clock className="w-3 h-3" />
            {date.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  col, tarefas, processos, onEdit, onDelete, onDragStart, onDrop, onAdd,
}: {
  col: typeof KANBAN_COLS[0]; tarefas: Tarefa[]; processos: Processo[];
  onEdit: (t: Tarefa) => void; onDelete: (id: string) => void;
  onDragStart: (id: string) => void; onDrop: (colId: string) => void;
  onAdd: (status: string) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`flex flex-col min-h-[500px] rounded-2xl p-3 transition-colors ${over ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(col.id); }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
          <h3 className="text-sm font-semibold">{col.label}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-medium">
            {tarefas.length}
          </span>
        </div>
        <button
          onClick={() => onAdd(col.id)}
          className="w-6 h-6 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {tarefas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
            <LayoutList className="w-8 h-8 mb-2" />
            <p className="text-xs">Sem tarefas aqui</p>
          </div>
        )}
        {tarefas.map(t => (
          <KanbanCard
            key={t.id}
            tarefa={t}
            processos={processos}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Tarefas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tarefas, setTarefas]     = useState<Tarefa[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [view, setView]           = useState<"kanban" | "lista">("kanban");
  const [showForm, setShowForm]   = useState(false);
  const [editData, setEditData]   = useState<Tarefa | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [filterPrioridade, setFilterPrioridade] = useState("Todos");
  const dragId = useRef<string | null>(null);

  const [form, setForm] = useState({
    titulo: "", descricao: "", prioridade: "média",
    status: "pendente", data_limite: "", processo_id: "",
  });

  // ── Fetch ──
  const fetchTarefas = async () => {
    const { data } = await supabase
      .from("tarefas")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTarefas(data);
  };

  const fetchProcessos = async () => {
    const { data } = await supabase
      .from("processos")
      .select("id, numero, area, cliente_id")
      .order("numero");
    // also fetch client names
    if (data) {
      const clientIds = [...new Set(data.map(p => p.cliente_id).filter(Boolean))];
      const clientMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clientes } = await supabase
          .from("clientes")
          .select("id, nome")
          .in("id", clientIds);
        if (clientes) clientes.forEach(c => { clientMap[c.id] = c.nome; });
      }
      setProcessos(data.map(p => ({ ...p, cliente_nome: clientMap[p.cliente_id] || null })));
    }
  };

  useEffect(() => { fetchTarefas(); fetchProcessos(); }, []);

  useEffect(() => {
    if (editData) {
      setForm({
        titulo:      editData.titulo      || "",
        descricao:   editData.descricao   || "",
        prioridade:  editData.prioridade  || "média",
        status:      editData.status      || "pendente",
        data_limite: editData.data_limite || "",
        processo_id: editData.processo_id || "",
      });
    } else {
      setForm({ titulo: "", descricao: "", prioridade: "média", status: "pendente", data_limite: "", processo_id: "" });
    }
  }, [editData, showForm]);

  // ── Form submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) { toast({ title: "Título é obrigatório", variant: "destructive" }); return; }
    setLoading(true);
    const payload = {
      ...form,
      data_limite: form.data_limite || null,
      processo_id: form.processo_id || null,
    };
    if (editData) {
      const { error } = await supabase.from("tarefas").update(payload).eq("id", editData.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Tarefa atualizada!" }); setShowForm(false); fetchTarefas(); }
    } else {
      const { error } = await supabase.from("tarefas").insert({ ...payload, user_id: user!.id });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Tarefa criada!" }); setShowForm(false); fetchTarefas(); }
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("tarefas").delete().eq("id", deleteId);
    toast({ title: "Tarefa excluída!" });
    setDeleteId(null);
    fetchTarefas();
  };

  // ── Drag & Drop ──
  const handleDrop = async (toStatus: string) => {
    if (!dragId.current) return;
    const tarefa = tarefas.find(t => t.id === dragId.current);
    if (!tarefa || tarefa.status === toStatus) return;
    await supabase.from("tarefas").update({ status: toStatus }).eq("id", dragId.current);
    dragId.current = null;
    fetchTarefas();
  };

  // ── Open form helpers ──
  const openNew = (status = "pendente") => {
    setEditData(null);
    setForm(f => ({ ...f, status }));
    setShowForm(true);
  };
  const openEdit = (t: Tarefa) => { setEditData(t); setShowForm(true); };

  // ── Filtered tarefas ──
  const filtered = tarefas.filter(t => {
    const matchSearch = !search ||
      t.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (t.descricao || "").toLowerCase().includes(search.toLowerCase());
    const matchPri = filterPrioridade === "Todos" || t.prioridade === filterPrioridade;
    return matchSearch && matchPri;
  });

  const counts = {
    pendente:     filtered.filter(t => t.status === "pendente").length,
    em_andamento: filtered.filter(t => t.status === "em_andamento").length,
    concluída:    filtered.filter(t => t.status === "concluída").length,
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Tarefas</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestão de tarefas e atividades do escritório</p>
          </div>
          <Button onClick={() => openNew()} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Tarefa
          </Button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {KANBAN_COLS.map(col => (
            <Card key={col.id} className="border-none shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{col.label}</p>
                  <p className="text-2xl font-bold">{counts[col.id as keyof typeof counts]}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Buscar tarefa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Priority filter */}
          <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <Tag className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os tipos</SelectItem>
              {prioridades.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <Columns3 className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => setView("lista")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === "lista" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Lista
            </button>
          </div>
        </div>

        {/* ── KANBAN VIEW ── */}
        {view === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {KANBAN_COLS.map(col => (
              <KanbanColumn
                key={col.id}
                col={col}
                tarefas={filtered.filter(t => t.status === col.id)}
                processos={processos}
                onEdit={openEdit}
                onDelete={setDeleteId}
                onDragStart={id => { dragId.current = id; }}
                onDrop={handleDrop}
                onAdd={openNew}
              />
            ))}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === "lista" && (
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border">
                Nenhuma tarefa encontrada
              </div>
            )}
            {filtered.map(t => {
              const date = fmtDate(t.data_limite);
              const processo = processos.find(p => p.id === t.processo_id);
              return (
                <div
                  key={t.id}
                  className={`bg-card border border-l-4 ${PRIORIDADE_BORDER[t.prioridade] || "border-l-muted"} rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow group`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className={`font-medium text-sm flex-1 ${t.status === "concluída" ? "line-through text-muted-foreground" : ""}`}>
                        {t.titulo}
                      </p>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORIDADE_BADGE[t.prioridade]}`}>
                        {t.prioridade}
                      </Badge>
                    </div>
                    {t.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.descricao}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        t.status === "pendente"     ? "bg-orange-500/10 text-orange-600" :
                        t.status === "em_andamento" ? "bg-blue-500/10 text-blue-600"    :
                                                      "bg-green-500/10 text-green-600"
                      }`}>
                        {statusLabels[t.status]}
                      </span>
                      {processo && (
                        <span className="text-[10px] text-muted-foreground">
                          {processo.numero}
                          {processo.cliente_nome && ` · ${processo.cliente_nome}`}
                        </span>
                      )}
                      {date && (
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${date.urgent ? "text-destructive" : "text-muted-foreground"}`}>
                          <Calendar className="w-3 h-3" /> {date.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── FORM DIALOG ── */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editData ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Descreva a tarefa"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Detalhes adicionais..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={v => setForm({ ...form, prioridade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {prioridades.map(p => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusList.map(s => (
                        <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Processo vinculado</Label>
                <Select value={form.processo_id || "none"} onValueChange={v => setForm({ ...form, processo_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar processo (opcional)" /></SelectTrigger>
                  <SelectContent className="max-h-52">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {processos.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero}{p.cliente_nome ? ` · ${p.cliente_nome}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={form.data_limite}
                  onChange={e => setForm({ ...form, data_limite: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editData ? "Salvar" : "Criar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── DELETE CONFIRM ── */}
        <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppLayout>
  );
};

export default Tarefas;
