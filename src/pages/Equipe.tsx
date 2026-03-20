import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Phone, Mail, Award, Briefcase,
  Clock, DollarSign, TrendingUp, Edit, Trash2,
  UserCheck, Scale,
} from "lucide-react";

const cargos = ["advogado", "estagiario", "paralegal", "administrativo", "socio", "associado", "correspondente"];

const Equipe = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [membros, setMembros] = useState<Record<string, any>[]>([]);
  const [timeEntries, setTimeEntries] = useState<Record<string, any>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editMembro, setEditMembro] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", cargo: "advogado",
    oab: "", valor_hora: "", meta_horas_mes: "160", ativo: true,
  });

  const fetchData = async () => {
    const [membrosRes, timeRes] = await Promise.all([
      (supabase.from as any)("equipe").select("*").order("nome"),
      (supabase.from as any)("time_entries").select("horas, valor_hora, faturado, created_at").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);
    if (membrosRes.data) setMembros(membrosRes.data);
    if (timeRes.data) setTimeEntries(timeRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setForm({ nome: "", email: "", telefone: "", cargo: "advogado", oab: "", valor_hora: "", meta_horas_mes: "160", ativo: true });
    setEditMembro(null);
  };

  const openEdit = (m: Record<string, any>) => {
    setForm({
      nome: m.nome || "", email: m.email || "", telefone: m.telefone || "",
      cargo: m.cargo || "advogado", oab: m.oab || "",
      valor_hora: m.valor_hora || "", meta_horas_mes: m.meta_horas_mes || "160",
      ativo: m.ativo !== false,
    });
    setEditMembro(m);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setLoading(true);
    const payload = {
      nome: form.nome, email: form.email || null, telefone: form.telefone || null,
      cargo: form.cargo, oab: form.oab || null,
      valor_hora: form.valor_hora ? parseFloat(form.valor_hora) : null,
      meta_horas_mes: form.meta_horas_mes ? parseFloat(form.meta_horas_mes) : 160,
      ativo: form.ativo, user_id: user!.id,
    };
    const { error } = editMembro
      ? await supabase.from("equipe").update(payload).eq("id", editMembro.id)
      : await supabase.from("equipe").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editMembro ? "Membro atualizado!" : "Membro cadastrado!" });
      resetForm();
      setShowForm(false);
      fetchData();
    }
    setLoading(false);
  };

  const deleteMembro = async (id: string) => {
    if (!confirm("Remover este membro da equipe?")) return;
    await supabase.from("equipe").delete().eq("id", id);
    toast({ title: "Membro removido" });
    fetchData();
  };

  const totalHorasMes = timeEntries.reduce((s, e) => s + Number(e.horas), 0);
  const totalFaturadoMes = timeEntries.filter((e) => e.faturado).reduce((s, e) => s + Number(e.horas) * Number(e.valor_hora || 0), 0);

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getCargoColor = (cargo: string) => {
    const map: Record<string, string> = {
      socio: "bg-primary/10 text-primary", advogado: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
      estagiario: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
      paralegal: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300",
      administrativo: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
      associado: "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300",
      correspondente: "bg-gray-50 text-gray-700 dark:bg-gray-950/30 dark:text-gray-300",
    };
    return map[cargo] || "bg-muted text-muted-foreground";
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Gestão de Equipe</h1>
            <p className="text-muted-foreground text-sm mt-1">Advogados, estagiários e colaboradores do escritório</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Membro
          </Button>
        </div>

        {/* KPIs do mês */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Membros Ativos</p><p className="text-2xl font-bold">{membros.filter((m) => m.ativo).length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center"><Scale className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Advogados</p><p className="text-2xl font-bold">{membros.filter((m) => ["advogado", "socio", "associado"].includes(m.cargo)).length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center"><Clock className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Horas/Mês</p><p className="text-2xl font-bold">{totalHorasMes.toFixed(0)}h</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center"><DollarSign className="w-5 h-5 text-yellow-600" /></div>
            <div><p className="text-xs text-muted-foreground">Faturado/Mês</p><p className="text-xl font-bold text-yellow-600">{formatCurrency(totalFaturadoMes)}</p></div>
          </CardContent></Card>
        </div>

        {/* Cards da equipe */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {membros.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum membro cadastrado</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Cadastrar primeiro membro
              </Button>
            </div>
          )}
          {membros.map((m) => (
            <Card key={m.id} className={`${!m.ativo ? "opacity-60" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                      {m.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{m.nome}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${getCargoColor(m.cargo)}`}>{m.cargo}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(m)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => deleteMembro(m.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  {m.oab && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Award className="w-3.5 h-3.5 shrink-0" />
                      <span>OAB: {m.oab}</span>
                    </div>
                  )}
                  {m.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{m.email}</span>
                    </div>
                  )}
                  {m.telefone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{m.telefone}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
                  <div className="text-center p-2 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground">Valor/Hora</p>
                    <p className="text-sm font-bold">{m.valor_hora ? formatCurrency(Number(m.valor_hora)) : "—"}</p>
                  </div>
                  <div className="text-center p-2 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground">Meta/Mês</p>
                    <p className="text-sm font-bold">{m.meta_horas_mes || 160}h</p>
                  </div>
                </div>

                {!m.ativo && (
                  <div className="mt-3 text-center">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Inativo</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) resetForm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editMembro ? "Editar Membro" : "Novo Membro da Equipe"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do membro" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select value={form.cargo} onValueChange={(v) => setForm({ ...form, cargo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{cargos.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nº OAB</Label>
                  <Input value={form.oab} onChange={(e) => setForm({ ...form, oab: e.target.value })} placeholder="Ex: 123456/SP" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@escritorio.com" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor/Hora (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_hora} onChange={(e) => setForm({ ...form, valor_hora: e.target.value })} placeholder="Ex: 300,00" />
                </div>
                <div className="space-y-2">
                  <Label>Meta de Horas/Mês</Label>
                  <Input type="number" value={form.meta_horas_mes} onChange={(e) => setForm({ ...form, meta_horas_mes: e.target.value })} placeholder="160" />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} id="ativo" />
                <Label htmlFor="ativo" className="cursor-pointer">Membro ativo</Label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editMembro ? "Atualizar" : "Cadastrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Equipe;
