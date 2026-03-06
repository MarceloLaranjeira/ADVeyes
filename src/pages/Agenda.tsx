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
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Clock, MapPin, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const tipoOptions = ["audiência", "prazo", "reunião", "despacho", "outro"];

const tipoColors: Record<string, string> = {
  audiência: "border-l-destructive bg-destructive/5",
  prazo: "border-l-[hsl(var(--warning))] bg-[hsl(var(--warning))]/5",
  reunião: "border-l-[hsl(var(--info))] bg-[hsl(var(--info))]/5",
  despacho: "border-l-primary bg-primary/5",
  outro: "border-l-muted-foreground bg-muted/30",
};

const Agenda = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [eventos, setEventos] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", tipo: "reunião", data_inicio: "", hora_inicio: "09:00", local: "",
  });

  const fetchEventos = async () => {
    const { data } = await supabase.from("eventos").select("*").order("data_inicio", { ascending: true });
    if (data) setEventos(data);
  };

  useEffect(() => { fetchEventos(); }, []);

  useEffect(() => {
    if (editData) {
      const d = new Date(editData.data_inicio);
      setForm({
        titulo: editData.titulo || "",
        descricao: editData.descricao || "",
        tipo: editData.tipo || "reunião",
        data_inicio: format(d, "yyyy-MM-dd"),
        hora_inicio: format(d, "HH:mm"),
        local: editData.local || "",
      });
    } else {
      setForm({
        titulo: "", descricao: "", tipo: "reunião",
        data_inicio: format(selectedDate, "yyyy-MM-dd"),
        hora_inicio: "09:00", local: "",
      });
    }
  }, [editData, showForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" });
      return;
    }
    setLoading(true);
    const data_inicio = `${form.data_inicio}T${form.hora_inicio}:00`;

    if (editData) {
      const { error } = await supabase.from("eventos").update({
        titulo: form.titulo, descricao: form.descricao || null, tipo: form.tipo,
        data_inicio, local: form.local || null,
      }).eq("id", editData.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Evento atualizado!" }); setShowForm(false); fetchEventos(); }
    } else {
      const { error } = await supabase.from("eventos").insert({
        titulo: form.titulo, descricao: form.descricao || null, tipo: form.tipo,
        data_inicio, local: form.local || null, user_id: user!.id,
      });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Evento criado!" }); setShowForm(false); fetchEventos(); }
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("eventos").delete().eq("id", deleteId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Evento excluído!" }); fetchEventos(); }
    setDeleteId(null);
  };

  const eventosNoDia = eventos.filter(e => isSameDay(new Date(e.data_inicio), selectedDate));
  const diasComEventos = eventos.map(e => new Date(e.data_inicio));

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Agenda</h1>
            <p className="text-muted-foreground text-sm mt-1">Compromissos e prazos do escritório</p>
          </div>
          <Button onClick={() => { setEditData(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Evento
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card>
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                locale={ptBR}
                className="pointer-events-auto"
                modifiers={{ hasEvent: diasComEventos }}
                modifiersClassNames={{ hasEvent: "bg-primary/20 font-bold" }}
              />
            </CardContent>
          </Card>

          {/* Events list */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold font-serif mb-4">
              {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            {eventosNoDia.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border">
                Nenhum compromisso neste dia
              </div>
            ) : (
              <div className="space-y-3">
                {eventosNoDia.map((e) => (
                  <div key={e.id} className={`p-4 rounded-lg border-l-4 bg-card border ${tipoColors[e.tipo] || tipoColors.outro}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(e.data_inicio), "HH:mm")}
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase font-medium">{e.tipo}</span>
                        </div>
                        <p className="font-medium text-sm">{e.titulo}</p>
                        {e.descricao && <p className="text-xs text-muted-foreground mt-1">{e.descricao}</p>}
                        {e.local && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <MapPin className="w-3 h-3" /> {e.local}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditData(e); setShowForm(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editData ? "Editar Evento" : "Novo Evento"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Audiência - João Silva" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Hora *</Label>
                  <Input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tipoOptions.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Local</Label>
                <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Ex: 1ª Vara Criminal" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes do compromisso..." />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editData ? "Salvar" : "Criar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
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

export default Agenda;
