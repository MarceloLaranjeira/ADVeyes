import { differenceInCalendarDays, endOfMonth, format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  DashboardAttentionItem,
  DashboardHearing,
  DashboardNotification,
  DashboardProcess,
  OperationalDashboardData,
} from "@/types/operational-dashboard";

type Tables = Database["public"]["Tables"];
type TaskRow = Tables["tarefas"]["Row"];
type FinanceRow = Tables["financeiro"]["Row"];
type MonitoringRow = Tables["processo_monitoramento"]["Row"];
type GoalRow = Tables["metas_financeiras"]["Row"];

interface DashboardSourceData {
  activeProcessCount: number;
  processAreas: Array<Pick<Tables["processos"]["Row"], "area">>;
  recentProcesses: DashboardProcess[];
  contactCount: number;
  documentCount: number;
  newLeadCount: number;
  pendingActivityCount: number;
  overdueActivityCount: number;
  todayActivityCount: number;
  completedActivities: Array<Pick<TaskRow, "pontos" | "concluida_em">>;
  dueActivities: Array<Pick<TaskRow, "id" | "titulo" | "data_limite" | "prioridade" | "processo_id">>;
  upcomingHearings: DashboardHearing[];
  notifications: DashboardNotification[];
  finances: Array<Pick<FinanceRow, "id" | "descricao" | "tipo" | "status" | "valor" | "data_pagamento" | "data_vencimento" | "created_at">>;
  hours: Array<Pick<Tables["time_entries"]["Row"], "horas">>;
  goal: Pick<GoalRow, "meta_receita"> | null;
  monitoring: Array<Pick<MonitoringRow, "tribunal" | "ultima_verificacao">>;
  legalMonitoringSummary?: {
    monitored_processes: number | string | null;
    last_success: string | null;
  } | null;
  pendingPublicationCount: number;
  warnings: string[];
}

type SupabaseError = { message: string } | null;

function addWarning(warnings: string[], label: string, error: SupabaseError): void {
  if (error) warnings.push(`${label}: ${error.message}`);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function buildAttentionItems(
  source: DashboardSourceData,
  now: Date,
): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = source.dueActivities.map(task => {
    const dueDate = task.data_limite!;
    const days = differenceInCalendarDays(new Date(`${dueDate}T12:00:00`), now);
    const kind = days < 0 ? "overdue" : days === 0 ? "today" : "upcoming";
    const description = days < 0
      ? `${Math.abs(days)} dia(s) em atraso${task.prioridade === "alta" ? " · prioridade alta" : ""}`
      : days === 0
        ? `Vence hoje${task.prioridade === "alta" ? " · prioridade alta" : ""}`
        : `Vence em ${days} dia(s)`;

    return {
      id: `task:${task.id}`,
      kind,
      title: task.titulo,
      description,
      // A Controladoria é o posto de comando: o item chega lá já com o
      // contador correspondente aberto, em vez de abrir uma tela por tipo.
      href: `/controladoria?foco=${days < 0 ? "vencidos" : days === 0 ? "hoje" : "proximos"}`,
      date: dueDate,
      days,
    };
  });

  source.upcomingHearings.slice(0, 2).forEach(hearing => {
    const days = differenceInCalendarDays(new Date(hearing.data_hora), now);
    items.push({
      id: `hearing:${hearing.id}`,
      kind: "hearing",
      title: hearing.tipo,
      description: [
        days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `Em ${days} dias`,
        hearing.processo_numero,
        hearing.vara ?? hearing.local,
      ].filter(Boolean).join(" · "),
      href: "/controladoria?aba=audiencias",
      date: hearing.data_hora,
      days,
    });
  });

  if (source.pendingPublicationCount > 0) {
    items.push({
      id: "publications:pending",
      kind: "publication",
      title: `${source.pendingPublicationCount} intimação(ões) aguardando revisão`,
      description: "Revise o conteúdo e confirme possíveis prazos antes de distribuir atividades.",
      href: "/controladoria?foco=sem-ciencia",
      date: null,
      days: null,
    });
  }

  const overdueValue = sum(source.finances
    .filter(item => item.status === "atrasado")
    .map(item => item.valor));
  if (overdueValue > 0) {
    items.push({
      id: "finance:overdue",
      kind: "finance",
      title: "Recebimentos financeiros em atraso",
      description: overdueValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      href: "/financeiro",
      date: null,
      days: null,
    });
  }

  const priority: Record<DashboardAttentionItem["kind"], number> = {
    overdue: 0,
    today: 1,
    hearing: 2,
    publication: 3,
    finance: 4,
    upcoming: 5,
  };

  return items
    .sort((left, right) => priority[left.kind] - priority[right.kind] || (left.days ?? 999) - (right.days ?? 999))
    .slice(0, 8);
}

