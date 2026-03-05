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
import { DollarSign, TrendingUp, TrendingDown, Clock, Plus, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const tipos = ["Todos", "honorario", "despesa", "custas"];
const statusList = ["Todos", "pendente", "pago", "atrasado"];

const Financeiro = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [registros, setRegistros] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [form, setForm] = useState({
    tipo: "honorario", descricao: "", valor: "", data_vencimento: "", status: "pendente",
  });

  const fetchData = async () => {
    const { data } = await supabase.from("financeiro").select("*").order("created_at", { ascending: false });
    if (data) setRegistros(data);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = registros.filter((r) => {
    const matchTipo = filterTipo === "Todos" || r.tipo === filterTipo;
    const matchStatus = filterStatus === "Todos" || r.status === filterStatus;
    const matchDateFrom = !filterDateFrom || new Date(r.created_at) >= new Date(filterDateFrom);
    const matchDateTo = !filterDateTo || new Date(r.created_at) <= new Date(filterDateTo + "T23:59:59");
    return matchTipo && matchStatus && matchDateFrom && matchDateTo;
  });

  const totalRecebido = filtered.filter(r => r.status === "pago").reduce((s, r) => s + Number(r.valor), 0);
  const totalPendente = filtered.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.valor), 0);
  const totalAtrasado = filtered.filter(r => r.status === "atrasado").reduce((s, r) => s + Number(r.valor), 0);

  const chartData = useMemo(() => {
    const months: Record<string, { mes: string; receitas: number; despesas: number }> = {};
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    filtered.forEach((r) => {
      const date = new Date(r.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[date.getMonth()]}/${date.getFullYear()}`;
      if (!months[key]) months[key] = { mes: label, receitas: 0, despesas: 0 };
      if (r.tipo === "honorario") months[key].receitas += Number(r.valor);
      else months[key].despesas += Number(r.valor);
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([, v]) => v);
  }, [filtered]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("financeiro").insert({
      ...form, valor: parseFloat(form.valor), user_id: user!.id,
      data_vencimento: form.data_vencimento || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lançamento registrado!" });
      setForm({ tipo: "honorario", descricao: "", valor: "", data_vencimento: "", status: "pendente" });
      setShowForm(false);
      fetchData();
    }
    setLoading(false);
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-serif">Financeiro</h1>
            <p className="text-muted-foreground text-sm mt-1">Controle de honorários e pagamentos</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Lançamento
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total Geral</p><p className="text-xl font-bold">{formatCurrency(totalRecebido + totalPendente + totalAtrasado)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-[hsl(var(--success))]" /></div>
            <div><p className="text-xs text-muted-foreground">Recebido</p><p className="text-xl font-bold text-[hsl(var(--success))]">{formatCurrency(totalRecebido)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center"><Clock className="w-5 h-5 text-[hsl(var(--warning))]" /></div>
            <div><p className="text-xs text-muted-foreground">Pendente</p><p className="text-xl font-bold text-[hsl(var(--warning))]">{formatCurrency(totalPendente)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Atrasado</p><p className="text-xl font-bold text-destructive">{formatCurrency(totalAtrasado)}</p></div>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[160px]"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os tipos</SelectItem>
              <SelectItem value="honorario">Honorário</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
              <SelectItem value="custas">Custas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="w-[150px]" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          <Input type="date" className="w-[150px]" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>

        {/* Chart */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold font-serif mb-4">Evolução Mensal</h3>
            {chartData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhum dado para exibir no gráfico</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Valor</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Vencimento</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum lançamento encontrado</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm capitalize">{r.tipo}</td>
                  <td className="p-4 text-sm">{r.descricao}</td>
                  <td className="p-4 text-sm font-medium">{formatCurrency(Number(r.valor))}</td>
                  <td className="p-4 text-sm text-muted-foreground">{r.data_vencimento || "—"}</td>
                  <td className="p-4">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      r.status === "pago" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" :
                      r.status === "atrasado" ? "bg-destructive/10 text-destructive" :
                      "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                    }`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Lançamento Financeiro</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="honorario">Honorário</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="custas">Custas Processuais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do lançamento" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" required />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento</Label>
                  <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Registrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Financeiro;
