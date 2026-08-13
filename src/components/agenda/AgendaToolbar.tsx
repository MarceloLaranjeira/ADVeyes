import { ChevronLeft, ChevronRight, Filter, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  OperationalCalendarFilters,
  OperationalCalendarItem,
  OperationalCalendarMember,
  OperationalCalendarScope,
  OperationalCalendarView,
} from "@/types/operational-calendar";

const viewLabels: Record<OperationalCalendarView, string> = {
  month: "Mês",
  week: "Semana",
  day: "Dia",
  list: "Lista",
};

export function AgendaToolbar({
  date,
  view,
  scope,
  filters,
  items,
  members,
  canSeeOffice,
  onNavigate,
  onToday,
  onViewChange,
  onScopeChange,
  onFiltersChange,
  onNew,
}: {
  date: Date;
  view: OperationalCalendarView;
  scope: OperationalCalendarScope;
  filters: OperationalCalendarFilters;
  items: OperationalCalendarItem[];
  members: OperationalCalendarMember[];
  canSeeOffice: boolean;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  onViewChange: (view: OperationalCalendarView) => void;
  onScopeChange: (scope: OperationalCalendarScope) => void;
  onFiltersChange: (filters: OperationalCalendarFilters) => void;
  onNew: () => void;
}) {
  const itemTypes = [...new Set(items.map(item => item.type).filter(Boolean))].sort();
  const statuses = [...new Set(items.map(item => item.status).filter((value): value is string => Boolean(value)))].sort();
  const processes = [...new Map(items.filter(item => item.processId).map(item => [item.processId!, { id: item.processId!, label: item.processNumber ?? item.title }])).values()];
  const clients = [...new Set(items.map(item => item.clientName).filter((value): value is string => Boolean(value)))].sort();
  const periodLabel = view === "month"
    ? format(date, "MMMM 'de' yyyy", { locale: ptBR })
    : format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onNavigate(-1)} aria-label="Período anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={onToday}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => onNavigate(1)} aria-label="Próximo período"><ChevronRight className="h-4 w-4" /></Button>
          <h2 className="ml-2 capitalize font-semibold">{periodLabel}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSeeOffice ? (
            <Select value={scope} onValueChange={value => onScopeChange(value as OperationalCalendarScope)}>
              <SelectTrigger className="w-[150px]" aria-label="Escopo da agenda"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="office">Escritório</SelectItem><SelectItem value="mine">Minha Agenda</SelectItem></SelectContent>
            </Select>
          ) : null}
          <div className="inline-flex rounded-lg border p-1" aria-label="Visualização da agenda">
            {(Object.keys(viewLabels) as OperationalCalendarView[]).map(option => (
              <Button key={option} type="button" size="sm" variant={view === option ? "default" : "ghost"} onClick={() => onViewChange(option)}>{viewLabels[option]}</Button>
            ))}
          </div>
          <Button onClick={onNew}><Plus className="mr-2 h-4 w-4" />Novo</Button>
        </div>
      </div>

      <div className="grid gap-2 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Filter className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar título, cliente ou processo" value={filters.query ?? ""} onChange={event => onFiltersChange({ ...filters, query: event.target.value || null })} />
        </div>
        <Select value={filters.sourceType ?? "all"} onValueChange={value => onFiltersChange({ ...filters, sourceType: value as OperationalCalendarFilters["sourceType"] })}>
          <SelectTrigger aria-label="Filtrar por origem"><SelectValue placeholder="Todas as origens" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as origens</SelectItem><SelectItem value="event">Compromissos</SelectItem><SelectItem value="task">Tarefas</SelectItem><SelectItem value="hearing">Audiências</SelectItem></SelectContent>
        </Select>
        <Select value={filters.itemType ?? "all"} onValueChange={value => onFiltersChange({ ...filters, itemType: value === "all" ? null : value })}>
          <SelectTrigger aria-label="Filtrar por tipo"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{itemTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
        </Select>
        {scope === "office" ? (
          <Select value={filters.assigneeId ?? "all"} onValueChange={value => onFiltersChange({ ...filters, assigneeId: value === "all" ? null : value })}>
            <SelectTrigger aria-label="Filtrar por profissional"><SelectValue placeholder="Todos os profissionais" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="unassigned">Sem responsável</SelectItem>{members.filter(member => member.userId).map(member => <SelectItem key={member.id} value={member.userId!}>{member.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}
        <Select value={filters.processId ?? "all"} onValueChange={value => onFiltersChange({ ...filters, processId: value === "all" ? null : value })}><SelectTrigger aria-label="Filtrar por processo"><SelectValue placeholder="Todos os processos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os processos</SelectItem>{processes.map(process => <SelectItem key={process.id} value={process.id}>{process.label}</SelectItem>)}</SelectContent></Select>
        <Select value={filters.clientName ?? "all"} onValueChange={value => onFiltersChange({ ...filters, clientName: value === "all" ? null : value })}><SelectTrigger aria-label="Filtrar por cliente"><SelectValue placeholder="Todos os clientes" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.map(client => <SelectItem key={client} value={client}>{client}</SelectItem>)}</SelectContent></Select>
        <Select value={filters.status ?? "all"} onValueChange={value => onFiltersChange({ ...filters, status: value === "all" ? null : value })}><SelectTrigger aria-label="Filtrar por status"><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{statuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
        <Button variant="ghost" disabled={!filters.query && !filters.assigneeId && !filters.itemType && !filters.processId && !filters.clientName && !filters.status && (!filters.sourceType || filters.sourceType === "all")} onClick={() => onFiltersChange({ sourceType: "all" })}>Limpar filtros</Button>
      </div>
    </div>
  );
}
