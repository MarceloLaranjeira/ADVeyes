import { useState, useEffect } from "react";
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
import { Plus, CheckCircle2, Clock, AlertCircle, Trash2, Pencil, ListTodo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const prioridades = ["alta", "média", "baixa"];
const statusList = ["pendente", "em_andamento", "concluída"];

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluída: "Concluída",
};

const statusColors: Record<string, string> = {
  pendente: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  em_andamento: "bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]",
  concluída: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
};

const Tarefas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [form, setForm] = useState({
    titulo: "", descricao: "", prioridade: "média", status: "pendente", data_limite: "",
  });

  const fetchTarefas = async () => {
    const { data } = await supabase.from("tarefas").select("*").order("created_at", { ascending: false });
    if (data) setTarefas(data);
  };

  useEffect(() => { fetchTarefas(); }, []);

  useEffect(() => {
    if (editData) {
      setForm({
        titulo: editData.titulo || "",
        descricao: editData.descricao || "",
        prioridade: editData.prioridade || "média",
        status: editData.status || "pendente",
        data_limite: editData.data_limite || "",
      });
    } else {
      setForm({ titulo: "", descricao: "", prioridade: "média", status: "pendente", data_limite: "" });
    }
  }, [editData, showForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) { toast({ title: "Título é obrigatório", variant: "destructive" }); return; }
    setLoading(true);

    const payload = { ...form, data_limite: form.data_limite || null };

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
    const { error } = await supabase.from("tarefas").delete().eq("id", deleteId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Tarefa excluída!" }); fetchTarefas(); }
    setDeleteId(null);
  };

  const toggleStatus = async (tarefa: any) => {
    const next = tarefa.status === "pendente" ? "em_andamento" : tarefa.status === "em_andamento" ? "concluída" : "pendente";
    await supabase.from("tarefas").update({ status: next }).eq("id", tarefa.id);
    fetchTarefas();
  };

  const filtered = tarefas.filter(t => filterStatus === "Todos" || t.status === filterStatus);

  const counts = {
    pendente: tarefas.filter(t => t.status === "pendente").length,
    em_andamento: tarefas.filter(t => t.status === "em_andamento").length,
    concluída: tarefas.filter(t => t.status === "concluída").length,
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Tarefas</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestão de tarefas e atividades do escritório</p>
          </div>
          <Button onClick={() => { setEditData(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Tarefa
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("pendente")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center"><Clock className="w-5 h-5 text-[hsl(var(--warning))]" /></div>
              <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold">{counts.pendente}</p></div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("em_andamento")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--info))]/10 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-[hsl(var(--info))]" /></div>
              <div><p className="text-xs text-muted-foreground">Em Andamento</p><p className="text-2xl font-bold">{counts.em_andamento}</p></div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("concluída")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" /></div>
              <div><p className="text-xs text-muted-foreground">Concluídas</p><p className="text-2xl font-bold">{counts.concluída}</p></div>
            </CardContent>
          </Card>
        </div>

        {filterStatus !== "Todos" && (
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setFilterStatus("Todos")}>← Ver todas</Button>
        )}

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border">Nenhuma tarefa encontrada</div>
          )}
          {filtered.map((t) => (
            <div key={t.id} className="bg-card rounded-lg border p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
              <button onClick={() => toggleStatus(t)} className="shrink-0">
                <CheckCircle2 className={`w-5 h-5 ${t.status === "concluída" ? "text-[hsl(var(--success))]" : "text-muted-foreground/30"}`} />
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${t.status === "concluída" ? "line-through text-muted-foreground" : ""}`}>{t.titulo}</p>
                {t.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.descricao}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${t.prioridade === "alta" ? "bg-destructive/10 text-destructive" : t.prioridade === "baixa" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>{t.prioridade}</span>
                  {t.data_limite && <span className="text-[10px] text-muted-foreground">Prazo: {new Date(t.data_limite).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditData(t); setShowForm(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editData ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>Título *</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Descrição da tarefa" required /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{prioridades.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statusList.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={form.data_limite} onChange={(e) => setForm({ ...form, data_limite: e.target.value })} /></div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editData ? "Salvar" : "Criar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Excluir tarefa?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Tarefas;
