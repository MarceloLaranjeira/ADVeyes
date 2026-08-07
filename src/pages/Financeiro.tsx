import React, { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
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
  DollarSign, TrendingDown, Clock, Plus, Download,
  Target, BarChart3, PieChart as PieIcon, AlertTriangle,
  CheckCircle2, Receipt, Wallet, Edit, Trash2,
} from "lucide-react";
import { exportFinanceiroPDF } from "@/lib/pdf-export";
import { googleCalendar } from "@/lib/google-calendar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4"];

const tabs = ["Resumo", "Honorários", "Despesas", "P&L", "Metas"];
const categoriaDespesas = ["operacional", "pessoal", "infraestrutura", "marketing", "custas", "impostos", "outros"];

const Financeiro = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("Resumo");
  const [registros, setRegistros] = useState<Record<string, any>[]>([]);
  const [despesasEscritorio, setDespesasEscritorio] = useState<Record<string, any>[]>([]);
  const [metas, setMetas] = useState<Record<string, any>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDespesaForm, setShowDespesaForm] = useState(false);
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(() => googleCalendar.isConnected());
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [form, setForm] = useState({
    tipo: "honorario", descricao: "", valor: "", data_vencimento: "", status: "pendente",
  });
  const [despesaForm, setDespesaForm] = useState({
    descricao: "", categoria: "operacional", valor: "",
    data_competencia: new Date().toISOString().slice(0, 10),
    data_pagamento: "", status: "pendente", recorrente: false,
  });
  const [metaForm, setMetaForm] = useState({
    mes: new Date().getMonth() + 1, ano: new Date().getFullYear(),
    meta_receita: "", meta_novos_clientes: "", meta_horas: "",
  });

  const fetchData = async () => {
    const [finRes, despRes, metaRes] = await Promise.all([
      supabase.from("financeiro").select("*").order("created_at", { ascending: false }),
      (supabase.from as any)("despesas_escritorio").select("*").order("data_competencia", { ascending: false }),
      (supabase.from as any)("metas_financeiras").select("*").order("ano", { ascending: false }).order("mes", { ascending: false }),
    ]);
    if (finRes.data) setRegistros(finRes.data);
    if (despRes.data) setDespesasEscritorio(despRes.data);
    if (metaRes.data) setMetas(metaRes.data);
  };

  useEffect(() => {
    fetchData();
    void googleCalendar.getStatus()
      .then((status) => {
        setGcalConnected(
          status.connected && status.connection?.status === "connected",
        );
      })
      .catch(() => setGcalConnected(false));
  }, []);

  const filtered = registros.filter((r) => {
    const matchTipo = filterTipo === "Todos" || r.tipo === filterTipo;
    const matchStatus = filterStatus === "Todos" || r.status === filterStatus;
    const matchDateFrom = !filterDateFrom || new Date(r.created_at) >= new Date(filterDateFrom);
    const matchDateTo = !filterDateTo || new Date(r.created_at) <= new Date(filterDateTo + "T23:59:59");
    return matchTipo && matchStatus && matchDateFrom && matchDateTo;
  });

  // Financial aggregates
  const totalReceita = registros.filter((r) => r.tipo === "honorario").reduce((s, r) => s + Number(r.valor), 0);
  const totalRecebido = registros.filter((r) => r.status === "pago" && r.tipo === "honorario").reduce((s, r) => s + Number(r.valor), 0);
  const totalPendente = registros.filter((r) => r.status === "pendente").reduce((s, r) => s + Number(r.valor), 0);
  const totalAtrasado = registros.filter((r) => r.status === "atrasado").reduce((s, r) => s + Number(r.valor), 0);
  const totalDespesaProcessual = registros.filter((r) => r.tipo !== "honorario").reduce((s, r) => s + Number(r.valor), 0);
  const totalDespesaOperacional = despesasEscritorio.filter((d) => d.status === "pago").reduce((s, d) => s + Number(d.valor), 0);
  const totalDespesas = totalDespesaProcessual + totalDespesaOperacional;
  const resultadoLiquido = totalRecebido - totalDespesas;

  // Mês atual
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const receitaMes = registros
    .filter((r) => r.tipo === "honorario" && r.status === "pago" && new Date(r.created_at).getMonth() + 1 === mesAtual && new Date(r.created_at).getFullYear() === anoAtual)
    .reduce((s, r) => s + Number(r.valor), 0);
  const despesaMes = despesasEscritorio
    .filter((d) => d.status === "pago" && new Date(d.data_competencia).getMonth() + 1 === mesAtual && new Date(d.data_competencia).getFullYear() === anoAtual)
    .reduce((s, d) => s + Number(d.valor), 0);

  // Meta do mês atual
  const metaMes = metas.find((m) => m.mes === mesAtual && m.ano === anoAtual);
  const progressoMeta = metaMes?.meta_receita ? Math.min(100, Math.round((receitaMes / metaMes.meta_receita) * 100)) : 0;

  // Chart data - monthly P&L
  const plData = useMemo(() => {
    const months: Record<string, { mes: string; receitas: number; despesas: number; resultado: number }> = {};
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    registros.forEach((r) => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      if (!months[key]) months[key] = { mes: label, receitas: 0, despesas: 0, resultado: 0 };
      if (r.tipo === "honorario" && r.status === "pago") months[key].receitas += Number(r.valor);
      else if (r.tipo !== "honorario") months[key].despesas += Number(r.valor);
    });
    despesasEscritorio.forEach((d) => {
      const date = new Date(d.data_competencia);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
      if (!months[key]) months[key] = { mes: label, receitas: 0, despesas: 0, resultado: 0 };
      if (d.status === "pago") months[key].despesas += Number(d.valor);
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([, v]) => ({ ...v, resultado: v.receitas - v.despesas }));
  }, [registros, despesasEscritorio]);

  // Despesas por categoria
  const despPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    despesasEscritorio.forEach((d) => {
      map[d.categoria] = (map[d.categoria] || 0) + Number(d.valor);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [despesasEscritorio]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setLoading(true);
    const payload = { ...form, valor: parseFloat(form.valor), user_id: user!.id, data_vencimento: form.data_vencimento || null };
    const { error } = editItem
      ? await supabase.from("financeiro").update(payload).eq("id", editItem.id)
      : await (async () => {
          const { error } = await supabase.from("financeiro").insert(payload);
          return { error };
        })();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else {
      if (gcalConnected && form.data_vencimento) {
        googleCalendar.requestSync();
      }
      toast({ title: "Lançamento registrado!" });
      setForm({ tipo: "honorario", descricao: "", valor: "", data_vencimento: "", status: "pendente" });
      setShowForm(false);
      setEditItem(null);
      fetchData();
    }
    setLoading(false);
  };

  const handleDespesaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!despesaForm.descricao || !despesaForm.valor) { toast({ title: "Preencha os campos obrigatórios", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await (supabase.from as any)("despesas_escritorio").insert({
      ...despesaForm, valor: parseFloat(despesaForm.valor),
      data_pagamento: despesaForm.data_pagamento || null, user_id: user!.id,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Despesa registrada!" }); setDespesaForm({ descricao: "", categoria: "operacional", valor: "", data_competencia: new Date().toISOString().slice(0, 10), data_pagamento: "", status: "pendente", recorrente: false }); setShowDespesaForm(false); fetchData(); }
    setLoading(false);
  };

  const handleMetaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await (supabase.from as any)("metas_financeiras").upsert({
      mes: metaForm.mes, ano: metaForm.ano,
      meta_receita: parseFloat(metaForm.meta_receita) || 0,
      meta_novos_clientes: parseInt(metaForm.meta_novos_clientes) || 0,
      meta_horas: parseInt(metaForm.meta_horas) || 0,
      user_id: user!.id,
    }, { onConflict: "user_id,mes,ano" });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Meta salva!" }); setShowMetaForm(false); fetchData(); }
    setLoading(false);
  };

  const marcarPago = async (id: string) => {
    await supabase.from("financeiro").update({ status: "pago" }).eq("id", id);
    toast({ title: "Marcado como pago!" });
    fetchData();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    await supabase.from("financeiro").delete().eq("id", id);
    if (gcalConnected) googleCalendar.requestSync();
    fetchData();
  };

  const formatPct = (v: number) => `${v}%`;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Financeiro</h1>
            <p className="text-muted-foreground text-sm mt-1">Controle completo de receitas, despesas e metas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportFinanceiroPDF(filtered as any, { recebido: totalRecebido, pendente: totalPendente, atrasado: totalAtrasado })} className="gap-2">
              <Download className="w-4 h-4" /> PDF
            </Button>
            <Button variant="outline" onClick={() => setShowDespesaForm(true)} className="gap-2">
              <Receipt className="w-4 h-4" /> Despesa
            </Button>
            <Button onClick={() => { setEditItem(null); setShowForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Honorário
            </Button>
          </div>
        </div>

        {/* Main KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
          <Card className="col-span-1"><CardContent className="p-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2"><DollarSign className="w-4 h-4 text-primary" /></div>
            <p className="text-xs text-muted-foreground">Receita Total</p>
            <p className="text-lg font-bold">{formatCurrency(totalReceita)}</p>
          </CardContent></Card>
          <Card className="col-span-1"><CardContent className="p-4">
            <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center mb-2"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalRecebido)}</p>
          </CardContent></Card>
          <Card className="col-span-1"><CardContent className="p-4">
            <div className="w-9 h-9 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center mb-2"><Clock className="w-4 h-4 text-yellow-600" /></div>
            <p className="text-xs text-muted-foreground">A Receber</p>
            <p className="text-lg font-bold text-yellow-600">{formatCurrency(totalPendente)}</p>
          </CardContent></Card>
          <Card className="col-span-1"><CardContent className="p-4">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center mb-2"><AlertTriangle className="w-4 h-4 text-destructive" /></div>
            <p className="text-xs text-muted-foreground">Atrasado</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalAtrasado)}</p>
          </CardContent></Card>
          <Card className="col-span-1"><CardContent className="p-4">
            <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-2"><TrendingDown className="w-4 h-4 text-red-500" /></div>
            <p className="text-xs text-muted-foreground">Total Despesas</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalDespesas)}</p>
          </CardContent></Card>
          <Card className={`col-span-1 ${resultadoLiquido >= 0 ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}`}>
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${resultadoLiquido >= 0 ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                <Wallet className={`w-4 h-4 ${resultadoLiquido >= 0 ? "text-green-600" : "text-red-600"}`} />
              </div>
              <p className="text-xs text-muted-foreground">Resultado Líquido</p>
              <p className={`text-lg font-bold ${resultadoLiquido >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(resultadoLiquido)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Meta do Mês */}
        {metaMes && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Meta do Mês — {new Date(anoAtual, mesAtual - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowMetaForm(true)}>Ajustar Meta</Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Receita</span>
                    <span className="font-medium">{formatCurrency(receitaMes)} / {formatCurrency(metaMes.meta_receita)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progressoMeta >= 100 ? "bg-green-500" : progressoMeta >= 70 ? "bg-yellow-500" : "bg-primary"}`} style={{ width: `${progressoMeta}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">{progressoMeta}%</p>
                </div>
                {metaMes.meta_novos_clientes > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Meta Novos Clientes</p>
                    <p className="text-lg font-bold">{metaMes.meta_novos_clientes}</p>
                  </div>
                )}
                {metaMes.meta_horas > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Meta de Horas</p>
                    <p className="text-lg font-bold">{metaMes.meta_horas}h</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        {!metaMes && (
          <Button variant="outline" className="mb-6 gap-2" onClick={() => setShowMetaForm(true)}>
            <Target className="w-4 h-4" /> Definir Meta do Mês
          </Button>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
          {tabs.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* TAB: Resumo */}
        {activeTab === "Resumo" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-serif font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Resultado Mensal (P&L)
                  </h3>
                  {plData.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={plData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="resultado" name="Resultado" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-serif font-semibold mb-4 flex items-center gap-2">
                    <PieIcon className="w-4 h-4 text-primary" /> Despesas por Categoria
                  </h3>
                  {despPorCategoria.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sem despesas cadastradas</p> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={despPorCategoria} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {despPorCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Resumo numérico */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-serif font-semibold mb-4">Balanço Patrimonial Simplificado</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Receita Bruta", value: formatCurrency(totalReceita), color: "text-green-600" },
                    { label: "Receita Recebida", value: formatCurrency(totalRecebido), color: "text-green-600" },
                    { label: "A Receber", value: formatCurrency(totalPendente + totalAtrasado), color: "text-yellow-600" },
                    { label: "Inadimplência", value: totalReceita > 0 ? formatPct(Math.round((totalAtrasado / totalReceita) * 100)) : "0%", color: totalAtrasado > 0 ? "text-destructive" : "text-green-600" },
                    { label: "Desp. Processuais", value: formatCurrency(totalDespesaProcessual), color: "text-red-600" },
                    { label: "Desp. Operacionais", value: formatCurrency(totalDespesaOperacional), color: "text-red-600" },
                    { label: "Total Despesas", value: formatCurrency(totalDespesas), color: "text-red-600" },
                    { label: "Resultado Líquido", value: formatCurrency(resultadoLiquido), color: resultadoLiquido >= 0 ? "text-green-600 font-extrabold" : "text-destructive font-extrabold" },
                  ].map((item) => (
                    <div key={item.label} className="p-4 bg-muted/40 rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                      <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB: Honorários */}
        {activeTab === "Honorários" && (
          <div>
            <div className="flex flex-wrap items-end gap-3 mb-4">
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
            <div className="bg-card rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Tipo</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Valor</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Vencimento</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum lançamento</td></tr>}
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-sm">{r.descricao}</td>
                      <td className="p-3 text-sm capitalize">{r.tipo}</td>
                      <td className="p-3 text-sm font-medium">{formatCurrency(Number(r.valor))}</td>
                      <td className="p-3 text-sm text-muted-foreground">{r.data_vencimento || "—"}</td>
                      <td className="p-3">
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${r.status === "pago" ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : r.status === "atrasado" ? "bg-destructive/10 text-destructive" : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"}`}>{r.status}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {r.status !== "pago" && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => marcarPago(r.id)}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditItem(r); setForm({ tipo: r.tipo, descricao: r.descricao, valor: r.valor, data_vencimento: r.data_vencimento || "", status: r.status }); setShowForm(true); }}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteItem(r.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Despesas */}
        {activeTab === "Despesas" && (
          <div>
            <div className="flex justify-end mb-4">
              <Button onClick={() => setShowDespesaForm(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Nova Despesa Operacional
              </Button>
            </div>
            <div className="bg-card rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Categoria</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Valor</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Competência</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Recorrente</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {despesasEscritorio.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma despesa registrada</td></tr>}
                  {despesasEscritorio.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-sm">{d.descricao}</td>
                      <td className="p-3"><span className="text-xs capitalize bg-muted px-2 py-0.5 rounded">{d.categoria}</span></td>
                      <td className="p-3 text-sm font-medium text-red-600">{formatCurrency(Number(d.valor))}</td>
                      <td className="p-3 text-sm text-muted-foreground">{new Date(d.data_competencia + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="p-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.status === "pago" ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"}`}>{d.status}</span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{d.recorrente ? "Sim" : "Não"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: P&L */}
        {activeTab === "P&L" && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-serif font-semibold mb-6">Demonstração de Resultado (DRE) — Acumulado</h3>
                <div className="space-y-3 max-w-lg">
                  {[
                    { label: "Receita Bruta", value: totalReceita, type: "receita" },
                    { label: "(−) Impostos/Taxas", value: 0, type: "deducao" },
                    { label: "Receita Líquida", value: totalReceita, type: "subtotal" },
                    { label: "(−) Despesas Processuais", value: totalDespesaProcessual, type: "deducao" },
                    { label: "(−) Despesas Operacionais", value: totalDespesaOperacional, type: "deducao" },
                    { label: "RESULTADO OPERACIONAL", value: resultadoLiquido, type: "resultado" },
                  ].map((row) => (
                    <div key={row.label} className={`flex justify-between items-center p-3 rounded-lg ${row.type === "resultado" ? "bg-primary/5 border border-primary/20" : row.type === "subtotal" ? "bg-muted/60" : ""}`}>
                      <span className={`text-sm ${row.type === "resultado" ? "font-bold text-base" : row.type === "subtotal" ? "font-semibold" : ""}`}>{row.label}</span>
                      <span className={`font-bold ${row.type === "resultado" ? (row.value >= 0 ? "text-green-600 text-lg" : "text-destructive text-lg") : row.type === "deducao" ? "text-red-500" : ""}`}>
                        {row.type === "deducao" ? `(${formatCurrency(row.value)})` : formatCurrency(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-serif font-semibold mb-4">Evolução do Resultado (12 meses)</h3>
                {plData.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={plData}>
                      <defs>
                        <linearGradient id="gradResult" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#22c55e" fill="none" strokeWidth={2} />
                      <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" fill="none" strokeWidth={2} />
                      <Area type="monotone" dataKey="resultado" name="Resultado" stroke="#3b82f6" fill="url(#gradResult)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB: Metas */}
        {activeTab === "Metas" && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowMetaForm(true)} className="gap-2"><Target className="w-4 h-4" /> Definir/Editar Meta</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {metas.length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">Nenhuma meta definida</p>}
              {metas.map((m) => {
                const recMes = registros.filter((r) => r.tipo === "honorario" && r.status === "pago" && new Date(r.created_at).getMonth() + 1 === m.mes && new Date(r.created_at).getFullYear() === m.ano).reduce((s, r) => s + Number(r.valor), 0);
                const prog = m.meta_receita > 0 ? Math.min(100, Math.round((recMes / m.meta_receita) * 100)) : 0;
                return (
                  <Card key={m.id}>
                    <CardContent className="p-5">
                      <p className="font-semibold mb-3">{new Date(m.ano, m.mes - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Receita</span>
                            <span>{formatCurrency(recMes)} / {formatCurrency(m.meta_receita)}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full">
                            <div className={`h-full rounded-full ${prog >= 100 ? "bg-green-500" : prog >= 70 ? "bg-yellow-500" : "bg-primary"}`} style={{ width: `${prog}%` }} />
                          </div>
                          <p className="text-xs text-right mt-0.5 text-muted-foreground">{prog}% atingido</p>
                        </div>
                        {m.meta_novos_clientes > 0 && <div className="text-sm"><span className="text-muted-foreground">Novos clientes: </span><span className="font-medium">{m.meta_novos_clientes}</span></div>}
                        {m.meta_horas > 0 && <div className="text-sm"><span className="text-muted-foreground">Horas: </span><span className="font-medium">{m.meta_horas}h</span></div>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Honorário Form */}
        <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setEditItem(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="honorario">Honorário</SelectItem>
                      <SelectItem value="despesa">Despesa Processual</SelectItem>
                      <SelectItem value="custas">Custas</SelectItem>
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
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento</Label>
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

        {/* Despesa Operacional Form */}
        <Dialog open={showDespesaForm} onOpenChange={setShowDespesaForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Despesa Operacional</DialogTitle></DialogHeader>
            <form onSubmit={handleDespesaSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input value={despesaForm.descricao} onChange={(e) => setDespesaForm({ ...despesaForm, descricao: e.target.value })} placeholder="Ex: Aluguel escritório, internet, etc." required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={despesaForm.categoria} onValueChange={(v) => setDespesaForm({ ...despesaForm, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categoriaDespesas.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" value={despesaForm.valor} onChange={(e) => setDespesaForm({ ...despesaForm, valor: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Competência</Label>
                  <Input type="date" value={despesaForm.data_competencia} onChange={(e) => setDespesaForm({ ...despesaForm, data_competencia: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={despesaForm.status} onValueChange={(v) => setDespesaForm({ ...despesaForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={despesaForm.recorrente} onCheckedChange={(v) => setDespesaForm({ ...despesaForm, recorrente: v })} id="recorrente" />
                <Label htmlFor="recorrente">Despesa recorrente</Label>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowDespesaForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Registrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Meta Form */}
        <Dialog open={showMetaForm} onOpenChange={setShowMetaForm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Definir Meta Financeira</DialogTitle></DialogHeader>
            <form onSubmit={handleMetaSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select value={String(metaForm.mes)} onValueChange={(v) => setMetaForm({ ...metaForm, mes: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{new Date(2024, i).toLocaleDateString("pt-BR", { month: "long" })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input type="number" value={metaForm.ano} onChange={(e) => setMetaForm({ ...metaForm, ano: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meta de Receita (R$)</Label>
                <Input type="number" step="0.01" value={metaForm.meta_receita} onChange={(e) => setMetaForm({ ...metaForm, meta_receita: e.target.value })} placeholder="Ex: 15000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Meta Novos Clientes</Label>
                  <Input type="number" value={metaForm.meta_novos_clientes} onChange={(e) => setMetaForm({ ...metaForm, meta_novos_clientes: e.target.value })} placeholder="Ex: 5" />
                </div>
                <div className="space-y-2">
                  <Label>Meta de Horas</Label>
                  <Input type="number" value={metaForm.meta_horas} onChange={(e) => setMetaForm({ ...metaForm, meta_horas: e.target.value })} placeholder="Ex: 160" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowMetaForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar Meta"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Financeiro;
