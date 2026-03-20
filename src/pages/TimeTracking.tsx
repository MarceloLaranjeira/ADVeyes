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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Plus, Timer, DollarSign, TrendingUp, CheckCircle2,
  Play, Square, Filter, Download, Calendar, Briefcase,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const categorias = ["juridico", "administrativo", "pesquisa", "reuniao", "audiencia", "peticao", "recurso", "consultoria"];

const TimeTracking = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<Record<string, any>[]>([]);
  const [processos, setProcessos] = useState<Record<string, any>[]>([]);
  const [clientes, setClientes] = useState<Record<string, any>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterMes, setFilterMes] = useState(new Date().toISOString().slice(0, 7));
  const [filterProcesso, setFilterProcesso] = useState("todos");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [form, setForm] = useState({
    descricao: "",
    data: new Date().toISOString().slice(0, 10),
    horas: "",
    valor_hora: "",
    faturavel: true,
    categoria: "juridico",
    processo_id: "",
    cliente_id: "",
  });

  const fetchData = async () => {
    const [entriesRes, processosRes, clientesRes] = await Promise.all([
      (supabase.from as any)("time_entries").select("*, processos(numero, descricao), clientes(nome)").order("data", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("processos").select("id, numero, descricao").order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome").order("nome"),
    ]);
    if (entriesRes.data) setEntries(entriesRes.data);
    if (processosRes.data) setProcessos(processosRes.data);
    if (clientesRes.data) setClientes(clientesRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  // Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerRunning && timerStart) {
      interval = setInterval(() => {
        setTimerSeconds(Math.floor((Date.now() - timerStart.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerStart]);

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const startTimer = () => {
    setTimerStart(new Date());
    setTimerRunning(true);
    setTimerSeconds(0);
  };

  const stopTimer = () => {
    setTimerRunning(false);
    const horas = (timerSeconds / 3600).toFixed(2);
    setForm((f) => ({ ...f, horas }));
    setShowForm(true);
  };

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const matchMes = !filterMes || e.data?.startsWith(filterMes);
      const matchProcesso = filterProcesso === "todos" || e.processo_id === filterProcesso;
      return matchMes && matchProcesso;
    });
  }, [entries, filterMes, filterProcesso]);

  const totalHoras = filtered.reduce((s, e) => s + Number(e.horas), 0);
  const totalFaturavel = filtered.filter((e) => e.faturavel).reduce((s, e) => s + Number(e.horas), 0);
  const totalValor = filtered.filter((e) => e.faturavel && e.valor_hora).reduce((s, e) => s + Number(e.horas) * Number(e.valor_hora), 0);
  const totalFaturado = filtered.filter((e) => e.faturado).reduce((s, e) => s + Number(e.horas) * (Number(e.valor_hora) || 0), 0);

  const chartData = useMemo(() => {
    const days: Record<string, { dia: string; horas: number }> = {};
    filtered.forEach((e) => {
      const d = e.data;
      if (!days[d]) days[d] = { dia: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), horas: 0 };
      days[d].horas += Number(e.horas);
    });
    return Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filtered]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim() || !form.horas) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("time_entries").insert({
      descricao: form.descricao,
      data: form.data,
      horas: parseFloat(form.horas),
      valor_hora: form.valor_hora ? parseFloat(form.valor_hora) : null,
      faturavel: form.faturavel,
      categoria: form.categoria,
      processo_id: form.processo_id || null,
      cliente_id: form.cliente_id || null,
      user_id: user!.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Horas registradas!" });
      setForm({ descricao: "", data: new Date().toISOString().slice(0, 10), horas: "", valor_hora: "", faturavel: true, categoria: "juridico", processo_id: "", cliente_id: "" });
      setShowForm(false);
      fetchData();
    }
    setLoading(false);
  };

  const marcarFaturado = async (id: string, faturado: boolean) => {
    await supabase.from("time_entries").update({ faturado }).eq("id", id);
    fetchData();
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Controle de Horas</h1>
            <p className="text-muted-foreground text-sm mt-1">Registre e fature o tempo dedicado a cada processo</p>
          </div>
          <div className="flex items-center gap-3">
            {timerRunning ? (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-2 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-lg font-bold text-red-600">{formatTimer(timerSeconds)}</span>
                <Button size="sm" variant="destructive" onClick={stopTimer} className="gap-1">
                  <Square className="w-3 h-3" /> Parar
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={startTimer} className="gap-2">
                <Play className="w-4 h-4 text-green-600" /> Iniciar Timer
              </Button>
            )}
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Registrar Horas
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Clock className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total de Horas</p><p className="text-2xl font-bold">{totalHoras.toFixed(1)}h</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center"><Timer className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Horas Faturáveis</p><p className="text-2xl font-bold text-blue-600">{totalFaturavel.toFixed(1)}h</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Valor a Faturar</p><p className="text-xl font-bold text-green-600">{formatCurrency(totalValor - totalFaturado)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-xs text-muted-foreground">Total Faturado</p><p className="text-xl font-bold text-purple-600">{formatCurrency(totalFaturado)}</p></div>
          </CardContent></Card>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="font-serif font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> Horas por Dia — {filterMes}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, "Horas"]} />
                  <Bar dataKey="horas" name="Horas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Input type="month" value={filterMes} onChange={(e) => setFilterMes(e.target.value)} className="w-[160px]" />
          </div>
          <Select value={filterProcesso} onValueChange={setFilterProcesso}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todos os processos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os processos</SelectItem>
              {processos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.numero} {p.descricao ? `— ${p.descricao.slice(0, 30)}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Data</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Processo/Cliente</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Categoria</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Horas</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Valor</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Faturável</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Faturado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhum registro neste período
                </td></tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-sm">{new Date(e.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-sm max-w-[200px] truncate">{e.descricao}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {e.processos?.numero ? <span className="font-mono text-xs">{e.processos.numero}</span> : e.clientes?.nome || "—"}
                  </td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{e.categoria}</span>
                  </td>
                  <td className="p-3 text-sm font-bold">{Number(e.horas).toFixed(1)}h</td>
                  <td className="p-3 text-sm font-medium text-green-600">
                    {e.valor_hora ? formatCurrency(Number(e.horas) * Number(e.valor_hora)) : "—"}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.faturavel ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {e.faturavel ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => marcarFaturado(e.id, !e.faturado)}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer transition-colors ${e.faturado ? "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" : "bg-muted text-muted-foreground hover:bg-purple-50"}`}
                    >
                      {e.faturado ? <><CheckCircle2 className="w-3 h-3 inline mr-1" />Sim</> : "Marcar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar Horas Trabalhadas</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição da Atividade *</Label>
                <Textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Descreva o trabalho realizado..."
                  rows={2}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Horas *</Label>
                  <Input type="number" step="0.25" min="0.25" max="24" value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} placeholder="Ex: 1.5" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor/Hora (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_hora} onChange={(e) => setForm({ ...form, valor_hora: e.target.value })} placeholder="Ex: 250,00" />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Processo</Label>
                <Select value={form.processo_id} onValueChange={(v) => setForm({ ...form, processo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar processo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {processos.map((p) => <SelectItem key={p.id} value={p.id}>{p.numero}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <Switch checked={form.faturavel} onCheckedChange={(v) => setForm({ ...form, faturavel: v })} id="faturavel" />
                <Label htmlFor="faturavel" className="cursor-pointer">Horas faturáveis ao cliente</Label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
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

export default TimeTracking;
