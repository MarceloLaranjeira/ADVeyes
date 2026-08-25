import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  FilePlus2,
  ListTodo,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AreaDistribution } from "@/components/dashboard/AreaDistribution";
import { AttentionCenter } from "@/components/dashboard/AttentionCenter";
import { CompactWorkspaceCalendar } from "@/components/dashboard/CompactWorkspaceCalendar";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { NoTenantState } from "@/components/dashboard/NoTenantState";
import { FinancialOverview } from "@/components/dashboard/FinancialOverview";
import { MonitoringOverview } from "@/components/dashboard/MonitoringOverview";
import { OperationalKpis } from "@/components/dashboard/OperationalKpis";
import { ProcessIntelligenceHomeCards } from "@/components/dashboard/ProcessIntelligenceHomeCards";
import { OnboardingResumeBanner } from "@/components/onboarding/OnboardingResumeBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useOperationalDashboard } from "@/hooks/useOperationalDashboard";

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant, memberships } = useTenant();
  const tenantId = currentTenant?.tenantId ?? null;
  // Os quatro estados do painel são decididos aqui, uma vez, em vez de ficarem
  // implícitos numa cadeia de ternários.
  const hasTenant = Boolean(tenantId);
  const canAccessPlatform = (memberships ?? []).some(
    (membership) => membership?.accessMode === "platform",
  );
  const dashboard = useOperationalDashboard(tenantId);
  const now = dashboard.data ? new Date(dashboard.data.generatedAt) : new Date();
  const displayName = String(
    user?.user_metadata?.nome
      ?? user?.user_metadata?.full_name
      ?? user?.email?.split("@")[0]
      ?? "",
  ).trim().split(/\s+/)[0];
  const greeting = `${greetingFor(now)}${displayName ? `, ${displayName}` : ""}`;

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-5">
        <OnboardingResumeBanner />
        <TrialBanner />

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/50 p-1 sm:w-auto">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="list" onClick={() => navigate("/tarefas?view=lista")}>Lista</TabsTrigger>
            <TabsTrigger value="board" onClick={() => navigate("/tarefas?view=kanban")}>Quadro</TabsTrigger>
            <TabsTrigger value="performance" onClick={() => navigate("/relatorios")}>Desempenho</TabsTrigger>
            <TabsTrigger value="settings" onClick={() => navigate("/configuracoes")}>Configurações</TabsTrigger>
          </TabsList>
        </Tabs>

        <header className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Meu Painel</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{greeting}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentTenant?.displayName ?? "Escritório"} · {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
              {dashboard.data && (
                <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
                  Atualizado às {new Date(dashboard.data.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { if (hasTenant) void dashboard.refetch(); }} disabled={!hasTenant || dashboard.isFetching}>
                <RefreshCw className={dashboard.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/tarefas")}>
                <ListTodo className="h-4 w-4" /> Nova tarefa
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/processos")}>
                <FilePlus2 className="h-4 w-4" /> Novo processo
              </Button>
              <Button size="sm" className="gap-2" onClick={() => navigate("/ia-juridica")}>
                <Sparkles className="h-4 w-4" /> Assistente IA
              </Button>
            </div>
          </div>
        </header>

        {!hasTenant ? (
          <NoTenantState canAccessPlatform={canAccessPlatform} />
        ) : dashboard.isLoading ? (
          <DashboardSkeleton />
        ) : dashboard.isError || !dashboard.data ? (
          <Card role="alert" className="border-destructive/30">
            <CardContent className="flex min-h-72 flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="mb-3 h-9 w-9 text-destructive" />
              <h2 className="text-lg font-semibold">Não foi possível carregar o painel</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Os dados existentes permanecem preservados. Tente novamente para refazer a consulta deste escritório.</p>
              <Button className="mt-4 gap-2" onClick={() => void dashboard.refetch()}>
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {dashboard.data.warnings.length > 0 && (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="font-semibold">Alguns indicadores não puderam ser atualizados</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{dashboard.data.warnings.map(warning => warning.split(":")[0]).join(", ")}. Os demais módulos continuam disponíveis.</p>
                </div>
              </div>
            )}

            <OperationalKpis data={dashboard.data} />

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3" aria-label="Prioridades e calendário">
              <div className="xl:col-span-2">
                <AttentionCenter data={dashboard.data} />
              </div>
              <CompactWorkspaceCalendar tenantId={tenantId} />
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3" aria-label="Gestão e monitoramento">
              <FinancialOverview data={dashboard.data} />
              <MonitoringOverview data={dashboard.data} />
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-lg font-semibold">Próximos compromissos</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Audiências previstas para os próximos sete dias</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => navigate("/agenda")}>
                      Agenda <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {dashboard.data.upcomingHearings.length === 0 ? (
                    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed text-center">
                      <CalendarDays className="mb-2 h-7 w-7 text-muted-foreground" />
                      <p className="text-sm font-medium">Nenhuma audiência próxima</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.data.upcomingHearings.slice(0, 4).map(hearing => (
                        <button
                          type="button"
                          key={hearing.id}
                          onClick={() => navigate("/controladoria?aba=audiencias")}
                          className="w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="block truncate text-sm font-semibold">{hearing.tipo}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {new Date(hearing.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                            {(hearing.vara ?? hearing.local) ? ` · ${hearing.vara ?? hearing.local}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3" aria-label="Processos e atualizações">
              <div className="xl:col-span-2">
                <ProcessIntelligenceHomeCards tenantId={tenantId} />
              </div>

              <div className="space-y-4">
                <AreaDistribution areas={dashboard.data.processAreas} />
                <Card>
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        <h2 className="font-serif text-sm font-semibold">Atualizações não lidas</h2>
                      </div>
                      <button type="button" onClick={() => navigate("/publicacoes")} className="text-xs font-medium text-primary hover:underline">Ver todas</button>
                    </div>
                    {dashboard.data.notifications.length === 0 ? (
                      <p className="rounded-xl border border-dashed py-5 text-center text-xs text-muted-foreground">Nenhuma atualização nova</p>
                    ) : (
                      <div className="space-y-2">
                        {dashboard.data.notifications.slice(0, 3).map(notification => (
                          <button type="button" key={notification.id} onClick={() => navigate("/publicacoes")} className="w-full rounded-lg bg-muted/40 p-2.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span className="block truncate text-xs font-semibold">{notification.titulo}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{notification.mensagem}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
