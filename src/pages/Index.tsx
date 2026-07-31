import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { RecentProcesses } from "@/components/dashboard/RecentProcesses";
import { AreaDistribution } from "@/components/dashboard/AreaDistribution";
import { DepthCard } from "@/components/dashboard/DepthCard";
import { TrialBanner } from "@/components/TrialBanner";
import {
  ArrowRight, TrendingUp, Clock, Receipt, Wallet, Target, CheckCircle2,
  Briefcase, Users, KanbanSquare, Calendar, Gavel, Search, CheckSquare,
  DollarSign, FolderOpen, BookOpen, BarChart3, Sparkles, Bell,
  AlertTriangle, Activity,
} from "lucide-react";
const IconProcessos = Briefcase;
const IconClientes = Users;
const IconLeads = KanbanSquare;
const IconAgenda = Calendar;
const IconAudiencias = Gavel;
const IconBusca = Search;
const IconTarefas = CheckSquare;
const IconFinanceiro = DollarSign;
const IconHoras = Clock;
const IconDocumentos = FolderOpen;
const IconJurisprudencia = BookOpen;
const IconRelatorios = BarChart3;
const IconHorusIA = Sparkles;
const IconBell = Bell;
const IconAlerta = AlertTriangle;
const IconSistema = Activity;
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

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
  const { currentTenant } = useTenant();
  const [stats, setStats] = useState({ processos: 0, clientes: 0, documentos: 0 });
  const [processAreas, setProcessAreas] = useState<Array<{ name: string; count: number }>>([]);
  const [financeiro, setFinanceiro] = useState({ recebido: 0, pendente: 0, atrasado: 0, despesas: 0 });
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [audienciasProximas, setAudienciasProximas] = useState<Record<string, any>[]>([]);
  const [notificacoesRecentes, setNotificacoesRecentes] = useState<Record<string, any>[]>([]);
  const [leadsNovos, setLeadsNovos] = useState(0);
  const [horasMes, setHorasMes] = useState(0);
  const [metaMes, setMetaMes] = useState<Record<string, any> | null>(null);
  const [tarefasHoje, setTarefasHoje] = useState(0);
  const [nomeAdvogado, setNomeAdvogado] = useState("");
  const [horusMetrics, setHorusMetrics] = useState({
    processosMonitorados: 0,
    tribunaisAtivos: 0,
    ultimaVerificacao: null as Date | null,
  });

  useEffect(() => {
    if (!currentTenant?.tenantId) return;

    const tenantId = currentTenant.tenantId;
    const tenantTable = (table: string) => (supabase.from as any)(table);
    const now = new Date();
    const em7dias = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const hoje = now.toISOString().slice(0, 10);

    // Carregar nome do advogado do perfil
    const perfilData = localStorage.getItem("adveyes_perfil");
    if (perfilData) {
      try {
        const perfil = JSON.parse(perfilData);
        setNomeAdvogado(perfil.nome || "");
      } catch (e) {
        console.error("Erro ao carregar perfil:", e);
      }
    }

    Promise.all([
      tenantTable("processos").select("id, area, status").eq("tenant_id", tenantId),
      tenantTable("clientes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      tenantTable("documentos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      tenantTable("tarefas").select("*").eq("tenant_id", tenantId).neq("status", "concluída").not("data_limite", "is", null).lte("data_limite", em7dias.slice(0, 10)).order("data_limite"),
      tenantTable("audiencias").select("*").eq("tenant_id", tenantId).gte("data_hora", now.toISOString()).lte("data_hora", em7dias).order("data_hora").limit(5),
      tenantTable("financeiro").select("*").eq("tenant_id", tenantId).eq("status", "pendente").not("data_vencimento", "is", null).lte("data_vencimento", em7dias.slice(0, 10)).order("data_vencimento"),
      tenantTable("notificacoes").select("*").eq("tenant_id", tenantId).eq("lida", false).order("created_at", { ascending: false }).limit(5),
      tenantTable("financeiro").select("tipo, status, valor").eq("tenant_id", tenantId),
      tenantTable("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "novo"),
      tenantTable("time_entries").select("horas").eq("tenant_id", tenantId).gte("created_at", inicioMes),
      tenantTable("metas_financeiras").select("*").eq("tenant_id", tenantId).eq("mes", now.getMonth() + 1).eq("ano", now.getFullYear()).maybeSingle(),
      tenantTable("tarefas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("data_limite", hoje).neq("status", "concluída"),
      tenantTable("processo_monitoramento").select("tribunal, ultima_verificacao, ativo").eq("tenant_id", tenantId).eq("ativo", true),
    ]).then(([proc, cli, doc, tarefas, aud, fin, notifs, allFin, leads, timeE, meta, tarefasHojeRes, monitoramento]) => {
      const processRows = proc.data || [];
      setStats({ processos: processRows.length, clientes: cli.count || 0, documentos: doc.count || 0 });
      const areaCounts = processRows.reduce((counts: Record<string, number>, process: any) => {
        const area = process.area?.trim() || "Não informada";
        counts[area] = (counts[area] || 0) + 1;
        return counts;
      }, {});
      setProcessAreas(
        Object.entries(areaCounts).map(([name, count]) => ({ name, count: Number(count) })),
      );

      const monitoredRows = monitoramento.data || [];
      const activeCourts = new Set(
        monitoredRows.map((row: any) => row.tribunal).filter(Boolean),
      );
      const lastVerification = monitoredRows
        .map((row: any) => row.ultima_verificacao)
        .filter(Boolean)
        .map((value: string) => new Date(value))
        .sort((left: Date, right: Date) => right.getTime() - left.getTime())[0] || null;
      setHorusMetrics({
        processosMonitorados: monitoredRows.length,
        tribunaisAtivos: activeCourts.size,
        ultimaVerificacao: lastVerification,
      });

      // Financial KPIs
      const finData = allFin.data || [];
      setFinanceiro({
        recebido: finData.filter((r: any) => r.status === "pago" && r.tipo === "honorario").reduce((s: number, r: any) => s + Number(r.valor), 0),
        pendente: finData.filter((r: any) => r.status === "pendente").reduce((s: number, r: any) => s + Number(r.valor), 0),
        atrasado: finData.filter((r: any) => r.status === "atrasado").reduce((s: number, r: any) => s + Number(r.valor), 0),
        despesas: finData.filter((r: any) => r.tipo !== "honorario").reduce((s: number, r: any) => s + Number(r.valor), 0),
      });

      const allPrazos: Prazo[] = [];
      (tarefas.data || []).forEach((t: any) => {
        const dias = Math.ceil((new Date(t.data_limite).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        allPrazos.push({ tipo: "tarefa", titulo: t.titulo, data: t.data_limite, dias, prioridade: t.prioridade, id: t.id });
      });
      (fin.data || []).forEach((f: any) => {
        const dias = Math.ceil((new Date(f.data_vencimento).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        allPrazos.push({ tipo: "financeiro", titulo: f.descricao, data: f.data_vencimento, dias, valor: f.valor, id: f.id });
      });
      allPrazos.sort((a, b) => a.dias - b.dias);
      setPrazos(allPrazos);
      setAudienciasProximas(aud.data || []);
      setNotificacoesRecentes(notifs.data || []);
      setLeadsNovos(leads.count || 0);
      setHorasMes((timeE.data || []).reduce((s: number, e: any) => s + Number(e.horas), 0));
      setMetaMes(meta.data || null);
      setTarefasHoje(tarefasHojeRes.count || 0);
    });
  }, [currentTenant?.tenantId]);

  const prazosUrgentes = prazos.filter(p => p.dias <= 2).length;
  const resultadoLiquido = financeiro.recebido - financeiro.despesas;
  const progressoMeta = metaMes?.meta_receita > 0 ? Math.min(100, Math.round((financeiro.recebido / metaMes.meta_receita) * 100)) : 0;

  // Saudação inteligente baseada no horário
  const getGreeting = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Bom dia";
    if (hora >= 12 && hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  const getSaudacao = () => {
    const greeting = getGreeting();
    const nome = nomeAdvogado ? ` ${nomeAdvogado.split(' ')[0]}` : "";
    return `${greeting}${nome}`;
  };

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

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const quickActions = [
    { label: "Busca Processual", icon: IconBusca, path: "/busca" },
    { label: "Nova Tarefa", icon: IconTarefas, path: "/tarefas" },
    { label: "Financeiro", icon: IconFinanceiro, path: "/financeiro" },
    { label: "Controle Horas", icon: IconHoras, path: "/time-tracking" },
    { label: "Novo Lead (CRM)", icon: IconLeads, path: "/crm" },
    { label: "Documentos", icon: IconDocumentos, path: "/documentos" },
    { label: "Jurisprudência", icon: IconJurisprudencia, path: "/jurisprudencia" },
    { label: "Relatórios", icon: IconRelatorios, path: "/relatorios" },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <TrialBanner />
        {/* Header - Astrea greeting */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {getSaudacao()}
              </h1>
              <p className="text-muted-foreground text-[13px] mt-0.5">
                Área de trabalho · {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>
            <Button
              onClick={() => navigate("/ia-juridica")}
              size="sm"
              className="gap-2 h-9"
            >
              <IconHorusIA size={16} />
              Assistente IA
            </Button>
          </div>

          {/* Horus Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-lg bg-card border border-border/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                <IconHorusIA size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Processos Monitorados</p>
                <p className="text-xl font-semibold font-serif tabular-nums">{horusMetrics.processosMonitorados}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Tribunais Ativos</p>
                <p className="text-xl font-semibold font-serif tabular-nums">{horusMetrics.tribunaisAtivos}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Última Verificação</p>
                <p className="text-sm font-medium tabular-nums">
                  {horusMetrics.ultimaVerificacao
                    ? horusMetrics.ultimaVerificacao.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Sem verificação"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Row 1: Processos + Operacional */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-4">
          <DepthCard className="metric-card p-4" interactive onActivate={() => navigate("/processos")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Processos</p>
                <p className="text-3xl font-bold mt-1 leading-none" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{stats.processos}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Ativos</p>
              </div>
              <div className="p-2 rounded-lg bg-secondary"><IconProcessos size={20} className="text-muted-foreground" /></div>
            </div>
          </DepthCard>
          <DepthCard className="metric-card p-4" interactive onActivate={() => navigate("/clientes")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Clientes</p>
                <p className="text-3xl font-bold mt-1 leading-none" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{stats.clientes}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Cadastrados</p>
              </div>
              <div className="p-2 rounded-lg bg-secondary"><IconClientes size={20} className="text-muted-foreground" /></div>
            </div>
          </DepthCard>
          <DepthCard className="metric-card p-4" interactive onActivate={() => navigate("/crm")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Leads</p>
                <p className="text-3xl font-bold mt-1 leading-none" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{leadsNovos}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Novos</p>
              </div>
              <div className="p-2 rounded-lg bg-secondary"><IconLeads size={20} className="text-muted-foreground" /></div>
            </div>
          </DepthCard>
          <DepthCard className="metric-card p-4" interactive onActivate={() => navigate("/time-tracking")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Horas/Mês</p>
                <p className="text-3xl font-bold mt-1 leading-none" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{horasMes.toFixed(0)}h</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Trabalhadas</p>
              </div>
              <div className="p-2 rounded-lg bg-secondary"><IconHoras size={20} className="text-muted-foreground" /></div>
            </div>
          </DepthCard>
          <DepthCard className="metric-card p-4" interactive onActivate={() => navigate("/tarefas")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prazos</p>
                <p className="text-3xl font-bold mt-1 leading-none" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{prazos.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">7 dias</p>
              </div>
              <div className="p-2 rounded-lg bg-secondary"><IconAgenda size={20} className="text-muted-foreground" /></div>
            </div>
          </DepthCard>
          <DepthCard className="metric-card p-4 border-destructive/20" interactive onActivate={() => navigate("/tarefas")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Urgentes</p>
                <p className="text-3xl font-bold mt-1 leading-none text-destructive" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{prazosUrgentes}</p>
                <p className="text-[10px] text-destructive/70 mt-0.5">Atenção!</p>
              </div>
              <div className="p-2 rounded-lg bg-destructive/10"><IconAlerta size={20} className="text-destructive" /></div>
            </div>
          </DepthCard>
          <DepthCard className="metric-card p-4" interactive onActivate={() => navigate("/audiencias")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Audiências</p>
                <p className="text-3xl font-bold mt-1 leading-none" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{audienciasProximas.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Esta semana</p>
              </div>
              <div className="p-2 rounded-lg bg-secondary"><IconAudiencias size={20} className="text-muted-foreground" /></div>
            </div>
          </DepthCard>
          <DepthCard className="metric-card p-4" interactive onActivate={() => navigate("/tarefas")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hoje</p>
                <p className="text-3xl font-bold mt-1 leading-none" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{tarefasHoje}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Tarefas</p>
              </div>
              <div className="p-2 rounded-lg bg-secondary"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /></div>
            </div>
          </DepthCard>
        </div>

        {/* Row 2: Financial KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <DepthCard interactive onActivate={() => navigate("/financeiro")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-lg font-bold text-foreground leading-tight" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{formatCurrency(financeiro.recebido)}</p>
              </div>
            </CardContent>
          </DepthCard>
          <DepthCard interactive onActivate={() => navigate("/financeiro")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A Receber</p>
                <p className="text-lg font-bold text-foreground leading-tight" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{formatCurrency(financeiro.pendente)}</p>
              </div>
            </CardContent>
          </DepthCard>
          <DepthCard interactive onActivate={() => navigate("/financeiro")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atrasado</p>
                <p className="text-lg font-bold text-destructive leading-tight" style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{formatCurrency(financeiro.atrasado)}</p>
              </div>
            </CardContent>
          </DepthCard>
          <DepthCard interactive onActivate={() => navigate("/financeiro")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${resultadoLiquido >= 0 ? "bg-secondary" : "bg-destructive/10"}`}>
                <Wallet className={`w-4 h-4 ${resultadoLiquido >= 0 ? "text-muted-foreground" : "text-destructive"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resultado Líquido</p>
                <p className={`text-lg font-bold leading-tight ${resultadoLiquido >= 0 ? "text-foreground" : "text-destructive"}`} style={{fontFamily:"'Microsoft Sans Serif',sans-serif"}}>{formatCurrency(resultadoLiquido)}</p>
              </div>
            </CardContent>
          </DepthCard>
        </div>

        {/* Meta do mês */}
        {metaMes && (
          <Card className="mb-4 cursor-pointer" onClick={() => navigate("/financeiro")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Meta do Mês</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(financeiro.recebido)} / {formatCurrency(metaMes.meta_receita)}</span>
                </div>
                <span className="text-sm font-bold text-foreground">{progressoMeta}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-foreground/70"
                  style={{ width: `${progressoMeta}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 🦅 Horus Proactive Suggestions */}
        {(prazosUrgentes > 0 || tarefasHoje > 0 || audienciasProximas.length > 0) && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-foreground/60 animate-pulse" />
                <h3 className="font-serif font-semibold text-sm">Horus — Sugestões Proativas</h3>
              </div>
              <div className="space-y-2">
                {prazosUrgentes > 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/10">
                    <IconAlerta size={16} className="text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-destructive">Atenção: {prazosUrgentes} prazo(s) urgente(s)</p>
                      <p className="text-xs text-muted-foreground">Recomendo revisar imediatamente os prazos vencendo em até 2 dias.</p>
                    </div>
                  </div>
                )}
                {tarefasHoje > 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary border border-border">
                    <CheckCircle2 size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Você tem {tarefasHoje} tarefa(s) para hoje</p>
                      <p className="text-xs text-muted-foreground">Organize sua agenda para concluir todas as pendências do dia.</p>
                    </div>
                  </div>
                )}
                {audienciasProximas.length > 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary border border-border">
                    <IconAudiencias size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{audienciasProximas.length} audiência(s) agendada(s)</p>
                      <p className="text-xs text-muted-foreground">Prepare a documentação e confirme a pauta com antecedência.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconSistema size={18} className="text-muted-foreground" />
                <h3 className="font-serif font-semibold text-sm">Ações Rápidas</h3>
              </div>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {quickActions.map((a) => (
                <button
                  key={a.path}
                  onClick={() => navigate(a.path)}
                  className="quick-action-card group"
                >
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-secondary/70 group-hover:scale-105 transition-all">
                    <a.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight text-center">{a.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Horus AI Banner */}
        <Card
          className="mb-4 cursor-pointer overflow-hidden group transition-all duration-200"
          onClick={() => navigate("/ia-juridica")}
        >
          <CardContent className="p-0">
            <div className="relative flex items-center gap-4 p-4">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center">
                  <IconHorusIA size={24} className="text-muted-foreground" />
                </div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-foreground/40 border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-serif font-bold">Horus — IA Jurídica</h3>
                  <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-semibold">Online</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Assistente com voz, análise de documentos, geração de peças e pesquisa jurídica com IA
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-all shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          {/* Prazos */}
          <div className="xl:col-span-2">
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-serif font-semibold">Prazos Vencendo</h3>
                    {prazosUrgentes > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full font-semibold">
                        {prazosUrgentes} urgente(s)
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/tarefas")} className="gap-1 text-xs h-7">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
                {prazos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <TrendingUp className="w-8 h-8 text-muted-foreground mb-2 opacity-60" />
                    <p className="text-sm text-muted-foreground">Nenhum prazo nos próximos 7 dias</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {prazos.slice(0, 7).map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${getDiasBg(p.dias)}`}
                        onClick={() => navigate(p.tipo === "tarefa" ? "/tarefas" : "/financeiro")}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {p.tipo === "tarefa" ? "Tarefa" : "Fin."}
                          </span>
                          <div>
                            <p className="text-xs font-medium leading-tight">{p.titulo}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(p.data).toLocaleDateString("pt-BR")}
                              {p.valor && ` • R$ ${Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold whitespace-nowrap ${getDiasColor(p.dias)}`}>
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
          <div className="space-y-3">
            {/* Notificações */}
            <Card className="cursor-pointer" onClick={() => navigate("/publicacoes")}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <IconBell size={16} className="text-muted-foreground" />
                    <h3 className="font-serif font-semibold text-xs">Notificações</h3>
                  </div>
                  {notificacoesRecentes.length > 0 && (
                    <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">{notificacoesRecentes.length}</span>
                  )}
                </div>
                {notificacoesRecentes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhuma nova</p>
                ) : (
                  <div className="space-y-1.5">
                    {notificacoesRecentes.slice(0, 3).map((n) => (
                      <div key={n.id} className="p-2 rounded-lg border-l-2 border-l-foreground/30 bg-muted/30">
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
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <IconAudiencias size={16} className="text-muted-foreground" />
                  <h3 className="font-serif font-semibold text-xs">Próximas Audiências</h3>
                </div>
                {audienciasProximas.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhuma esta semana</p>
                ) : (
                  <div className="space-y-1.5">
                    {audienciasProximas.slice(0, 3).map((a) => (
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
              <AreaDistribution areas={processAreas} />
            </div>
          </div>
        </div>

        {/* Cobertura de consulta processual */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <IconSistema size={18} className="text-muted-foreground" />
              <h3 className="font-serif font-semibold text-sm">Cobertura de consulta processual</h3>
              <span className="text-xs text-muted-foreground ml-auto">índices DataJud/CNJ</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["STF","STJ","TST","TRF1","TRF2","TRF3","TRF4","TRF5","TJAM","TJSP","TJRJ","TJMG","TJBA","TJPR","TJRS","SEEU","Projudi"].map((t) => (
                <span
                  key={t}
                  onClick={() => navigate("/busca")}
                  className={`cursor-pointer text-xs font-semibold px-2 py-0.5 rounded-full border transition-all hover:scale-105 ${
                    t === "SEEU" ? "tribunal-badge-seeu" :
                    t === "Projudi" ? "tribunal-badge-projudi" :
                    "tribunal-badge"
                  }`}
                >
                  {t}
                </span>
              ))}
              <span
                onClick={() => navigate("/busca")}
                className="cursor-pointer text-xs font-medium px-2 py-0.5 rounded-full border border-dashed text-muted-foreground hover:text-foreground transition-colors"
              >
                Ver demais índices →
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
