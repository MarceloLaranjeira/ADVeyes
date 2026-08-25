import type {
  ActivityDueKind,
  ActivityFilters,
  ActivityRouteState,
  ActivityScope,
  ActivitySort,
  ActivityStatus,
  ActivityView,
  ActivityWithUserState,
} from "@/types/activities";
import { classifyActivityDueDate } from "@/lib/activity-status";

const views = new Set<ActivityView>(["overview", "list", "kanban", "calendar", "performance"]);
const scopes = new Set<ActivityScope>(["mine", "office"]);
const sorts = new Set<ActivitySort>(["due_asc", "due_desc", "priority", "newest", "oldest", "title", "points"]);
const statuses = new Set<ActivityStatus>(["pendente", "em_andamento", "em_revisao", "concluída"]);
const dueKinds = new Set<ActivityDueKind | "all">(["all", "none", "overdue", "today", "tomorrow", "upcoming", "future"]);

export function parseActivityRoute(params: URLSearchParams, defaultScope: ActivityScope): ActivityRouteState {
  const view = params.get("view") as ActivityView | null;
  const scope = params.get("scope") as ActivityScope | null;
  const sort = params.get("sort") as ActivitySort | null;
  const due = params.get("due") as ActivityDueKind | "all" | null;
  const rawStatuses = params.getAll("status").filter((value): value is ActivityStatus => statuses.has(value as ActivityStatus));
  const rawPriorities = params.getAll("priority").filter((value): value is "alta" | "média" | "baixa" => ["alta", "média", "baixa"].includes(value));
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(params.get("size") ?? "20", 10);

  return {
    view: view && views.has(view) ? view : defaultScope === "office" ? "overview" : "list",
    scope: scope && scopes.has(scope) ? scope : defaultScope,
    sort: sort && sorts.has(sort) ? sort : "due_asc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: [10, 20, 50].includes(pageSize) ? pageSize : 20,
    filters: {
      search: params.get("q") ?? "",
      statuses: rawStatuses,
      priorities: rawPriorities,
      assigneeId: params.get("assignee"),
      processId: params.get("process"),
      category: params.get("category"),
      due: due && dueKinds.has(due) ? due : "all",
      favoritesOnly: params.get("favorites") === "1",
      unreadOnly: params.get("unread") === "1",
    },
  };
}

export function activityRouteParams(state: ActivityRouteState): URLSearchParams {
  const params = new URLSearchParams({ view: state.view, scope: state.scope, sort: state.sort });
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 20) params.set("size", String(state.pageSize));
  if (state.filters.search.trim()) params.set("q", state.filters.search.trim());
  state.filters.statuses.forEach(status => params.append("status", status));
  state.filters.priorities.forEach(priority => params.append("priority", priority));
  if (state.filters.assigneeId) params.set("assignee", state.filters.assigneeId);
  if (state.filters.processId) params.set("process", state.filters.processId);
  if (state.filters.category) params.set("category", state.filters.category);
  if (state.filters.due !== "all") params.set("due", state.filters.due);
  if (state.filters.favoritesOnly) params.set("favorites", "1");
  if (state.filters.unreadOnly) params.set("unread", "1");
  return params;
}

export function filterActivities(
  activities: ActivityWithUserState[],
  filters: ActivityFilters,
  scope: ActivityScope,
  userId: string | null,
  now = new Date(),
) {
  const query = filters.search.trim().toLocaleLowerCase("pt-BR");
  return activities.filter(activity => {
    if (scope === "mine" && activity.responsavel_id !== userId) return false;
    if (filters.statuses.length && !filters.statuses.includes(activity.status as ActivityStatus)) return false;
    if (filters.priorities.length && !filters.priorities.includes(activity.prioridade as "alta" | "média" | "baixa")) return false;
    if (filters.assigneeId === "unassigned" && activity.responsavel_id) return false;
    if (filters.assigneeId && filters.assigneeId !== "unassigned" && activity.responsavel_id !== filters.assigneeId) return false;
    if (filters.processId && activity.processo_id !== filters.processId) return false;
    if (filters.category && activity.categoria !== filters.category) return false;
    if (filters.due !== "all" && classifyActivityDueDate(activity.data_limite, now).kind !== filters.due) return false;
    if (filters.favoritesOnly && !activity.userState?.favorita) return false;
    if (filters.unreadOnly && activity.userState?.lida_em) return false;
    if (!query) return true;
    return [activity.titulo, activity.descricao, activity.process?.number, activity.process?.clientName]
      .some(value => value?.toLocaleLowerCase("pt-BR").includes(query));
  });
}

const priorityWeight: Record<string, number> = { alta: 0, média: 1, baixa: 2 };

export function sortActivities(activities: ActivityWithUserState[], sort: ActivitySort) {
  return activities.slice().sort((left, right) => {
    if (sort === "due_asc") return (left.data_limite ?? "9999").localeCompare(right.data_limite ?? "9999");
    if (sort === "due_desc") return (right.data_limite ?? "0000").localeCompare(left.data_limite ?? "0000");
    if (sort === "priority") return (priorityWeight[left.prioridade] ?? 9) - (priorityWeight[right.prioridade] ?? 9);
    if (sort === "newest") return right.created_at.localeCompare(left.created_at);
    if (sort === "oldest") return left.created_at.localeCompare(right.created_at);
    if (sort === "title") return left.titulo.localeCompare(right.titulo, "pt-BR");
    return right.pontos - left.pontos;
  });
}

export function paginateActivities(activities: ActivityWithUserState[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(activities.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    items: activities.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    totalPages,
    total: activities.length,
  };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function activitiesToCsv(
  activities: ActivityWithUserState[],
  memberNames: Map<string, string>,
) {
  const header = ["Título", "Status", "Prioridade", "Responsável", "Processo", "Cliente", "Prazo", "Categoria", "Pontos"];
  const rows = activities.map(activity => [
    activity.titulo,
    activity.status,
    activity.prioridade,
    activity.responsavel_id ? memberNames.get(activity.responsavel_id) ?? "Indisponível" : "Sem responsável",
    activity.process?.number ?? "",
    activity.process?.clientName ?? "",
    activity.data_limite ? activity.data_limite.split("-").reverse().join("/") : "",
    activity.categoria ?? "",
    activity.pontos,
  ]);
  return `\uFEFF${[header, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function reconcileActivitySelection(selected: Set<string>, visible: ActivityWithUserState[]) {
  const allowed = new Set(visible.map(activity => activity.id));
  return new Set([...selected].filter(id => allowed.has(id)));
}

