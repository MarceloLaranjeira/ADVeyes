import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, TrendingUp, Phone, Mail, Calendar,
  ArrowRight, Star, CheckCircle2, XCircle, Clock,
  Search, Filter, UserCheck, DollarSign, Funnel,
} from "lucide-react";

const statusFunil = [
  { id: "novo", label: "Novo Lead", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  { id: "contato", label: "Em Contato", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  { id: "proposta", label: "Proposta Enviada", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  { id: "negociacao", label: "Em Negociação", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  { id: "convertido", label: "Convertido", color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  { id: "perdido", label: "Perdido", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
];

const origens = ["indicacao", "site", "instagram", "facebook", "google", "linkedin", "oab", "outro"];
const areas = ["Cível", "Criminal", "Trabalhista", "Família", "Empresarial", "Tributário", "Previdenciário", "Outro"];

const CRM = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Record<string, any>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", origem: "indicacao",
    area_interesse: "", descricao: "", status: "novo", prioridade: "media",
    valor_estimado: "", data_contato: new Date().toISOString().slice(0, 10),
    proximo_contato: "", observacoes: "",
  });

  const fetchLeads = async () => {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (data) setLeads(data);
  };

  useEffect(() => { fetchLeads(); }, []);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchStatus = filterStatus === "todos" || l.status === filterStatus;
      const matchSearch = !search || l.nome.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [leads, filterStatus, search]);

  const kanbanCols = useMemo(() => {
    return statusFunil.map((col) => ({
      ...col,
      items: filtered.filter((l) => l.status === col.id),
    }));
  }, [filtered]);

  const totalValorPipeline = leads.filter((l) => !["convertido", "perdido"].includes(l.status))
    .reduce((s, l) => s + Number(l.valor_estimado || 0), 0);
  const totalConvertidos = leads.filter((l) => l.status === "convertido").length;
  const taxaConversao = leads.length > 0 ? Math.round((totalConvertidos / leads.length) * 100) : 0;

  const resetForm = () => {
    setForm({ nome: "", email: "", telefone: "", origem: "indicacao", area_interesse: "", descricao: "", status: "novo", prioridade: "media", valor_estimado: "", data_contato: new Date().toISOString().slice(0, 10), proximo_contato: "", observacoes: "" });
    setEditLead(null);
  };

  const openEdit = (lead: Record<string, any>) => {
    setForm({
      nome: lead.nome || "", email: lead.email || "", telefone: lead.telefone || "",
      origem: lead.origem || "indicacao", area_interesse: lead.area_interesse || "",
      descricao: lead.descricao || "", status: lead.status || "novo",
      prioridade: lead.prioridade || "media", valor_estimado: lead.valor_estimado || "",
      data_contato: lead.data_contato || new Date().toISOString().slice(0, 10),
      proximo_contato: lead.proximo_contato || "", observacoes: lead.observacoes || "",
    });
    setEditLead(lead);
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
      ...form,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      proximo_contato: form.proximo_contato || null,
      user_id: user!.id,
    };
    const { error } = editLead
      ? await supabase.from("leads").update(payload).eq("id", editLead.id)
      : await supabase.from("leads").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editLead ? "Lead atualizado!" : "Lead cadastrado!" });
      resetForm();
      setShowForm(false);
      fetchLeads();
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("leads").update({ status }).eq("id", id);
    fetchLeads();
    toast({ title: `Status atualizado para "${statusFunil.find(s => s.id === status)?.label}"` });
  };

  const convertToClient = async (lead: Record<string, any>) => {
    const { data, error } = await supabase.from("clientes").insert({
      nome: lead.nome, email: lead.email, telefone: lead.telefone,
      observacoes: `Convertido do CRM. Origem: ${lead.origem}. ${lead.descricao || ""}`,
      user_id: user!.id,
    }).select().single();
    if (!error && data) {
      await supabase.from("leads").update({ status: "convertido", convertido: true, cliente_id: data.id }).eq("id", lead.id);
      toast({ title: "Lead convertido em cliente!", description: `${lead.nome} foi adicionado como cliente.` });
      fetchLeads();
    }
  };

  const getPrioridadeColor = (p: string) => {
    if (p === "alta") return "text-red-600";
    if (p === "media") return "text-yellow-600";
    return "text-green-600";
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">CRM — Captação de Clientes</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie leads e converta em clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" onClick={() => setViewMode("kanban")}>Kanban</Button>
            <Button variant={viewMode === "lista" ? "default" : "outline"} size="sm" onClick={() => setViewMode("lista")}>Lista</Button>
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2 ml-2">
              <Plus className="w-4 h-4" /> Novo Lead
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total de Leads</p><p className="text-2xl font-bold">{leads.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center"><UserCheck className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Convertidos</p><p className="text-2xl font-bold text-green-600">{totalConvertidos}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-xs text-muted-foreground">Taxa de Conversão</p><p className="text-2xl font-bold text-purple-600">{taxaConversao}%</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center"><DollarSign className="w-5 h-5 text-yellow-600" /></div>
            <div><p className="text-xs text-muted-foreground">Pipeline (R$)</p><p className="text-xl font-bold text-yellow-600">{formatCurrency(totalValorPipeline)}</p></div>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar lead..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {statusFunil.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban View */}
        {viewMode === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {kanbanCols.map((col) => (
              <div key={col.id} className="min-w-[260px] max-w-[280px] flex-shrink-0">
                <div className={`flex items-center justify-between p-3 rounded-t-lg border-b-2 ${col.border} bg-card`}>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${col.color}`}>{col.label}</span>
                  <span className="text-xs text-muted-foreground font-medium">{col.items.length}</span>
                </div>
                <div className="space-y-2 pt-2 min-h-[100px]">
                  {col.items.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => openEdit(lead)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-semibold truncate flex-1">{lead.nome}</p>
                        <Star className={`w-3 h-3 shrink-0 ml-1 ${getPrioridadeColor(lead.prioridade)}`} />
                      </div>
                      {lead.area_interesse && <p className="text-xs text-muted-foreground">{lead.area_interesse}</p>}
                      {lead.valor_estimado && <p className="text-xs font-medium text-green-600 mt-1">{formatCurrency(Number(lead.valor_estimado))}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">{lead.origem}</span>
                        {lead.proximo_contato && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(lead.proximo_contato + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        )}
                      </div>
                      {/* Quick status move */}
                      {col.id !== "convertido" && col.id !== "perdido" && (
                        <div className="flex gap-1 mt-2 pt-2 border-t">
                          {col.id !== "convertido" && (
                            <button
                              onClick={(ev) => { ev.stopPropagation(); convertToClient(lead); }}
                              className="flex-1 text-[10px] bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 rounded px-1 py-1 hover:bg-green-100 transition-colors flex items-center justify-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" /> Converter
                            </button>
                          )}
                          <button
                            onClick={(ev) => { ev.stopPropagation(); updateStatus(lead.id, "perdido"); }}
                            className="flex-1 text-[10px] bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 rounded px-1 py-1 hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-3 h-3" /> Perder
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {col.items.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground/50 border-2 border-dashed rounded-lg">
                      Nenhum lead
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lista View */}
        {viewMode === "lista" && (
          <div className="bg-card rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Lead</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Contato</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Área</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Origem</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Valor Est.</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Próx. Contato</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nenhum lead encontrado
                  </td></tr>
                )}
                {filtered.map((lead) => {
                  const st = statusFunil.find((s) => s.id === lead.status);
                  return (
                    <tr key={lead.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => openEdit(lead)}>
                      <td className="p-3">
                        <p className="text-sm font-semibold">{lead.nome}</p>
                        <p className="text-xs text-muted-foreground">{lead.descricao?.slice(0, 40)}</p>
                      </td>
                      <td className="p-3">
                        {lead.telefone && <p className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" />{lead.telefone}</p>}
                        {lead.email && <p className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</p>}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.area_interesse || "—"}</td>
                      <td className="p-3"><span className="text-xs capitalize bg-muted px-2 py-0.5 rounded">{lead.origem}</span></td>
                      <td className="p-3 text-sm font-medium text-green-600">{lead.valor_estimado ? formatCurrency(Number(lead.valor_estimado)) : "—"}</td>
                      <td className="p-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st?.color || ""}`}>{st?.label || lead.status}</span></td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {lead.proximo_contato ? new Date(lead.proximo_contato + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-3">
                        {!lead.convertido && lead.status !== "perdido" && (
                          <Button size="sm" variant="ghost" className="text-green-600 h-7 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); convertToClient(lead); }}>
                            <UserCheck className="w-3 h-3" /> Converter
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editLead ? "Editar Lead" : "Novo Lead"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" required />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{origens.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Área de Interesse</Label>
                  <Select value={form.area_interesse} onValueChange={(v) => setForm({ ...form, area_interesse: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statusFunil.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor Estimado (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_estimado} onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })} placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label>Data do Contato</Label>
                  <Input type="date" value={form.data_contato} onChange={(e) => setForm({ ...form, data_contato: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Próximo Contato</Label>
                  <Input type="date" value={form.proximo_contato} onChange={(e) => setForm({ ...form, proximo_contato: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Descrição do Caso</Label>
                  <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva brevemente o caso ou necessidade..." rows={3} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Observações Internas</Label>
                  <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Notas internas sobre este lead..." rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editLead ? "Atualizar" : "Cadastrar Lead"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CRM;
