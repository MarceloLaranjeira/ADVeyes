import { BarChart3, CalendarDays, Columns3, Download, Gauge, LayoutList, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActivityFilters, ActivityScope, ActivitySort, ActivityTeamMember, ActivityView, ActivityWithUserState } from "@/types/activities";

const views: Array<{ id: ActivityView; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Visão geral", icon: Gauge },
  { id: "list", label: "Lista", icon: LayoutList },
  { id: "kanban", label: "Quadro", icon: Columns3 },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "performance", label: "Desempenho", icon: BarChart3 },
];

export function ActivityToolbar({ state, members, activities, canSeeOffice, onView, onScope, onFilters, onSort, onExport }: {
  state: { view: ActivityView; scope: ActivityScope; filters: ActivityFilters; sort: ActivitySort };
  members: ActivityTeamMember[];
  activities: ActivityWithUserState[];
  canSeeOffice: boolean;
  onView: (view: ActivityView) => void;
  onScope: (scope: ActivityScope) => void;
  onFilters: (filters: ActivityFilters) => void;
  onSort: (sort: ActivitySort) => void;
  onExport: () => void;
}) {
  const categories = [...new Set(activities.map(activity => activity.categoria).filter((value): value is string => Boolean(value)))].sort();
  const processes = [...new Map(activities.filter(activity => activity.process).map(activity => [activity.process!.id, activity.process!])).values()];
  const hasFilters = Boolean(state.filters.search || state.filters.assigneeId || state.filters.processId || state.filters.category || state.filters.statuses.length || state.filters.priorities.length || state.filters.due !== "all" || state.filters.favoritesOnly || state.filters.unreadOnly);
  return <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap gap-1 rounded-lg border p-1">{views.map(({ id, label, icon: Icon }) => <Button key={id} size="sm" variant={state.view === id ? "default" : "ghost"} onClick={() => onView(id)}><Icon className="mr-1.5 h-4 w-4" />{label}</Button>)}</div>
      <div className="flex flex-wrap gap-2">{canSeeOffice ? <Select value={state.scope} onValueChange={value => onScope(value as ActivityScope)}><SelectTrigger className="w-40" aria-label="Escopo das atividades"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="office">Escritório</SelectItem><SelectItem value="mine">Minha Lista</SelectItem></SelectContent></Select> : null}<Select value={state.sort} onValueChange={value => onSort(value as ActivitySort)}><SelectTrigger className="w-44" aria-label="Ordenar atividades"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="due_asc">Prazo mais próximo</SelectItem><SelectItem value="due_desc">Prazo mais distante</SelectItem><SelectItem value="priority">Prioridade</SelectItem><SelectItem value="newest">Mais recentes</SelectItem><SelectItem value="oldest">Mais antigas</SelectItem><SelectItem value="title">Título</SelectItem><SelectItem value="points">Mais pontos</SelectItem></SelectContent></Select><Button variant="outline" onClick={onExport}><Download className="mr-2 h-4 w-4" />Exportar</Button></div>
    </div>
    <div className="grid gap-2 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar título, processo ou cliente" value={state.filters.search} onChange={event => onFilters({ ...state.filters, search: event.target.value })} /></div>
      <Select value={state.filters.assigneeId ?? "all"} onValueChange={value => onFilters({ ...state.filters, assigneeId: value === "all" ? null : value })}><SelectTrigger aria-label="Filtrar por responsável"><SelectValue placeholder="Responsável" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os responsáveis</SelectItem><SelectItem value="unassigned">Sem responsável</SelectItem>{members.map(member => <SelectItem key={member.userId} value={member.userId}>{member.name}</SelectItem>)}</SelectContent></Select>
      <Select value={state.filters.processId ?? "all"} onValueChange={value => onFilters({ ...state.filters, processId: value === "all" ? null : value })}><SelectTrigger aria-label="Filtrar por processo"><SelectValue placeholder="Processo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os processos</SelectItem>{processes.map(process => <SelectItem key={process.id} value={process.id}>{process.number}{process.clientName ? ` · ${process.clientName}` : ""}</SelectItem>)}</SelectContent></Select>
      <Select value={state.filters.category ?? "all"} onValueChange={value => onFilters({ ...state.filters, category: value === "all" ? null : value })}><SelectTrigger aria-label="Filtrar por categoria"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
      <Select value={state.filters.statuses[0] ?? "all"} onValueChange={value => onFilters({ ...state.filters, statuses: value === "all" ? [] : [value as ActivityFilters["statuses"][number]] })}><SelectTrigger aria-label="Filtrar por status"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="pendente">A Fazer</SelectItem><SelectItem value="em_andamento">Fazendo</SelectItem><SelectItem value="em_revisao">Revisão</SelectItem><SelectItem value="concluída">Concluída</SelectItem></SelectContent></Select>
      <Select value={state.filters.priorities[0] ?? "all"} onValueChange={value => onFilters({ ...state.filters, priorities: value === "all" ? [] : [value as ActivityFilters["priorities"][number]] })}><SelectTrigger aria-label="Filtrar por prioridade"><SelectValue placeholder="Prioridade" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as prioridades</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="média">Média</SelectItem><SelectItem value="baixa">Baixa</SelectItem></SelectContent></Select>
      <Select value={state.filters.due} onValueChange={value => onFilters({ ...state.filters, due: value as ActivityFilters["due"] })}><SelectTrigger aria-label="Filtrar por prazo"><SelectValue placeholder="Prazo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os prazos</SelectItem><SelectItem value="overdue">Atrasadas</SelectItem><SelectItem value="today">Hoje</SelectItem><SelectItem value="tomorrow">Amanhã</SelectItem><SelectItem value="upcoming">Próximos 7 dias</SelectItem><SelectItem value="future">Futuras</SelectItem><SelectItem value="none">Sem prazo</SelectItem></SelectContent></Select>
      <div className="flex flex-wrap gap-2"><Button variant={state.filters.favoritesOnly ? "default" : "outline"} onClick={() => onFilters({ ...state.filters, favoritesOnly: !state.filters.favoritesOnly })}>Favoritas</Button><Button variant={state.filters.unreadOnly ? "default" : "outline"} onClick={() => onFilters({ ...state.filters, unreadOnly: !state.filters.unreadOnly })}>Não lidas</Button><Button variant="ghost" disabled={!hasFilters} onClick={() => onFilters({ search: "", statuses: [], priorities: [], assigneeId: null, processId: null, category: null, due: "all", favoritesOnly: false, unreadOnly: false })}>Limpar</Button></div>
    </div>
  </div>;
}

