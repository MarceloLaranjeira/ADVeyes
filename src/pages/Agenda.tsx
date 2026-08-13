import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { CalendarSync, Link2, Link2Off, RefreshCw, TriangleAlert } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AgendaAttentionCenter } from "@/components/agenda/AgendaAttentionCenter";
import { AgendaDetailSheet } from "@/components/agenda/AgendaDetailSheet";
import { AgendaToolbar } from "@/components/agenda/AgendaToolbar";
import { AgendaViews } from "@/components/agenda/AgendaViews";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useOperationalCalendar } from "@/hooks/useOperationalCalendar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { agendaRouteParams, agendaVisibleRange, filterOperationalCalendar, findCalendarConflicts, parseAgendaRoute } from "@/lib/agenda-calendar";
import { googleCalendar } from "@/lib/google-calendar";
import type { CalendarEventWithProcess, OperationalCalendarFilters, OperationalCalendarItem, OperationalCalendarScope, OperationalCalendarView } from "@/types/operational-calendar";

const eventTypes = ["audiência", "prazo", "reunião", "despacho", "outro"];

interface EventForm {
  title: string;
  description: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
}

function emptyForm(date: Date): EventForm {
  const startHour = date.getHours() >= 7 && date.getHours() <= 20 ? format(date, "HH:mm") : "09:00";
  const end = new Date(date);
  end.setHours(Number(startHour.slice(0, 2)) + 1, Number(startHour.slice(3)), 0, 0);
  return { title: "", description: "", type: "reunião", date: format(date, "yyyy-MM-dd"), startTime: startHour, endTime: format(end, "HH:mm"), location: "" };
}

function AgendaLoading() {
  return <div className="space-y-4"><Skeleton className="h-32 rounded-2xl" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}</div><Skeleton className="h-[480px] rounded-2xl" /></div>;
}

