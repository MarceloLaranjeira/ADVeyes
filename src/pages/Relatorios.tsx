import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Scale, Users, DollarSign, TrendingUp, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))", "hsl(var(--accent))"];

const Relatorios = () => {
  const [processos, setProcessos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [financeiro, setFinanceiro] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("processos").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("financeiro").select("*"),
      supabase.from("documentos").select("*"),
    ]).then(([p, c, f, d]) => {
      if (p.data) setProcessos(p.data);
      if (c.data) setClientes(c.data);
      if (f.data) setFinanceiro(f.data);
      if (d.data) setDocumentos(d.data);
    });
  }, []);

  const processosPorArea = useMemo(() => {
    const map: Record<string, number> = {};
    processos.forEach(p => { map[p.area] = (map[p.area] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [processos]);

  const processosPorStatus = useMemo(() => {
    const map: Record<string, number> = {};
    processos.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [processos]);

  const totalReceita = financeiro.filter(f => f.tipo === "honorario").reduce((s, f) => s + Number(f.valor), 0);
  const totalDespesa = financeiro.filter(f => f.tipo !== "honorario").reduce((s, f) => s + Number(f.valor), 0);
  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Relatórios & Indicadores</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão analítica do desempenho do escritório</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Scale className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total de Processos</p><p className="text-2xl font-bold">{processos.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--info))]/10 flex items-center justify-center"><Users className="w-5 h-5 text-[hsl(var(--info))]" /></div>
            <div><p className="text-xs text-muted-foreground">Total de Clientes</p><p className="text-2xl font-bold">{clientes.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-[hsl(var(--success))]" /></div>
            <div><p className="text-xs text-muted-foreground">Receita Total</p><p className="text-xl font-bold">{formatCurrency(totalReceita)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Despesa Total</p><p className="text-xl font-bold">{formatCurrency(totalDespesa)}</p></div>
          </CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold font-serif mb-4">Processos por Área</h3>
              {processosPorArea.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={processosPorArea} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                      {processosPorArea.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold font-serif mb-4">Processos por Status</h3>
              {processosPorStatus.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={processosPorStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Processos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold font-serif mb-4">Resumo Geral</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-muted/50 rounded-lg"><p className="text-2xl font-bold">{documentos.length}</p><p className="text-xs text-muted-foreground mt-1">Documentos</p></div>
              <div className="p-4 bg-muted/50 rounded-lg"><p className="text-2xl font-bold">{processos.filter(p => p.status === "Em andamento").length}</p><p className="text-xs text-muted-foreground mt-1">Processos Ativos</p></div>
              <div className="p-4 bg-muted/50 rounded-lg"><p className="text-2xl font-bold">{financeiro.filter(f => f.status === "pendente").length}</p><p className="text-xs text-muted-foreground mt-1">Pagamentos Pendentes</p></div>
              <div className="p-4 bg-muted/50 rounded-lg"><p className="text-2xl font-bold">{formatCurrency(totalReceita - totalDespesa)}</p><p className="text-xs text-muted-foreground mt-1">Resultado Líquido</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Relatorios;