export function buildOperationalDashboard(
  source: DashboardSourceData,
  now = new Date(),
): OperationalDashboardData {
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const receivedThisMonth = sum(source.finances
    .filter(item => item.status === "pago" && item.tipo === "honorario" && Boolean(item.data_pagamento) && item.data_pagamento! >= monthStart && item.data_pagamento! <= monthEnd)
    .map(item => item.valor));
  const expensesThisMonth = sum(source.finances
    .filter(item => item.tipo !== "honorario" && item.created_at.slice(0, 10) >= monthStart && item.created_at.slice(0, 10) <= monthEnd)
    .map(item => item.valor));
  const pending = sum(source.finances
    .filter(item => item.status === "pendente")
    .map(item => item.valor));
  const overdue = sum(source.finances
    .filter(item => item.status === "atrasado")
    .map(item => item.valor));
  const monthlyGoal = source.goal?.meta_receita ?? null;
  const areaCounts = source.processAreas.reduce<Record<string, number>>((counts, process) => {
    const area = process.area?.trim() || "Não informada";
    counts[area] = (counts[area] ?? 0) + 1;
    return counts;
  }, {});
  const verificationTimes = source.monitoring
    .map(item => item.ultima_verificacao)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left));
  const monitoredProcessCount = Number(
    source.legalMonitoringSummary?.monitored_processes ?? source.monitoring.length,
  );

  return {
    generatedAt: now.toISOString(),
    warnings: source.warnings,
    metrics: {
      activeProcesses: source.activeProcessCount,
      contacts: source.contactCount,
      documents: source.documentCount,
      newLeads: source.newLeadCount,
      pendingActivities: source.pendingActivityCount,
      overdueActivities: source.overdueActivityCount,
      activitiesToday: source.todayActivityCount,
      completedThisMonth: source.completedActivities.length,
      pointsThisMonth: sum(source.completedActivities.map(item => item.pontos)),
      hearingsNext7Days: source.upcomingHearings.length,
      hoursThisMonth: sum(source.hours.map(item => item.horas)),
      unreadNotifications: source.notifications.length,
      pendingPublications: source.pendingPublicationCount,
    },
    financial: {
      receivedThisMonth,
      expensesThisMonth,
      netThisMonth: receivedThisMonth - expensesThisMonth,
      pending,
      overdue,
      monthlyGoal,
      goalProgress: monthlyGoal && monthlyGoal > 0
        ? Math.min(100, Math.round((receivedThisMonth / monthlyGoal) * 100))
        : 0,
    },
    monitoring: {
      monitoredProcesses: monitoredProcessCount,
      activeCourts: new Set(source.monitoring.map(item => item.tribunal).filter(Boolean)).size,
      lastVerification: source.legalMonitoringSummary?.last_success ?? verificationTimes[0] ?? null,
    },
    attention: buildAttentionItems(source, now),
    upcomingHearings: source.upcomingHearings,
    notifications: source.notifications,
    recentProcesses: source.recentProcesses,
    processAreas: Object.entries(areaCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count),
  };
}

