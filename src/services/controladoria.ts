import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { sortActionItems } from "@/lib/controladoria";
import type { ActivityTeamMember } from "@/types/activities";
import type {
  ActionItem,
  ControladoriaData,
  UpcomingHearing,
} from "@/types/controladoria";

export interface ControladoriaDeadlineSource {
  id: string;
  titulo: string;
  data_limite: string | null;
  status: string;
  responsavel_id: string | null;
  processo_id: string | null;
}

export interface ControladoriaPublicationSource {
  id: string;
  numero_processo: string | null;
  cliente_nome: string | null;
  data_publicacao: string | null;
  tipo: string;
  process_id?: string | null;
}

export interface ControladoriaSource {
  overdueCount: number;
  todayCount: number;
  nextSevenDaysCount: number;
  withoutAcknowledgementCount: number;
  withoutAssigneeCount: number;
  deadlines: ControladoriaDeadlineSource[];
  publications: ControladoriaPublicationSource[];
  hearings: Array<{
    id: string;
    tipo: string;
    data_hora: string;
    processo_id: string | null;
    processo_numero: string | null;
    cliente_nome: string | null;
    local: string | null;
  }>;
  protocolCount: number;
  completedDeadlineCount: number;
  members: Array<Pick<ActivityTeamMember, "userId" | "name">>;
  warnings: string[];
}

type QueryError = { message: string } | null;

function addWarning(warnings: string[], label: string, error: QueryError): void {
  if (error) warnings.push(`${label}: ${error.message}`);
}

export function buildControladoria(
  source: ControladoriaSource,
  now = new Date(),
): ControladoriaData {
  const memberNames = new Map(source.members.map(member => [member.userId, member.name]));
  const deadlines: ActionItem[] = source.deadlines.map(deadline => ({
    id: deadline.id,
    kind: "prazo",
    title: deadline.titulo,
    dueDate: deadline.data_limite,
    processNumber: null,
    processId: deadline.processo_id,
    clientName: null,
    assigneeId: deadline.responsavel_id,
    assigneeName: deadline.responsavel_id
      ? memberNames.get(deadline.responsavel_id) ?? null
      : null,
    status: deadline.status,
  }));
  const publications: ActionItem[] = source.publications.map(publication => ({
    id: publication.id,
    kind: "intimacao",
    title: publication.tipo || "Intimação",
    dueDate: publication.data_publicacao,
    processNumber: publication.numero_processo,
    processId: publication.process_id ?? null,
    clientName: publication.cliente_nome,
    assigneeId: null,
    assigneeName: null,
    status: "sem_ciencia",
  }));

  const upcoming: UpcomingHearing[] = source.hearings.map(hearing => ({
    id: hearing.id,
    tipo: hearing.tipo,
    dataHora: hearing.data_hora,
    processId: hearing.processo_id,
    processNumber: hearing.processo_numero,
    clientName: hearing.cliente_nome,
    local: hearing.local,
  }));

  return {
    generatedAt: now.toISOString(),
    counters: {
      overdue: source.overdueCount,
      today: source.todayCount,
      nextSevenDays: source.nextSevenDaysCount,
      withoutAcknowledgement: source.withoutAcknowledgementCount,
      withoutAssignee: source.withoutAssigneeCount,
    },
    action: sortActionItems([...deadlines, ...publications]),
    upcoming,
    done: {
      protocols: source.protocolCount,
      completedDeadlines: source.completedDeadlineCount,
    },
    warnings: [...source.warnings],
  };
}

export async function fetchControladoria(
  tenantId: string,
  periodDays = 7,
  members: Array<Pick<ActivityTeamMember, "userId" | "name">> = [],
  now = new Date(),
): Promise<ControladoriaData> {
  const today = format(now, "yyyy-MM-dd");
  const inSevenDays = format(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7), "yyyy-MM-dd");
  const sevenDaysIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59).toISOString();
  const periodStartIso = subDays(now, Math.max(1, periodDays)).toISOString();

  const [
    overdueResult,
    todayResult,
    nextSevenDaysResult,
    withoutAcknowledgementResult,
    withoutAssigneeResult,
    deadlinesResult,
    publicationsResult,
    hearingsResult,
    protocolsResult,
    completedResult,
  ] = await Promise.all([
    supabase.from("tarefas").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
      .not("data_limite", "is", null).lt("data_limite", today),
    supabase.from("tarefas").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
      .eq("data_limite", today),
    supabase.from("tarefas").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
      .gt("data_limite", today).lte("data_limite", inSevenDays),
    supabase.from("publicacoes").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).is("ciencia_em", null).neq("review_status", "dismissed"),
    supabase.from("tarefas").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
      .is("responsavel_id", null),
    supabase.from("tarefas")
      .select("id, titulo, data_limite, status, responsavel_id, processo_id")
      .eq("tenant_id", tenantId).eq("tipo", "prazo").neq("status", "concluída")
      .not("data_limite", "is", null).lte("data_limite", inSevenDays)
      .order("data_limite").limit(20),
    supabase.from("publicacoes")
      .select("id, numero_processo, cliente_nome, data_publicacao, tipo, process_id")
      .eq("tenant_id", tenantId).is("ciencia_em", null).neq("review_status", "dismissed")
      .order("data_publicacao", { ascending: true }).limit(10),
    supabase.from("audiencias")
      .select("id, tipo, data_hora, processo_id, processo_numero, cliente_nome, local")
      .eq("tenant_id", tenantId).gte("data_hora", now.toISOString())
      .lte("data_hora", sevenDaysIso).order("data_hora").limit(5),
    supabase.from("protocolos").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("protocolado_em", periodStartIso),
    supabase.from("tarefas").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("tipo", "prazo").eq("status", "concluída")
      .gte("concluida_em", periodStartIso),
  ]);

  const warnings: string[] = [];
  [
    ["Prazos vencidos", overdueResult.error],
    ["Prazos de hoje", todayResult.error],
    ["Próximos prazos", nextSevenDaysResult.error],
    ["Intimações sem ciência", withoutAcknowledgementResult.error],
    ["Prazos sem responsável", withoutAssigneeResult.error],
    ["Lista de ação", deadlinesResult.error],
    ["Intimações", publicationsResult.error],
    ["Audiências", hearingsResult.error],
    ["Protocolos", protocolsResult.error],
    ["Prazos concluídos", completedResult.error],
  ].forEach(([label, error]) => addWarning(warnings, label as string, error as QueryError));

  return buildControladoria({
    overdueCount: overdueResult.count ?? 0,
    todayCount: todayResult.count ?? 0,
    nextSevenDaysCount: nextSevenDaysResult.count ?? 0,
    withoutAcknowledgementCount: withoutAcknowledgementResult.count ?? 0,
    withoutAssigneeCount: withoutAssigneeResult.count ?? 0,
    deadlines: deadlinesResult.data ?? [],
    publications: publicationsResult.data ?? [],
    hearings: hearingsResult.data ?? [],
    protocolCount: protocolsResult.count ?? 0,
    completedDeadlineCount: completedResult.count ?? 0,
    members,
    warnings,
  }, now);
}
