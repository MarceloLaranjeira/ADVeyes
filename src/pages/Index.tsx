import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentProcesses } from "@/components/dashboard/RecentProcesses";
import { AreaDistribution } from "@/components/dashboard/AreaDistribution";
import {
  Scale, Users, CalendarDays, AlertTriangle, Gavel, FileText,
  Clock, Bell, Bot, Search, DollarSign, ListTodo, BarChart3,
  ArrowRight, Zap, Shield, TrendingUp, BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Prazo {
  tipo: string;
  titulo: string;
  data: string;
  dias: number;
  prioridade?: string;
  valor?: number;
  id: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ processos: 0, clientes: 0, documentos: 0 });
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [audienciasProximas, setAudienciasProximas] = useState<Record<string, unknown>[]>([]);
  const [notificacoesRecentes, setNotificacoesRecentes] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const now = new Date();
    const em7dias = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase.from("processos").select("id", { count: "exact", head: true }),
      supabase.from("clientes").select("id", { count: "exact", head: true }),
      supabase.from("documentos").select("id", { count: "exact", head: true }),
      supabase.from("tarefas").select("*").neq("status", "concluída").not("data_limite", "is", null).lte("data_limite", em7dias.slice(0, 10)).order("data_limite"),
      supabase.from("audiencias").select("*").gte("data_hora", now.toISOString()).lte("data_hora", em7dias).order("data_hora").limit(5),
      supabase.from("financeiro").select("*").eq("status", "pendente").not("data_vencimento", "is", null).lte("data_vencimento", em7dias.slice(0, 10)).order("data_vencimento"),
      supabase.from("notificacoes").select("*").eq("lida", false).order("created_at", { ascending: false }).limit(5),
    ]).then(([proc, cli, doc, tarefas, aud, fin, notifs]) => {
      setStats({ processos: proc.count || 0, clientes: cli.count || 0, documentos: doc.count || 0 });
      const allPrazos: Prazo[] = [];
      (tarefas.data || []).forEach((t) => {
        const dias = Math.ceil((new Date(t.data_limite).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        allPrazos.push({ tipo: "tarefa", titulo: t.titulo, data: t.data_limite, dias, prioridade: t.prioridade, id: t.id });
      });
      (fin.data || []).forEach((f) => {
        const dias = Math.ceil((new Date(f.data_vencimento).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        allPrazos.push({ tipo: "financeiro", titulo: f.descricao, data: f.data_vencimento, dias, valor: f.valor, id: f.id });
      });
      allPrazos.sort((a, b) => a.dias - b.dias);
      setPrazos(allPrazos);
      setAudienciasProximas(aud.data || []);
      setNotificacoesRecentes(notifs.data || []);
    });
  }, []);

  const prazosUrgentes = prazos.filter(p => p.dias <= 2).length;

  const getDiasColor = (dias: number) => {
    if (dias < 0) return "text-destructive font-bold";
    if (dias <= 1) return "text-destructive";
    if (dias <= 3) return "text-[hsl(var(--warning))]";
    return "text-muted-foreground";
  };
  const getDiasBg = (dias: number) => {
    if (dias < 0) return "bg-destructive/8 border-destructive/20";
    if (dias <= 1) return "bg-destructive/5 border-destructive/15";
    if (dias <= 3) return "bg-[hsl(var(--warning))]/5 border-[hsl(var(--warning))]/15";
    return "bg-card border-border";
  };

  const quickActions = [
    { label: "Busca Processual", icon: Search, path: "/busca", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { label: "Nova Tarefa", icon: ListTodo, path: "/tarefas", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
    { label: "Financeiro", icon: DollarSign, path: "/financeiro", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
    { label: "Documentos", icon: FileText, path: "/documentos", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
    { label: "Jurisprudência", icon: BookOpen, path: "/jurisprudencia", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
    { label: "Relatórios", icon: BarChart3, path: "/relatorios", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30" },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              Sistema de Gestão — <span className="font-medium text-foreground/70">Albertino e Advogados Associados</span>
            </p>
          </div>
          <Button
            onClick={() => navigate("/ia-juridica")}
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
          >
            <Bot className="w-4 h-4" />
            JARVIS IA
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <div className="metric-card p-5" onClick={() => navigate("/processos")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Processos</p>
                <p className="text-2xl font-bold mt-1 font-serif">{stats.processos}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ativos</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/8">
                <Scale className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>
          <div className="metric-card p-5" onClick={() => navigate("/clientes")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clientes</p>
                <p className="text-2xl font-bold mt-1 font-serif">{stats.clientes}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Cadastrados</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="metric-card p-5" onClick={() => navigate("/tarefas")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prazos</p>
                <p className="text-2xl font-bold mt-1 font-serif">{prazos.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Próximos 7 dias</p>
              </div>
              <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                <CalendarDays className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="metric-card p-5 border-destructive/20" onClick={() => navigate("/tarefas")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Urgentes</p>
                <p className="text-2xl font-bold mt-1 font-serif text-destructive">{prazosUrgentes}</p>
                <p className="text-xs text-destructive/70 mt-0.5">Atenção imediata</p>
              </div>
              <div className="p-2.5 rounded-lg bg-destructive/8">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </div>
          <div className="metric-card p-5" onClick={() => navigate("/audiencias")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audiências</p>
                <p className="text-2xl font-bold mt-1 font-serif">{audienciasProximas.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Esta semana</p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                <Gavel className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="metric-card p-5" onClick={() => navigate("/documentos")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documentos</p>
                <p className="text-2xl font-bold mt-1 font-serif">{stats.documentos}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total</p>
              </div>
              <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/30">
                <FileText className="w-5 h-5 text-teal-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                <h3 className="font-serif font-semibold">Ações Rápidas</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {quickActions.map((a) => (
                <button
                  key={a.path}
                  onClick={() => navigate(a.path)}
                  className="quick-action-card group"
                >
                  <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <a.icon className={`w-5 h-5 ${a.color}`} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{a.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* JARVIS AI Banner */}
        <Card
          className="mb-6 cursor-pointer overflow-hidden group border-primary/20 hover:border-primary/40 transition-all duration-200"
          onClick={() => navigate("/ia-juridica")}
        >
          <CardContent className="p-0">
            <div className="relative flex items-center gap-4 p-5 bg-gradient-to-r from-primary/8 via-primary/4 to-transparent">
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center animate-neural-pulse">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-serif font-bold text-lg">JARVIS — IA Jurídica</h3>
                  <span className="text-xs bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full font-semibold">Online</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Assistente jurídico com comando de voz, análise de documentos e geração de peças processuais
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden md:block">Clique para abrir</span>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* Prazos */}
          <div className="xl:col-span-2">
            <Card className="h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[hsl(var(--warning))]" />
                    <h3 className="font-serif text-lg font-semibold">Prazos Vencendo</h3>
                    {prazosUrgentes > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
                        {prazosUrgentes} urgente(s)
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/tarefas")} className="gap-1 text-xs">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
                {prazos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <TrendingUp className="w-10 h-10 text-green-500 mb-3 opacity-60" />
                    <p className="text-sm text-muted-foreground">Nenhum prazo nos próximos 7 dias</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Tudo em dia!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {prazos.slice(0, 8).map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-shadow ${getDiasBg(p.dias)}`}
                        onClick={() => navigate(p.tipo === "tarefa" ? "/tarefas" : "/financeiro")}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            p.tipo === "tarefa"
                              ? "bg-primary/10 text-primary"
                              : "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                          }`}>
                            {p.tipo === "tarefa" ? "Tarefa" : "Fin."}
                          </span>
                          <div>
                            <p className="text-sm font-medium leading-tight">{p.titulo}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(p.data).toLocaleDateString("pt-BR")}
                              {p.valor && ` • R$ ${Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                              {p.prioridade && ` • ${p.prioridade}`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold whitespace-nowrap ${getDiasColor(p.dias)}`}>
                          {p.dias < 0 ? `${Math.abs(p.dias)}d atr.` : p.dias === 0 ? "Hoje!" : `${p.dias}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar cards */}
          <div className="space-y-4">
            {/* Notificações */}
            <Card className="cursor-pointer" onClick={() => navigate("/publicacoes")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold text-sm">Notificações</h3>
                  </div>
                  {notificacoesRecentes.length > 0 && (
                    <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{notificacoesRecentes.length}</span>
                  )}
                </div>
                {notificacoesRecentes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhuma notificação nova</p>
                ) : (
                  <div className="space-y-2">
                    {notificacoesRecentes.map((n) => (
                      <div key={n.id} className="p-2 rounded-lg border-l-2 border-l-primary bg-muted/30">
                        <p className="text-xs font-semibold truncate">{n.titulo}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{n.mensagem}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Próximas Audiências */}
            <Card className="cursor-pointer" onClick={() => navigate("/audiencias")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Gavel className="w-4 h-4 text-primary" />
                  <h3 className="font-serif font-semibold text-sm">Próximas Audiências</h3>
                </div>
                {audienciasProximas.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhuma audiência esta semana</p>
                ) : (
                  <div className="space-y-2">
                    {audienciasProximas.map((a) => (
                      <div key={a.id} className="p-2 rounded-lg bg-muted/30 border">
                        <p className="text-xs font-semibold">{a.tipo}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(a.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          {a.vara && ` • ${a.vara}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div onClick={() => navigate("/relatorios")} className="cursor-pointer">
              <AreaDistribution />
            </div>
          </div>
        </div>

        {/* APIs Tribunais Status */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[hsl(var(--success))]" />
              <h3 className="font-serif font-semibold text-sm">APIs dos Tribunais — Status</h3>
              <span className="text-xs text-muted-foreground ml-auto">via DataJud/CNJ</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {["STF","STJ","TST","TRF1","TRF2","TRF3","TRF4","TRF5","TJAM","TJSP","TJRJ","TJMG","TJBA","TJPR","TJRS","SEEU","Projudi"].map((t) => (
                <span
                  key={t}
                  onClick={() => navigate("/busca")}
                  className={`cursor-pointer text-xs font-semibold px-2.5 py-1 rounded-full border transition-all hover:scale-105 ${
                    t === "SEEU" ? "tribunal-badge-seeu" :
                    t === "Projudi" ? "tribunal-badge-projudi" :
                    "tribunal-badge"
                  }`}
                >
                  ✓ {t}
                </span>
              ))}
              <span
                onClick={() => navigate("/busca")}
                className="cursor-pointer text-xs font-medium px-2.5 py-1 rounded-full border border-dashed text-muted-foreground hover:text-foreground transition-colors"
              >
                +68 tribunais →
              </span>
            </div>
          </CardContent>
        </Card>

        <div onClick={() => navigate("/processos")} className="cursor-pointer">
          <RecentProcesses />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
