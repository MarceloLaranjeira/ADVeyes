import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { ActivityBulkBar, type BulkAction } from "@/components/activities/ActivityBulkBar";
import { ActivityCalendar } from "@/components/activities/ActivityCalendar";
import { ActivityDetailSheet } from "@/components/activities/ActivityDetailSheet";
import { ActivityKanban } from "@/components/activities/ActivityKanban";
import { ActivityList } from "@/components/activities/ActivityList";
import { ActivityToolbar } from "@/components/activities/ActivityToolbar";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useActiveTeamMembers } from "@/hooks/useActiveTeamMembers";
import { useActivities } from "@/hooks/useActivities";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { calculateActivityMetrics, classifyActivityDueDate } from "@/lib/activity-status";
import { activitiesToCsv, activityRouteParams, filterActivities, paginateActivities, parseActivityRoute, reconcileActivitySelection, sortActivities } from "@/lib/activity-workspace";
import type { ActivityFilters, ActivityPriority, ActivityScope, ActivitySort, ActivityStatus, ActivityView, ActivityWithUserState } from "@/types/activities";

interface ProcessOption { id: string; number: string; clientName: string | null }
interface ActivityForm { title: string; description: string; priority: ActivityPriority; status: ActivityStatus; due: string; processId: string; assigneeId: string; category: string; points: string }

const emptyForm = (userId: string | null, status: ActivityStatus = "pendente"): ActivityForm => ({ title: "", description: "", priority: "média", status, due: "", processId: "", assigneeId: userId ?? "", category: "", points: "0" });
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

function ActivityMetrics({ activities }: { activities: ActivityWithUserState[] }) {
  const metrics = calculateActivityMetrics(activities);
  const unassigned = activities.filter(activity => !activity.responsavel_id && activity.status !== "concluída").length;
  const cards = [
    ["A Fazer", metrics.pending, "text-amber-600"], ["Fazendo", metrics.inProgress, "text-blue-600"], ["Revisão", metrics.inReview, "text-purple-600"], ["Concluídas", metrics.completed, "text-green-600"], ["Atrasadas", metrics.overdue, "text-red-600"], ["Pontos", metrics.completedPoints, "text-amber-600"], ["Sem responsável", unassigned, "text-orange-600"],
  ] as const;
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value, color]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></CardContent></Card>)}</div>;
}

