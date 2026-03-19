import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exportRelatorioGeralPDF } from "@/lib/pdf-export";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";
import {
  BarChart3, Scale, Users, DollarSign, TrendingUp, FileText,
  Download, CheckCircle2, Clock, AlertTriangle, Target, Zap,
} from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))", "hsl(var(--accent))"];
const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const Relatorios = () => {
  const [processos, setProcessos] = useState<Record<string, any>[]>([]);
  const [clientes, setClientes] = useState<Record<string, any>[]>([]);
  const [financeiro, setFinanceiro] = useState<Record<string, any>[]>([]);
  const [documentos, setDocumentos] = useState<Record<string, any>[]>([]);
  const [tarefas, setTarefas] = useState<Record<string, any>[]>([]);
  const [audiencias, setAudiencias] = useState<Record<string, any>[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("processos").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("financeiro").select("*"),
      supabase.from("documentos").select("*"),
      supabase.from("tarefas").select("*"),
      supabase.from("audiencias").select("*"),
    ]).then(([p, c, f, d, t, a]) => {
      if (p.data) setProcessos(p.data);
      if (c.data) setClientes(c.data);
      if (f.data) setFinanceiro(f.data);
      if (d.data) setDocumentos(d.data);
      if (t.data) setTarefas(t.data);
      if (a.data) setAudiencias(a.data);
    });
  }, []);

  const processosPorArea = useMemo(() => {
    const map: Record<string, number> = {};
    processos.forEach((p) => { map[p.area] = (map[p.area] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [processos]);

  const processosPorStatus = useMemo(() => {
    const map: Record<string, number> = {};
    processos.forEach((p) => { map[p.status] = (map[p.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [processos]);

  // Monthly financial trend (last 12 months)
  const tendenciaFinanceira = useMemo(() => {
    const months: Record<string, { mes: string; receitas: number; despesas: number; resultado: number }> = {};
    financeiro.forEach((r) => {
      const date = new Date(r.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
      if (!months[key]) months[key] = { mes: label, receitas: 0, despesas: 0, resultado: 0 };
      if (r.tipo === "honorario") months[key].receitas += Number(r.valor);
      else months[key].despesas += Number(r.valor);
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, v]) => ({ ...v, resultado: v.receitas - v.despesas }));
  }, [financeiro]);

  // Task productivity
  const tarefasStats = useMemo(() => {
    const concluidas = tarefas.filter((t) => t.status === "concluida").length;
    const pendentes = tarefas.filter((t) => t.status === "pendente").length;
    const emAndamento = tarefas.filter((t) => t.status === "em_andamento").length;
    const total = tarefas.length;
    const taxaConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    const atrasadas = tarefas.filter((t) => {
      if (!t.data_limite || t.status === "concluida") return false;
      return new Date(t.data_limite) < new Date();
    }).length;
    return { concluidas, pendentes, emAndamento, total, taxaConclusao, atrasadas };
  }, [tarefas]);

  // Task completion by priority
  const tarefasPorPrioridade = useMemo(() => {
    const map: Record<string, { concluidas: number; total: number }> = {};
    tarefas.forEach((t) => {
      const p = t.prioridade || "media";
      if (!map[p]) map[p] = { concluidas: 0, total: 0 };
      map[p].total++;
      if (t.status === "concluida") map[p].concluidas++;
    });
    return Object.entries(map).map(([name, v]) => ({
      name: name === "alta" ? "Alta" : name === "media" ? "Média" : "Baixa",
      concluidas: v.concluidas,
      pendentes: v.total - v.concluidas,
    }));
  }, [tarefas]);

  // Clientes por mês (growth)
  const clientesCrescimento = useMemo(() => {
    const months: Record<string, { mes: string; novos: number; acumulado: number }> = {};
    let acumulado = 0;
    clientes
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((c) => {
        const date = new Date(c.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const label = `${MONTH_NAMES[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
        if (!months[key]) months[key] = { mes: label, novos: 0, acumulado: 0 };
        months[key].novos++;
        acumulado++;
        months[key].acumulado = acumulado;
      });
    return Object.values(months).slice(-12);
  }, [clientes]);

  const totalReceita = financeiro.filter((f) => f.tipo === "honorario").reduce((s, f) => s + Number(f.valor), 0);
  const totalDespesa = financeiro.filter((f) => f.tipo !== "honorario").reduce((s, f) => s + Number(f.valor), 0);
  const totalRecebido = financeiro.filter((f) => f.status === "pago" && f.tipo === "honorario").reduce((s, f) => s + Number(f.valor), 0);
  const taxaReceivimento = totalReceita > 0 ? Math.round((totalRecebido / totalReceita) * 100) : 0;

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatPct = (v: number) => `${v}%`;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Relatórios & Indicadores</h1>
            <p className="text-muted-foreground text-sm mt-1">Visão analítica completa do desempenho do escritório</p>
          </div>
          <Button
            variant="outline"
            onClick={() => exportRelatorioGeralPDF({ processos, clientes, financeiro, documentos })}
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Exportar PDF
          </Button>
        </div>

        {/* KPI Cards — Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
          {[
            { label: "Processos", value: processos.length, icon: Scale, color: "text-primary", bg: "bg-primary/10" },
            { label: "Clientes", value: clientes.length, icon: Users, color: "text-[hsl(var(--info))]", bg: "bg-[hsl(var(--info))]/10" },
            { label: "Receita Total", value: formatCurrency(totalReceita), icon: TrendingUp, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10", small: true },
            { label: "Resultado Líquido", value: formatCurrency(totalReceita - totalDespesa), icon: DollarSign, color: "text-orange-600", bg: "bg-orange-500/10", small: true },
            { label: "Taxa de Recebimento", value: formatPct(taxaReceivimento), icon: Target, color: "text-purple-600", bg: "bg-purple-500/10" },
            { label: "Documentos", value: documentos.length, icon: FileText, color: "text-gray-600", bg: "bg-gray-500/10" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                  <p className={`font-bold ${stat.small ? "text-base" : "text-xl"}`}>{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Productivity KPIs */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold font-serif mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Produtividade — Tarefas
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            {[
              { label: "Taxa de Conclusão", value: `${tarefasStats.taxaConclusao}%`, icon: Target, color: "text-green-600", bg: "bg-green-500/10" },
              { label: "Concluídas", value: tarefasStats.concluidas, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-500/10" },
              { label: "Em Andamento", value: tarefasStats.emAndamento, icon: Clock, color: "text-blue-600", bg: "bg-blue-500/10" },
              { label: "Pendentes", value: tarefasStats.pendentes, icon: Clock, color: "text-orange-600", bg: "bg-orange-500/10" },
              { label: "Atrasadas", value: tarefasStats.atrasadas, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-500/10" },
              { label: "Total de Tarefas", value: tarefasStats.total, icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Processes by Area */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-base font-semibold font-serif mb-4">Processos por Área</h3>
              {processosPorArea.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={processosPorArea} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                      {processosPorArea.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Processes by Status */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-base font-semibold font-serif mb-4">Processos por Status</h3>
              {processosPorStatus.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={processosPorStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Processos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Financial Trend */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-base font-semibold font-serif mb-4">Tendência Financeira (12 meses)</h3>
              {tendenciaFinanceira.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem dados financeiros</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={tendenciaFinanceira}>
                    <defs>
                      <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="receitas" name="Receitas" stroke="hsl(var(--success))" fill="url(#colorReceitas)" strokeWidth={2} />
                    <Area type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(var(--destructive))" fill="url(#colorDespesas)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Task Productivity by Priority */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-base font-semibold font-serif mb-4">Tarefas por Prioridade</h3>
              {tarefasPorPrioridade.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem tarefas registradas</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={tarefasPorPrioridade}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="concluidas" name="Concluídas" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="pendentes" name="Pendentes" fill="hsl(var(--warning))" radius={[3, 3, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Client Growth */}
        {clientesCrescimento.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-base font-semibold font-serif mb-4">Crescimento da Carteira de Clientes</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={clientesCrescimento}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="novos" name="Novos Clientes/mês" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="acumulado" name="Total Acumulado" stroke="hsl(var(--info))" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Summary Table */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold font-serif mb-5">Resumo Geral do Escritório</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { label: "Documentos Arquivados", value: documentos.length },
                { label: "Processos Ativos", value: processos.filter((p) => p.status === "Em andamento").length },
                { label: "Audiências Agendadas", value: audiencias.filter((a) => a.status === "agendada").length },
                { label: "Pgtos. Pendentes", value: financeiro.filter((f) => f.status === "pendente").length },
                { label: "Pgtos. Atrasados", value: financeiro.filter((f) => f.status === "atrasado").length },
                { label: "Taxa de Conclusão", value: `${tarefasStats.taxaConclusao}%` },
                { label: "Taxa de Recebimento", value: `${taxaReceivimento}%` },
                { label: "Saldo Líquido", value: formatCurrency(totalReceita - totalDespesa) },
              ].map((item) => (
                <div key={item.label} className="p-4 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors">
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Relatorios;
