import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Gavel, MapPin, Clock, User, Plus, Pencil, Trash2, Download } from "lucide-react";
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

const tiposAudiencia = ["Instrução e Julgamento", "Custódia", "Conciliação", "Júri Popular", "Sustentação Oral", "Justificação", "Admonitória"];
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
  const { toast } = useToast();
  const [audiencias, setAudiencias] = useState<any[]>([]);
  const [processos, setProcessos] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const [{ data: aud }, { data: proc }] = await Promise.all([
      supabase.from("audiencias").select("*").order("data_hora", { ascending: true }),
      supabase.from("processos").select("id, numero, cliente_nome"),
    ]);
    if (aud) setAudiencias(aud);
    if (proc) setProcessos(proc);
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (a: any) => {
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
    setLoading(true);
    const payload = {
      ...form, user_id: user!.id,
      processo_id: form.processo_id || null,
    };
    const { error } = editData
      ? await supabase.from("audiencias").update(payload).eq("id", editData.id)
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
    if (!deleteId) return;
    const { error } = await supabase.from("audiencias").delete().eq("id", deleteId);
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
            <h1 className="text-3xl font-bold font-serif">Audiências</h1>
            <p className="text-muted-foreground text-sm mt-1">Controle de audiências e sessões de julgamento</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportAudienciasPDF(audiencias)} className="gap-2"><Download className="w-4 h-4" /> PDF</Button>
            <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova Audiência</Button>
          </div>
        </div>

        <div className="space-y-4">
          {audiencias.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhuma audiência cadastrada</p>}
          {audiencias.map((a) => (
            <div key={a.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                    <Gavel className="w-5 h-5 text-primary" />
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
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(a.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>

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
      </div>
    </AppLayout>
  );
};

export default Audiencias;