export default function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const canSeeOffice = Boolean(currentTenant && (currentTenant.accessMode === "platform" || currentTenant.dataScope !== "assigned" || currentTenant.role === "owner" || currentTenant.role === "admin"));
  const defaultScope: OperationalCalendarScope = canSeeOffice ? "office" : "mine";
  const route = useMemo(() => parseAgendaRoute(searchParams, defaultScope), [defaultScope, searchParams]);
  const scope: OperationalCalendarScope = canSeeOffice ? route.scope : "mine";
  const range = useMemo(() => agendaVisibleRange(route.date, route.view), [route.date, route.view]);
  const calendar = useOperationalCalendar(currentTenant?.tenantId ?? null, range, { scope, userId: user?.id });
  const filteredItems = useMemo(() => filterOperationalCalendar(calendar.items, route.filters), [calendar.items, route.filters]);
  const conflicts = useMemo(() => findCalendarConflicts(filteredItems), [filteredItems]);

  const [selectedItem, setSelectedItem] = useState<OperationalCalendarItem | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEventWithProcess | null>(null);
  const [deleteItem, setDeleteItem] = useState<OperationalCalendarItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(() => emptyForm(route.date));
  const [saving, setSaving] = useState(false);
  const [syncToGoogle, setSyncToGoogle] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const updateRoute = useCallback((updates: Partial<typeof route>) => {
    setSearchParams(agendaRouteParams({ ...route, ...updates }));
  }, [route, setSearchParams]);

  useEffect(() => {
    if (!canSeeOffice && route.scope !== "mine") updateRoute({ scope: "mine" });
  }, [canSeeOffice, route.scope, updateRoute]);

  useEffect(() => {
    const oauthResult = googleCalendar.handleOAuthResult();
    if (oauthResult?.connected) toast({ title: "Google Calendar conectado" });
    void googleCalendar.getStatus().then(status => setGoogleConnected(status.connected && status.connection?.status === "connected")).catch(() => setGoogleConnected(false));
  }, [toast]);

  const changeFilters = (filters: OperationalCalendarFilters) => updateRoute({ filters });
  const navigatePeriod = (direction: -1 | 1) => {
    const date = route.view === "month" ? addMonths(route.date, direction) : route.view === "week" ? addWeeks(route.date, direction) : route.view === "list" ? addDays(route.date, direction * 30) : addDays(route.date, direction);
    updateRoute({ date });
  };

  const openNew = (date = route.date) => {
    setSelectedItem(null);
    setEditingEvent(null);
    setForm(emptyForm(date));
    setFormOpen(true);
  };

  const openEdit = (item: OperationalCalendarItem) => {
    const event = calendar.events.find(candidate => candidate.id === item.sourceId);
    if (!event) return;
    const start = new Date(event.data_inicio);
    const end = event.data_fim ? new Date(event.data_fim) : addDays(start, 0);
    if (!event.data_fim) end.setHours(start.getHours() + 1);
    setEditingEvent(event);
    setForm({ title: event.titulo, description: event.descricao ?? "", type: event.tipo, date: format(start, "yyyy-MM-dd"), startTime: format(start, "HH:mm"), endTime: format(end, "HH:mm"), location: event.local ?? "" });
    setSelectedItem(null);
    setFormOpen(true);
  };

  const saveEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !currentTenant || !form.title.trim()) return;
    const start = `${form.date}T${form.startTime}:00`;
    const end = `${form.date}T${form.endTime}:00`;
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      toast({ title: "Horário inválido", description: "O término precisa ser posterior ao início.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { titulo: form.title.trim(), descricao: form.description.trim() || null, tipo: form.type, data_inicio: start, data_fim: end, local: form.location.trim() || null };
    try {
      if (editingEvent) {
        const { error } = await supabase.from("eventos").update(payload).eq("tenant_id", currentTenant.tenantId).eq("id", editingEvent.id);
        if (error) throw error;
        toast({ title: "Compromisso atualizado" });
        if (googleConnected && editingEvent.google_event_id) {
          try { await googleCalendar.updateEvent(editingEvent.google_event_id, { titulo: form.title, descricao: form.description, data_inicio: start, data_fim: end, local: form.location, colorId: "7" }); }
          catch { toast({ title: "Salvo no ADVeyes", description: "A atualização no Google Calendar ficou pendente.", variant: "destructive" }); }
        }
      } else {
        const { data, error } = await supabase.from("eventos").insert({ ...payload, user_id: user.id, tenant_id: currentTenant.tenantId }).select().single();
        if (error) throw error;
        toast({ title: "Compromisso criado" });
        if (googleConnected && syncToGoogle && data) {
          try { await googleCalendar.createEvent({ titulo: form.title, descricao: form.description, data_inicio: start, data_fim: end, local: form.location, colorId: "7" }); }
          catch { toast({ title: "Salvo no ADVeyes", description: "A sincronização com o Google ficou pendente.", variant: "destructive" }); }
        }
      }
      setFormOpen(false);
      await calendar.refetch();
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteItem || !currentTenant) return;
    try {
      const { error } = await supabase.from("eventos").delete().eq("tenant_id", currentTenant.tenantId).eq("id", deleteItem.sourceId);
      if (error) throw error;
      const event = calendar.events.find(candidate => candidate.id === deleteItem.sourceId);
      if (googleConnected && event?.google_event_id) {
        try { await googleCalendar.deleteEvent(event.google_event_id); }
        catch { toast({ title: "Excluído do ADVeyes", description: "O evento pode precisar ser removido manualmente do Google.", variant: "destructive" }); }
      }
      setDeleteItem(null);
      setSelectedItem(null);
      toast({ title: "Compromisso excluído" });
      await calendar.refetch();
    } catch (error) { toast({ title: "Não foi possível excluir", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" }); }
  };

  const connectGoogle = async () => {
    try { await googleCalendar.connect(`${window.location.origin}/agenda?${agendaRouteParams({ ...route, scope }).toString()}`); }
    catch { toast({ title: "Não foi possível conectar", description: "Verifique a configuração e tente novamente.", variant: "destructive" }); }
  };

  const syncGoogle = async () => {
    setGoogleSyncing(true);
    try { const result = await googleCalendar.syncNow(); toast({ title: `${result.completed} item(ns) sincronizado(s)`, description: result.retried ? `${result.retried} permanecem na fila.` : undefined }); await calendar.refetch(); }
    catch { toast({ title: "Sincronização pendente", description: "Os itens continuarão na fila para nova tentativa.", variant: "destructive" }); }
    finally { setGoogleSyncing(false); }
  };

  const disconnectGoogle = async (removeEvents: boolean) => {
    setDisconnecting(true);
    try { await googleCalendar.disconnect(removeEvents); setGoogleConnected(false); setDisconnectOpen(false); toast({ title: "Google Calendar desconectado" }); }
    catch { toast({ title: "Não foi possível desconectar", variant: "destructive" }); }
    finally { setDisconnecting(false); }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="font-serif text-4xl font-bold tracking-tight">Agenda</h1><p className="mt-1 text-sm text-muted-foreground">Compromissos, prazos, tarefas e audiências em um só lugar.</p></div><div className="flex items-center gap-2">{googleConnected ? <><Button variant="outline" size="sm" onClick={syncGoogle} disabled={googleSyncing}><RefreshCw className={`mr-2 h-4 w-4 ${googleSyncing ? "animate-spin" : ""}`} />Sincronizar</Button><Button variant="ghost" size="sm" onClick={() => setDisconnectOpen(true)}><Link2Off className="mr-2 h-4 w-4" />Google conectado</Button></> : <Button variant="outline" size="sm" onClick={connectGoogle}><Link2 className="mr-2 h-4 w-4" />Conectar Google</Button>}</div></header>

        <AgendaToolbar date={route.date} view={route.view} scope={scope} filters={route.filters} items={calendar.items} members={calendar.members} canSeeOffice={canSeeOffice} onNavigate={navigatePeriod} onToday={() => updateRoute({ date: new Date() })} onViewChange={(view: OperationalCalendarView) => updateRoute({ view })} onScopeChange={(nextScope: OperationalCalendarScope) => updateRoute({ scope: nextScope, filters: { ...route.filters, assigneeId: null } })} onFiltersChange={changeFilters} onNew={() => openNew()} />

        {calendar.isLoading ? <AgendaLoading /> : calendar.isError ? <Alert variant="destructive"><TriangleAlert className="h-4 w-4" /><AlertTitle>Não foi possível carregar a Agenda</AlertTitle><AlertDescription><Button className="mt-3" variant="outline" onClick={() => calendar.refetch()}>Tentar novamente</Button></AlertDescription></Alert> : <><AgendaAttentionCenter items={filteredItems} conflicts={conflicts} />{calendar.failures.length ? <Alert><TriangleAlert className="h-4 w-4" /><AlertTitle>Agenda parcialmente atualizada</AlertTitle><AlertDescription>{calendar.failures.map(failure => failure.source).join(", ")} indisponível. Os demais dados foram preservados.</AlertDescription></Alert> : null}<AgendaViews view={route.view} date={route.date} range={range} items={filteredItems} members={calendar.members} onSelect={setSelectedItem} onNewAt={openNew} /></>}
      </div>

      <AgendaDetailSheet item={selectedItem} members={calendar.members} onClose={() => setSelectedItem(null)} onEdit={openEdit} onDelete={setDeleteItem} />

      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editingEvent ? "Editar compromisso" : "Novo compromisso"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={saveEvent}><div className="space-y-2"><Label htmlFor="event-title">Título</Label><Input id="event-title" required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tipo</Label><Select value={form.type} onValueChange={type => setForm({ ...form, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{eventTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="event-date">Data</Label><Input id="event-date" type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="start-time">Início</Label><Input id="start-time" type="time" required value={form.startTime} onChange={event => setForm({ ...form, startTime: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="end-time">Fim</Label><Input id="end-time" type="time" required value={form.endTime} onChange={event => setForm({ ...form, endTime: event.target.value })} /></div></div><div className="space-y-2"><Label htmlFor="event-location">Local</Label><Input id="event-location" value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="event-description">Descrição</Label><Textarea id="event-description" rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></div>{googleConnected && !editingEvent ? <div className="flex items-center justify-between rounded-lg border p-3"><div className="flex items-center gap-2"><CalendarSync className="h-4 w-4 text-muted-foreground" /><Label htmlFor="sync-google">Sincronizar com Google</Label></div><Switch id="sync-google" checked={syncToGoogle} onCheckedChange={setSyncToGoogle} /></div> : null}<Button className="w-full" type="submit" disabled={saving}>{saving ? "Salvando..." : editingEvent ? "Salvar alterações" : "Criar compromisso"}</Button></form></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteItem)} onOpenChange={open => { if (!open) setDeleteItem(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir compromisso?</AlertDialogTitle><AlertDialogDescription>Esta ação remove o compromisso da Agenda. Os dados só desaparecerão após a confirmação do banco.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desconectar Google Calendar?</AlertDialogTitle><AlertDialogDescription>Você pode manter no Google os eventos já criados ou solicitar sua remoção.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={disconnecting}>Cancelar</AlertDialogCancel><Button variant="outline" disabled={disconnecting} onClick={() => disconnectGoogle(false)}>Manter eventos</Button><AlertDialogAction disabled={disconnecting} onClick={() => disconnectGoogle(true)}>Remover e desconectar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </AppLayout>
  );
}