function Overview({ activities, members, onOpen }: { activities: ActivityWithUserState[]; members: ReturnType<typeof useActiveTeamMembers>["data"]; onOpen: (activity: ActivityWithUserState) => void }) {
  const open = activities.filter(activity => activity.status !== "concluída");
  return <div className="grid gap-4 lg:grid-cols-2"><Card><CardContent className="p-5"><h2 className="mb-4 font-semibold">Prioridades imediatas</h2><div className="space-y-2">{open.slice(0, 8).map(activity => { const due = classifyActivityDueDate(activity.data_limite); return <button key={activity.id} type="button" onClick={() => onOpen(activity)} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/40"><span className="truncate font-medium">{activity.titulo}</span><span className={`shrink-0 text-xs ${due.urgent ? "text-destructive" : "text-muted-foreground"}`}>{due.label ?? "Sem prazo"}</span></button>; })}{!open.length ? <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma prioridade pendente.</p> : null}</div></CardContent></Card><Card><CardContent className="p-5"><h2 className="mb-4 font-semibold">Carga por responsável</h2><div className="space-y-4">{(members ?? []).map(member => { const amount = open.filter(activity => activity.responsavel_id === member.userId).length; const width = open.length ? Math.round(amount / open.length * 100) : 0; return <div key={member.userId}><div className="mb-1 flex justify-between text-sm"><span>{member.name}</span><span>{amount}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} /></div></div>; })}</div></CardContent></Card></div>;
}

function Performance({ activities, members }: { activities: ActivityWithUserState[]; members: NonNullable<ReturnType<typeof useActiveTeamMembers>["data"]> }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{members.map(member => { const metrics = calculateActivityMetrics(activities.filter(activity => activity.responsavel_id === member.userId)); return <Card key={member.userId}><CardContent className="p-5"><div className="mb-5 flex items-center gap-3"><Avatar><AvatarImage src={member.avatarUrl ?? undefined} /><AvatarFallback>{initials(member.name)}</AvatarFallback></Avatar><div><p className="font-semibold">{member.name}</p><p className="text-xs text-muted-foreground">{member.jobTitle ?? "Equipe"}</p></div></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-muted/50 p-2"><p className="text-xl font-bold">{metrics.completed}</p><p className="text-[10px] text-muted-foreground">Concluídas</p></div><div className="rounded-lg bg-muted/50 p-2"><p className="text-xl font-bold">{metrics.pending + metrics.inProgress + metrics.inReview}</p><p className="text-[10px] text-muted-foreground">Abertas</p></div><div className="rounded-lg bg-muted/50 p-2"><p className="text-xl font-bold">{metrics.completedPoints}</p><p className="text-[10px] text-muted-foreground">Pontos</p></div></div></CardContent></Card>; })}</div>;
}

export default function Tarefas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.tenantId ?? null;
  const userId = user?.id ?? null;
  const canSeeOffice = Boolean(currentTenant && (currentTenant.accessMode === "platform" || currentTenant.role === "owner" || currentTenant.role === "admin" || currentTenant.dataScope !== "assigned"));
  const defaultScope: ActivityScope = canSeeOffice ? "office" : "mine";
  const route = useMemo(() => parseActivityRoute(searchParams, defaultScope), [defaultScope, searchParams]);
  const scope = canSeeOffice ? route.scope : "mine";
  const activityData = useActivities(tenantId, userId);
  const { data: members = [] } = useActiveTeamMembers(tenantId);
  const filtered = useMemo(() => sortActivities(filterActivities(activityData.activities, route.filters, scope, userId), route.sort), [activityData.activities, route.filters, route.sort, scope, userId]);
  const pagination = useMemo(() => paginateActivities(filtered, route.page, route.pageSize), [filtered, route.page, route.pageSize]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<ActivityWithUserState | null>(null);
  const [editing, setEditing] = useState<ActivityWithUserState | null>(null);
  const [deleting, setDeleting] = useState<ActivityWithUserState | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ActivityForm>(() => emptyForm(userId));
  const [saving, setSaving] = useState(false);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);

  const updateRoute = useCallback((changes: Partial<typeof route>) => setSearchParams(activityRouteParams({ ...route, ...changes })), [route, setSearchParams]);

  useEffect(() => { if (!canSeeOffice && route.scope !== "mine") updateRoute({ scope: "mine", view: "list" }); }, [canSeeOffice, route.scope, updateRoute]);
  useEffect(() => {
    setSelected(current => {
      const next = reconcileActivitySelection(current, filtered);
      if (next.size === current.size && [...next].every(id => current.has(id))) return current;
      return next;
    });
  }, [filtered]);
  useEffect(() => {
    if (!tenantId) return;
    void supabase.from("processos").select("id, numero, cliente_nome").eq("tenant_id", tenantId).order("numero").then(({ data }) => setProcesses((data ?? []).map(process => ({ id: process.id, number: process.numero, clientName: process.cliente_nome }))));
  }, [tenantId]);
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || activityData.loading) return;
    const activity = activityData.activities.find(item => item.id === taskId);
    if (activity) setActive(activity);
  }, [activityData.activities, activityData.loading, searchParams]);

  const openNew = (status: ActivityStatus = "pendente") => { setEditing(null); setForm(emptyForm(userId, status)); setFormOpen(true); };
  const openEdit = (activity: ActivityWithUserState) => { setEditing(activity); setActive(null); setForm({ title: activity.titulo, description: activity.descricao ?? "", priority: activity.prioridade as ActivityPriority, status: activity.status as ActivityStatus, due: activity.data_limite ?? "", processId: activity.processo_id ?? "", assigneeId: activity.responsavel_id ?? "", category: activity.categoria ?? "", points: String(activity.pontos) }); setFormOpen(true); if (!activity.userState?.lida_em) void activityData.setUserState.mutateAsync({ id: activity.id, lidaEm: new Date().toISOString() }); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!user || !currentTenant || !form.title.trim()) return; setSaving(true);
    const input = { titulo: form.title.trim(), descricao: form.description.trim() || null, prioridade: form.priority, status: form.status, data_limite: form.due || null, processo_id: form.processId || null, responsavel_id: form.assigneeId || null, categoria: form.category.trim() || null, pontos: Math.max(0, Number.parseInt(form.points, 10) || 0) };
    try { if (editing) await activityData.update.mutateAsync({ id: editing.id, input }); else await activityData.create.mutateAsync({ ...input, tenant_id: currentTenant.tenantId, user_id: user.id }); setFormOpen(false); toast({ title: editing ? "Atividade atualizada" : "Atividade criada" }); } catch (error) { toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : undefined, variant: "destructive" }); } finally { setSaving(false); }
  };

  const changeStatus = async (activity: ActivityWithUserState, status: string) => { if (activity.status === status) return; try { await activityData.update.mutateAsync({ id: activity.id, input: { status } }); setActive(current => current?.id === activity.id ? { ...current, status } : current); } catch (error) { toast({ title: "Não foi possível mudar o status", description: error instanceof Error ? error.message : undefined, variant: "destructive" }); } };
  const toggleFavorite = async (activity: ActivityWithUserState) => { try { await activityData.setUserState.mutateAsync({ id: activity.id, favorita: !activity.userState?.favorita }); } catch { toast({ title: "Não foi possível alterar o favorito", variant: "destructive" }); } };
  const remove = async () => { if (!deleting) return; try { await activityData.remove.mutateAsync(deleting.id); setDeleting(null); setActive(null); toast({ title: "Atividade excluída" }); } catch (error) { toast({ title: "Não foi possível excluir", description: error instanceof Error ? error.message : undefined, variant: "destructive" }); } };

  const bulkAction = async (action: BulkAction) => {
    const ids = [...selected]; if (!ids.length) return;
    const input = action.kind === "delete" ? { ids, remove: true } : action.kind === "read" ? { ids, markReadAt: new Date().toISOString() } : action.kind === "status" ? { ids, update: { status: action.value } } : action.kind === "priority" ? { ids, update: { prioridade: action.value } } : action.kind === "assignee" ? { ids, update: { responsavel_id: action.value } } : { ids, update: { data_limite: action.value } };
    const result = await activityData.bulk.mutateAsync(input);
    setSelected(new Set(result.failed.map(item => item.id)));
    toast({ title: `${result.succeeded.length} atividade(s) atualizada(s)`, description: result.failed.length ? `${result.failed.length} falharam e permanecem selecionadas.` : undefined, variant: result.failed.length ? "destructive" : "default" });
  };

  const exportCsv = () => {
    const csv = activitiesToCsv(filtered, new Map(members.map(member => [member.userId, member.name])));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `atividades-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <AppLayout><div className="animate-fade-in space-y-5"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="font-serif text-4xl font-bold tracking-tight">Atividades</h1><p className="mt-1 text-sm text-muted-foreground">Execução, produtividade e carga do escritório em um só fluxo.</p></div><Button onClick={() => openNew()}><Plus className="mr-2 h-4 w-4" />Nova atividade</Button></header>
    <ActivityMetrics activities={filtered} />
    <ActivityToolbar state={{ ...route, scope }} members={members} activities={activityData.activities} canSeeOffice={canSeeOffice} onView={(view: ActivityView) => updateRoute({ view, page: 1 })} onScope={(nextScope: ActivityScope) => updateRoute({ scope: nextScope, view: nextScope === "mine" ? "list" : "overview", page: 1, filters: { ...route.filters, assigneeId: null } })} onFilters={(filters: ActivityFilters) => updateRoute({ filters, page: 1 })} onSort={(sort: ActivitySort) => updateRoute({ sort, page: 1 })} onExport={exportCsv} />
    {activityData.loading ? <div className="space-y-3"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-72 rounded-2xl" /></div> : activityData.error ? <Alert variant="destructive"><TriangleAlert className="h-4 w-4" /><AlertTitle>Não foi possível carregar as atividades</AlertTitle><AlertDescription><Button variant="outline" className="mt-3" onClick={() => activityData.refresh()}>Tentar novamente</Button></AlertDescription></Alert> : route.view === "overview" ? <Overview activities={filtered} members={members} onOpen={setActive} /> : route.view === "list" ? <ActivityList items={pagination.items} members={members} selected={selected} page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={route.pageSize} onToggle={id => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onTogglePage={(ids, checked) => setSelected(current => { const next = new Set(current); ids.forEach(id => checked ? next.add(id) : next.delete(id)); return next; })} onOpen={setActive} onFavorite={toggleFavorite} onPage={page => updateRoute({ page })} onPageSize={pageSize => updateRoute({ pageSize, page: 1 })} /> : route.view === "kanban" ? <ActivityKanban activities={filtered} members={members} onOpen={setActive} onMove={changeStatus} onNew={openNew} /> : route.view === "calendar" ? <ActivityCalendar activities={filtered} onOpen={setActive} /> : <Performance activities={filtered} members={members} />}
    <ActivityBulkBar count={selected.size} members={members} busy={activityData.bulk.isPending} onAction={bulkAction} onClear={() => setSelected(new Set())} />
  </div>
  <ActivityDetailSheet activity={active} members={members} onClose={() => setActive(null)} onEdit={openEdit} onFavorite={toggleFavorite} onDelete={setDeleting} onStatus={changeStatus} />
  <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? "Editar atividade" : "Nova atividade"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={save}><div className="space-y-2"><Label htmlFor="activity-title">Título</Label><Input id="activity-title" required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="activity-description">Descrição</Label><Textarea id="activity-description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="activity-priority">Prioridade</Label><Select value={form.priority} onValueChange={value => setForm({ ...form, priority: value as ActivityPriority })}><SelectTrigger id="activity-priority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alta">Alta</SelectItem><SelectItem value="média">Média</SelectItem><SelectItem value="baixa">Baixa</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="activity-status">Status</Label><Select value={form.status} onValueChange={value => setForm({ ...form, status: value as ActivityStatus })}><SelectTrigger id="activity-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pendente">A Fazer</SelectItem><SelectItem value="em_andamento">Fazendo</SelectItem><SelectItem value="concluída">Concluída</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label htmlFor="activity-process">Processo vinculado</Label><Select value={form.processId || "none"} onValueChange={value => setForm({ ...form, processId: value === "none" ? "" : value })}><SelectTrigger id="activity-process"><SelectValue placeholder="Selecionar processo" /></SelectTrigger><SelectContent className="max-h-52"><SelectItem value="none">Nenhum</SelectItem>{processes.map(process => <SelectItem key={process.id} value={process.id}>{process.number}{process.clientName ? ` · ${process.clientName}` : ""}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="activity-assignee">Responsável</Label><Select value={form.assigneeId || "none"} onValueChange={value => setForm({ ...form, assigneeId: value === "none" ? "" : value })}><SelectTrigger id="activity-assignee"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem responsável</SelectItem>{members.map(member => <SelectItem key={member.userId} value={member.userId}>{member.name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="activity-due">Prazo</Label><Input id="activity-due" type="date" value={form.due} onChange={event => setForm({ ...form, due: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="activity-points">Pontos</Label><Input id="activity-points" type="number" min="0" value={form.points} onChange={event => setForm({ ...form, points: event.target.value })} /></div></div><div className="space-y-2"><Label htmlFor="activity-category">Categoria</Label><Input id="activity-category" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} /></div><Button className="w-full" type="submit" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar atividade"}</Button></form></DialogContent></Dialog>
  <AlertDialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir atividade?</AlertDialogTitle><AlertDialogDescription>A atividade só desaparecerá após a confirmação do banco.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={remove}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </AppLayout>;
}
