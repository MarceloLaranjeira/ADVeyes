import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentProcesses } from "@/components/dashboard/RecentProcesses";
import { AreaDistribution } from "@/components/dashboard/AreaDistribution";
import { Scale, Users, CalendarDays, AlertTriangle, Gavel, FileText, Clock, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [stats, setStats] = useState({ processos: 0, clientes: 0, documentos: 0 });
  const [prazos, setPrazos] = useState<any[]>([]);
  const [audienciasProximas, setAudienciasProximas] = useState<any[]>([]);
  const [notificacoesRecentes, setNotificacoesRecentes] = useState<any[]>([]);

  useEffect(() => {
    const now = new Date();
    const em7dias = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const em3dias = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase.from("processos").select("id", { count: "exact", head: true }),
      supabase.from("clientes").select("id", { count: "exact", head: true }),
      supabase.from("documentos").select("id", { count: "exact", head: true }),
      // Tarefas with upcoming deadlines
      supabase.from("tarefas").select("*").neq("status", "concluída").not("data_limite", "is", null).lte("data_limite", em7dias.slice(0, 10)).order("data_limite"),
      // Upcoming audiencias
      supabase.from("audiencias").select("*").gte("data_hora", now.toISOString()).lte("data_hora", em7dias).order("data_hora").limit(5),
      // Financeiro pending with due date
      supabase.from("financeiro").select("*").eq("status", "pendente").not("data_vencimento", "is", null).lte("data_vencimento", em7dias.slice(0, 10)).order("data_vencimento"),
      // Recent notifications
      supabase.from("notificacoes").select("*").eq("lida", false).order("created_at", { ascending: false }).limit(5),
    ]).then(([proc, cli, doc, tarefas, aud, fin, notifs]) => {
      setStats({
        processos: proc.count || 0,
        clientes: cli.count || 0,
        documentos: doc.count || 0,
      });

      // Combine all deadlines
      const allPrazos: any[] = [];
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
    });
  }, []);

  const prazosUrgentes = prazos.filter(p => p.dias <= 2).length;
  const totalPrazos = prazos.length;

  const getDiasColor = (dias: number) => {
    if (dias < 0) return "text-destructive font-bold";
    if (dias <= 1) return "text-destructive";
    if (dias <= 3) return "text-[hsl(var(--warning))]";
    return "text-muted-foreground";
  };

  const getDiasBg = (dias: number) => {
    if (dias < 0) return "bg-destructive/10 border-destructive/30";
    if (dias <= 1) return "bg-destructive/5 border-destructive/20";
    if (dias <= 3) return "bg-[hsl(var(--warning))]/5 border-[hsl(var(--warning))]/20";
    return "bg-card";
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Bem-vindo ao sistema de gestão — Albertino e Advogados Associados</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <StatCard title="Processos Ativos" value={stats.processos} icon={Scale} />
          <StatCard title="Clientes" value={stats.clientes} icon={Users} />
          <StatCard title="Prazos Próximos" value={totalPrazos} subtitle="Próximos 7 dias" icon={CalendarDays} />
          <StatCard title="Urgentes" value={prazosUrgentes} icon={AlertTriangle} variant="accent" />
          <StatCard title="Audiências" value={audienciasProximas.length} subtitle="Esta semana" icon={Gavel} />
          <StatCard title="Documentos" value={stats.documentos} icon={FileText} />
        </div>

        {/* Prazos e Notificações */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* Prazos vencendo */}
          <div className="xl:col-span-2">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[hsl(var(--warning))]" />
                  <h3 className="font-serif text-lg font-semibold">Prazos Vencendo</h3>
                  {prazosUrgentes > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">{prazosUrgentes} urgente(s)</span>
                  )}
                </div>
                {prazos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum prazo nos próximos 7 dias 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {prazos.slice(0, 8).map((p) => (
                      <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${getDiasBg(p.dias)}`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.tipo === "tarefa" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                          }`}>{p.tipo === "tarefa" ? "Tarefa" : "Financeiro"}</span>
                          <div>
                            <p className="text-sm font-medium">{p.titulo}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(p.data).toLocaleDateString("pt-BR")}
                              {p.valor && ` • R$ ${Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                              {p.prioridade && ` • ${p.prioridade}`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${getDiasColor(p.dias)}`}>
                          {p.dias < 0 ? `${Math.abs(p.dias)}d atrasado` : p.dias === 0 ? "Hoje!" : `${p.dias}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notificações + Audiências */}
          <div className="space-y-6">
            {/* Notificações recentes */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-primary" />
                  <h3 className="font-serif font-semibold">Notificações</h3>
                </div>
                {notificacoesRecentes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma notificação</p>
                ) : (
                  <div className="space-y-2">
                    {notificacoesRecentes.map((n) => (
                      <div key={n.id} className="p-2 rounded border-l-2 border-l-primary bg-muted/30">
                        <p className="text-xs font-medium">{n.titulo}</p>
                        <p className="text-[10px] text-muted-foreground">{n.mensagem}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Próximas audiências */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Gavel className="w-4 h-4 text-primary" />
                  <h3 className="font-serif font-semibold">Próximas Audiências</h3>
                </div>
                {audienciasProximas.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma audiência esta semana</p>
                ) : (
                  <div className="space-y-2">
                    {audienciasProximas.map((a) => (
                      <div key={a.id} className="p-2 rounded bg-muted/30">
                        <p className="text-xs font-medium">{a.tipo}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(a.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          {a.vara && ` • ${a.vara}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <AreaDistribution />
          </div>
        </div>

        <RecentProcesses />
      </div>
    </AppLayout>
  );
};

export default Index;