export async function loadOperationalDashboard(
  tenantId: string,
  now = new Date(),
): Promise<OperationalDashboardData> {
  const today = format(now, "yyyy-MM-dd");
  const inSevenDays = format(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7), "yyyy-MM-dd");
  const monthStartDate = format(startOfMonth(now), "yyyy-MM-dd");
  const monthStartIso = startOfMonth(now).toISOString();
  const sevenDaysIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59).toISOString();

  const [
    activeProcessesResult,
    processAreasResult,
    recentProcessesResult,
    contactsResult,
    documentsResult,
    leadsResult,
    pendingActivitiesResult,
    overdueActivitiesResult,
    todayActivitiesResult,
    completedActivitiesResult,
    dueActivitiesResult,
    hearingsResult,
    notificationsResult,
    financeResult,
    hoursResult,
    goalResult,
    monitoringResult,
    legalMonitoringSummaryResult,
    publicationsResult,
  ] = await Promise.all([
    supabase.from("processos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "Arquivado"),
    supabase.from("processos").select("area").eq("tenant_id", tenantId).neq("status", "Arquivado").limit(1000),
    supabase.from("processos").select("id, numero, cliente_nome, area, status, updated_at, ultimo_andamento").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(6),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("documentos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "novo"),
    supabase.from("tarefas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "concluída"),
    supabase.from("tarefas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "concluída").not("data_limite", "is", null).lt("data_limite", today),
    supabase.from("tarefas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "concluída").eq("data_limite", today),
    supabase.from("tarefas").select("pontos, concluida_em").eq("tenant_id", tenantId).eq("status", "concluída").gte("concluida_em", monthStartIso),
    supabase.from("tarefas").select("id, titulo, data_limite, prioridade, processo_id").eq("tenant_id", tenantId).neq("status", "concluída").not("data_limite", "is", null).lte("data_limite", inSevenDays).order("data_limite").limit(10),
    supabase.from("audiencias").select("id, tipo, data_hora, vara, local, processo_id, processo_numero, cliente_nome").eq("tenant_id", tenantId).gte("data_hora", now.toISOString()).lte("data_hora", sevenDaysIso).order("data_hora").limit(8),
    supabase.from("notificacoes").select("id, titulo, mensagem, tipo, created_at, processo_numero").eq("tenant_id", tenantId).eq("lida", false).order("created_at", { ascending: false }).limit(5),
    supabase.from("financeiro").select("id, descricao, tipo, status, valor, data_pagamento, data_vencimento, created_at").eq("tenant_id", tenantId),
    supabase.from("time_entries").select("horas").eq("tenant_id", tenantId).gte("data", monthStartDate),
    supabase.from("metas_financeiras").select("meta_receita").eq("tenant_id", tenantId).eq("mes", now.getMonth() + 1).eq("ano", now.getFullYear()).maybeSingle(),
    supabase.from("processo_monitoramento").select("tribunal, ultima_verificacao").eq("tenant_id", tenantId).eq("ativo", true),
    // A integração atual usa legal_sync_sources; processo_monitoramento é
    // mantida apenas para escritórios legados.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("legal_sync_source_summary")
      .select("monitored_processes, last_success")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase.from("publicacoes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("review_status", "pending_review"),
  ]);

  const warnings: string[] = [];
  [
    ["Processos", activeProcessesResult.error],
    ["Distribuição processual", processAreasResult.error],
    ["Processos recentes", recentProcessesResult.error],
    ["Contatos", contactsResult.error],
    ["Documentos", documentsResult.error],
    ["CRM", leadsResult.error],
    ["Atividades pendentes", pendingActivitiesResult.error],
    ["Atividades atrasadas", overdueActivitiesResult.error],
    ["Atividades de hoje", todayActivitiesResult.error],
    ["Atividades concluídas", completedActivitiesResult.error],
    ["Prazos", dueActivitiesResult.error],
    ["Audiências", hearingsResult.error],
    ["Notificações", notificationsResult.error],
    ["Financeiro", financeResult.error],
    ["Horas", hoursResult.error],
    ["Metas", goalResult.error],
    ["Monitoramento", monitoringResult.error],
    ["Monitoramento jurídico", legalMonitoringSummaryResult.error],
    ["Intimações", publicationsResult.error],
  ].forEach(([label, error]) => addWarning(warnings, label as string, error as SupabaseError));

  return buildOperationalDashboard({
    activeProcessCount: activeProcessesResult.count ?? 0,
    processAreas: processAreasResult.data ?? [],
    recentProcesses: recentProcessesResult.data ?? [],
    contactCount: contactsResult.count ?? 0,
    documentCount: documentsResult.count ?? 0,
    newLeadCount: leadsResult.count ?? 0,
    pendingActivityCount: pendingActivitiesResult.count ?? 0,
    overdueActivityCount: overdueActivitiesResult.count ?? 0,
    todayActivityCount: todayActivitiesResult.count ?? 0,
    completedActivities: completedActivitiesResult.data ?? [],
    dueActivities: dueActivitiesResult.data ?? [],
    upcomingHearings: hearingsResult.data ?? [],
    notifications: notificationsResult.data ?? [],
    finances: financeResult.data ?? [],
    hours: hoursResult.data ?? [],
    goal: goalResult.data ?? null,
    monitoring: monitoringResult.data ?? [],
    legalMonitoringSummary: legalMonitoringSummaryResult.data ?? null,
    pendingPublicationCount: publicationsResult.count ?? 0,
    warnings,
  }, now);
}
