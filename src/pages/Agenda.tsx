import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, MapPin, Trash2, Pencil, ChevronLeft, ChevronRight, CalendarDays, ListTodo, AlertCircle, RefreshCw, Link2, Link2Off } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, isToday, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { googleCalendar } from "@/lib/google-calendar";
import { Switch } from "@/components/ui/switch";

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Evento {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  data_inicio: string;
  local?: string;
}

interface Tarefa {
  id: string;
  titulo: string;
  data_limite?: string | null;
  status: string;
  prioridade?: string;
}

interface Audiencia {
  id: string;
  tipo: string;
  data_hora: string;
  vara?: string;
  status?: string;
  processos?: { numero?: string; cliente_nome?: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const tipoOptions = ["audiência", "prazo", "reunião", "despacho", "outro"];

const tipoColors: Record<string, { border: string; bg: string; dot: string }> = {
  audiência: { border: "border-l-red-500",    bg: "bg-red-500/5",    dot: "bg-red-500"    },
  prazo:     { border: "border-l-orange-500", bg: "bg-orange-500/5", dot: "bg-orange-500" },
  reunião:   { border: "border-l-blue-500",   bg: "bg-blue-500/5",   dot: "bg-blue-500"   },
  despacho:  { border: "border-l-primary",    bg: "bg-primary/5",    dot: "bg-primary"    },
  outro:     { border: "border-l-muted-foreground", bg: "bg-muted/30", dot: "bg-muted-foreground" },
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7h–18h

function fmtTime(dt: string) { return format(new Date(dt), "HH:mm"); }
function fmtDateShort(d: Date) { return format(d, "dd/MM", { locale: ptBR }); }
function fmtWeekDay(d: Date) { return format(d, "EEE", { locale: ptBR }); }

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ evento, onEdit, onDelete, compact = false }: {
  evento: Evento; onEdit: (e: Evento) => void; onDelete: (id: string) => void; compact?: boolean;
}) {
  const colors = tipoColors[evento.tipo] || tipoColors.outro;
  return (
    <div
      className={`border border-l-4 ${colors.border} ${colors.bg} rounded-xl p-3 group hover:shadow-sm transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="w-3 h-3 shrink-0" />
            <span>{fmtTime(evento.data_inicio)}</span>
            <span className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] uppercase font-medium">{evento.tipo}</span>
          </div>
          <p className="font-medium text-sm truncate">{evento.titulo}</p>
          {!compact && evento.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{evento.descricao}</p>}
          {!compact && evento.local && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="w-3 h-3 shrink-0" /> {evento.local}
            </p>
          )}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
          <button onClick={() => onEdit(evento)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(evento.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({ weekStart, eventos, onEdit, onDelete, onNewOnDay }: {
  weekStart: Date; eventos: Evento[];
  onEdit: (e: Evento) => void; onDelete: (id: string) => void;
  onNewOnDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      {/* Header */}
      <div className="grid grid-cols-8 border-b">
        <div className="p-3" />
        {days.map(d => (
          <div
            key={d.toISOString()}
            onClick={() => onNewOnDay(d)}
            className={`p-3 text-center border-l cursor-pointer hover:bg-muted/30 transition-colors ${isToday(d) ? "bg-primary/5" : ""}`}
          >
            <p className="text-xs text-muted-foreground capitalize">{fmtWeekDay(d)}</p>
            <p className={`text-lg font-bold mt-0.5 ${isToday(d) ? "text-primary" : ""}`}>{format(d, "d")}</p>
            <p className="text-[10px] text-muted-foreground">{fmtDateShort(d)}</p>
          </div>
        ))}
      </div>

      {/* Hour rows */}
      {HOURS.map(h => (
        <div key={h} className="grid grid-cols-8 border-b last:border-0 min-h-[56px]">
          <div className="p-2 text-right text-[11px] text-muted-foreground border-r pt-3 shrink-0">
            {h.toString().padStart(2, "0")}:00
          </div>
          {days.map(d => {
            const evts = eventos.filter(e => {
              const ed = new Date(e.data_inicio);
              return isSameDay(ed, d) && ed.getHours() === h;
            });
            return (
              <div key={d.toISOString()} className={`border-l p-1 space-y-1 ${isToday(d) ? "bg-primary/3" : ""}`}>
                {evts.map(e => {
                  const c = tipoColors[e.tipo] || tipoColors.outro;
                  return (
                    <div key={e.id} className={`text-[10px] px-1.5 py-1 rounded border-l-2 ${c.border.replace("border-l-", "border-l-")} ${c.bg} cursor-pointer group`}
                      onClick={() => onEdit(e)}>
                      <span className="font-medium">{fmtTime(e.data_inicio)}</span>
                      <span className="ml-1 truncate">{e.titulo}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const Agenda = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [eventos, setEventos]       = useState<Evento[]>([]);
  const [tarefas, setTarefas]       = useState<Tarefa[]>([]);
  const [audiencias, setAudiencias] = useState<Audiencia[]>([]);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalSyncing, setGcalSyncing] = useState(false);
  const [syncToGcal, setSyncToGcal] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [viewMode, setViewMode]   = useState<"mes" | "semana" | "dia">("mes");
  const [activeTab, setActiveTab] = useState("compromissos");
  const [showForm, setShowForm]   = useState(false);
  const [editData, setEditData]   = useState<Evento | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", tipo: "reunião", data_inicio: "", hora_inicio: "09:00", local: "",
  });

  // Google Calendar: detect token on mount (after OAuth redirect)
  useEffect(() => {
    const token = googleCalendar.extractToken() || googleCalendar.getToken();
    setGcalConnected(!!token);
  }, []);

  const handleGcalConnect = () => googleCalendar.authorize();
  const handleGcalDisconnect = () => { googleCalendar.disconnect(); setGcalConnected(false); toast({ title: "Google Calendar desconectado" }); };

  const syncAllToGcal = async () => {
    if (!gcalConnected) return;
    setGcalSyncing(true);
    let ok = 0;
    for (const e of eventos) {
      const result = await googleCalendar.createEvent({ titulo: e.titulo, descricao: e.descricao, data_inicio: e.data_inicio, local: e.local });
      if (result) ok++;
    }
    toast({ title: `${ok} evento(s) sincronizado(s) com Google Calendar!` });
    setGcalSyncing(false);
  };

  const fetchAll = async () => {
    const now = new Date();
    const em30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const [evts, tar, aud] = await Promise.all([
      supabase.from("eventos").select("*").order("data_inicio"),
      supabase.from("tarefas").select("*").neq("status", "concluída").not("data_limite", "is", null).order("data_limite"),
      supabase.from("audiencias").select("*, processos(numero, cliente_nome)").gte("data_hora", now.toISOString()).order("data_hora").limit(20),
    ]);
    if (evts.data) setEventos(evts.data);
    if (tar.data)  setTarefas(tar.data);
    if (aud.data)  setAudiencias(aud.data);
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (editData) {
      const d = new Date(editData.data_inicio);
      setForm({ titulo: editData.titulo || "", descricao: editData.descricao || "", tipo: editData.tipo || "reunião", data_inicio: format(d, "yyyy-MM-dd"), hora_inicio: format(d, "HH:mm"), local: editData.local || "" });
    } else {
      setForm({ titulo: "", descricao: "", tipo: "reunião", data_inicio: format(selectedDate, "yyyy-MM-dd"), hora_inicio: "09:00", local: "" });
    }
  }, [editData, showForm, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) { toast({ title: "Título é obrigatório", variant: "destructive" }); return; }
    setLoading(true);
    const data_inicio = `${form.data_inicio}T${form.hora_inicio}:00`;
    if (editData) {
      const { error } = await supabase.from("eventos").update({ titulo: form.titulo, descricao: form.descricao || null, tipo: form.tipo, data_inicio, local: form.local || null }).eq("id", editData.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Evento atualizado!" }); setShowForm(false); fetchAll(); }
    } else {
      const { data: inserted, error } = await supabase.from("eventos").insert({ titulo: form.titulo, descricao: form.descricao || null, tipo: form.tipo, data_inicio, local: form.local || null, user_id: user!.id }).select().single();
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else {
        // Sync to Google Calendar if connected and toggle is on
        if (gcalConnected && syncToGcal && inserted) {
          await googleCalendar.createEvent({ titulo: form.titulo, descricao: form.descricao, data_inicio, local: form.local });
        }
        toast({ title: gcalConnected && syncToGcal ? "Evento criado e sincronizado com Google!" : "Evento criado!" });
        setShowForm(false);
        fetchAll();
      }
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("eventos").delete().eq("id", deleteId);
    toast({ title: "Evento excluído!" });
    setDeleteId(null);
    fetchAll();
  };

  const openNewOnDay = (d: Date) => {
    setEditData(null);
    setSelectedDate(d);
    setForm(f => ({ ...f, data_inicio: format(d, "yyyy-MM-dd") }));
    setShowForm(true);
  };

  const eventosNoDia  = eventos.filter(e => isSameDay(new Date(e.data_inicio), selectedDate));
  const diasComEventos = eventos.map(e => new Date(e.data_inicio));

  const prazosUrgentes = tarefas.filter(t => {
    const dias = Math.ceil((new Date(t.data_limite).getTime() - Date.now()) / 86400000);
    return dias <= 3;
  });

  const getDiasLabel = (d: string) => {
    const dias = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    if (dias < 0) return { label: `${Math.abs(dias)}d atrasado`, cls: "text-destructive" };
    if (dias === 0) return { label: "Hoje", cls: "text-destructive font-bold" };
    if (dias === 1) return { label: "Amanhã", cls: "text-orange-500" };
    return { label: `${dias} dias`, cls: "text-muted-foreground" };
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Agenda</h1>
            <p className="text-muted-foreground text-sm mt-1">Compromissos, prazos e tarefas do escritório</p>
          </div>
          <Button onClick={() => { setEditData(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Evento
          </Button>
        </div>

        {/* Google Calendar banner */}
        <div className={`flex items-center gap-3 p-3.5 rounded-xl border mb-5 ${gcalConnected ? "bg-green-500/5 border-green-500/20" : "bg-muted/40 border-dashed"}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${gcalConnected ? "bg-green-500/10" : "bg-muted"}`}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke={gcalConnected ? "#22c55e" : "#94a3b8"} strokeWidth="2" fill="none"/>
              <path d="M16 2v4M8 2v4M3 10h18" stroke={gcalConnected ? "#22c55e" : "#94a3b8"} strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="2" fill={gcalConnected ? "#22c55e" : "#94a3b8"}/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{gcalConnected ? "Google Calendar conectado" : "Conectar Google Calendar"}</p>
            <p className="text-xs text-muted-foreground">{gcalConnected ? "Eventos sincronizados automaticamente" : "Sincronize compromissos com seu Google Calendar"}</p>
          </div>
          {gcalConnected ? (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={syncAllToGcal} disabled={gcalSyncing}>
                <RefreshCw className={`w-3 h-3 ${gcalSyncing ? "animate-spin" : ""}`} />
                {gcalSyncing ? "Sincronizando..." : "Sincronizar tudo"}
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive" onClick={handleGcalDisconnect}>
                <Link2Off className="w-3 h-3" /> Desconectar
              </Button>
            </div>
          ) : (
            <Button size="sm" className="gap-1.5 h-8 text-xs shrink-0" onClick={handleGcalConnect}>
              <Link2 className="w-3 h-3" /> Conectar
            </Button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Card className="border-none shadow-sm cursor-pointer" onClick={() => setActiveTab("compromissos")}>
            <CardContent className="p-4 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-blue-500" />
              <div><p className="text-xs text-muted-foreground">Compromissos</p><p className="text-2xl font-bold">{eventos.length}</p></div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm cursor-pointer" onClick={() => setActiveTab("tarefas")}>
            <CardContent className="p-4 flex items-center gap-3">
              <ListTodo className="w-5 h-5 text-green-500" />
              <div><p className="text-xs text-muted-foreground">Tarefas pendentes</p><p className="text-2xl font-bold">{tarefas.length}</p></div>
            </CardContent>
          </Card>
          <Card className={`border-none shadow-sm cursor-pointer ${prazosUrgentes.length > 0 ? "border-destructive/30" : ""}`} onClick={() => setActiveTab("prazos")}>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className={`w-5 h-5 ${prazosUrgentes.length > 0 ? "text-destructive" : "text-orange-500"}`} />
              <div>
                <p className="text-xs text-muted-foreground">Prazos urgentes</p>
                <p className={`text-2xl font-bold ${prazosUrgentes.length > 0 ? "text-destructive" : ""}`}>{prazosUrgentes.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex rounded-lg border overflow-hidden">
            {(["mes", "semana", "dia"] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${viewMode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              >
                {m === "mes" ? "Mês" : m === "semana" ? "Semana" : "Dia"}
              </button>
            ))}
          </div>

          {viewMode === "semana" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[180px] text-center">
                {format(weekStart, "dd MMM", { locale: ptBR })} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), "dd MMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                Hoje
              </Button>
            </div>
          )}
        </div>

        {/* Semana view */}
        {viewMode === "semana" && (
          <WeekView
            weekStart={weekStart}
            eventos={eventos}
            onEdit={e => { setEditData(e); setShowForm(true); }}
            onDelete={setDeleteId}
            onNewOnDay={openNewOnDay}
          />
        )}

        {/* Mês/Dia view */}
        {(viewMode === "mes" || viewMode === "dia") && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-3">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={d => d && setSelectedDate(d)}
                    locale={ptBR}
                    className="pointer-events-auto"
                    modifiers={{ hasEvent: diasComEventos }}
                    modifiersClassNames={{ hasEvent: "bg-primary/20 font-bold rounded-full" }}
                  />
                </CardContent>
              </Card>

              {/* Audiências próximas */}
              {audiencias.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Audiências próximas</p>
                    <div className="space-y-2">
                      {audiencias.slice(0, 5).map(a => (
                        <div key={a.id} className="text-xs border rounded-lg p-2.5 bg-purple-500/5 border-purple-500/20">
                          <p className="font-semibold text-purple-700 dark:text-purple-400">{a.tipo}</p>
                          <p className="text-muted-foreground mt-0.5">{format(new Date(a.data_hora), "dd/MM HH:mm")}</p>
                          {a.processos?.cliente_nome && <p className="text-muted-foreground truncate">{a.processos.cliente_nome}</p>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right panel: tabs */}
            <div className="lg:col-span-2">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4 bg-muted/50">
                  <TabsTrigger value="compromissos" className="gap-1.5 text-xs">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {viewMode === "dia"
                      ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
                      : "Compromissos"}
                  </TabsTrigger>
                  <TabsTrigger value="tarefas" className="gap-1.5 text-xs">
                    <ListTodo className="w-3.5 h-3.5" /> Tarefas
                    {tarefas.length > 0 && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded">{tarefas.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="prazos" className="gap-1.5 text-xs">
                    <AlertCircle className="w-3.5 h-3.5" /> Prazos
                    {prazosUrgentes.length > 0 && <span className="ml-1 text-[10px] bg-destructive/10 text-destructive px-1 rounded">{prazosUrgentes.length}</span>}
                  </TabsTrigger>
                </TabsList>

                {/* Compromissos do dia */}
                <TabsContent value="compromissos">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold font-serif">
                      {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </h2>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openNewOnDay(selectedDate)}>
                      <Plus className="w-3.5 h-3.5" /> Evento
                    </Button>
                  </div>
                  {eventosNoDia.length === 0
                    ? <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">Nenhum compromisso neste dia</div>
                    : <div className="space-y-2.5">
                        {eventosNoDia.map(e => (
                          <EventCard key={e.id} evento={e} onEdit={ev => { setEditData(ev); setShowForm(true); }} onDelete={setDeleteId} />
                        ))}
                      </div>
                  }

                  {/* Próximos eventos */}
                  {eventos.filter(e => new Date(e.data_inicio) > selectedDate).length > 0 && (
                    <div className="mt-6">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Próximos eventos</p>
                      <div className="space-y-2">
                        {eventos
                          .filter(e => new Date(e.data_inicio) > selectedDate)
                          .slice(0, 5)
                          .map(e => (
                            <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/20 cursor-pointer" onClick={() => { setSelectedDate(new Date(e.data_inicio)); }}>
                              <span className={`w-2 h-2 rounded-full shrink-0 ${tipoColors[e.tipo]?.dot || "bg-muted-foreground"}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{e.titulo}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(e.data_inicio), "dd/MM · HH:mm")}</p>
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted capitalize">{e.tipo}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tarefas pendentes */}
                <TabsContent value="tarefas">
                  <div className="space-y-2">
                    {tarefas.length === 0
                      ? <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">Nenhuma tarefa pendente</div>
                      : tarefas.map(t => {
                          const dl = getDiasLabel(t.data_limite);
                          return (
                            <div key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border bg-card border-l-4 ${
                              t.prioridade === "alta" ? "border-l-red-500" :
                              t.prioridade === "média" ? "border-l-primary" : "border-l-muted"
                            }`}>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{t.titulo}</p>
                                {t.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.descricao}</p>}
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-xs font-semibold ${dl.cls}`}>{dl.label}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">{t.prioridade}</p>
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                </TabsContent>

                {/* Prazos */}
                <TabsContent value="prazos">
                  <div className="space-y-2">
                    {tarefas.length === 0
                      ? <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">Nenhum prazo pendente</div>
                      : tarefas
                          .sort((a, b) => new Date(a.data_limite).getTime() - new Date(b.data_limite).getTime())
                          .map(t => {
                            const dias = Math.ceil((new Date(t.data_limite).getTime() - Date.now()) / 86400000);
                            const isUrgent = dias <= 3;
                            return (
                              <div key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border bg-card ${isUrgent ? "border-destructive/30 bg-destructive/3" : ""}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                  dias < 0 ? "bg-destructive text-destructive-foreground" :
                                  dias === 0 ? "bg-destructive text-destructive-foreground" :
                                  dias <= 3 ? "bg-orange-500/10 text-orange-600" :
                                  "bg-muted text-muted-foreground"
                                }`}>
                                  {dias < 0 ? `-${Math.abs(dias)}` : dias === 0 ? "!" : dias}
                                  <span className="text-[9px] ml-px">{dias < 0 ? "atr" : dias > 0 ? "d" : ""}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{t.titulo}</p>
                                  <p className="text-xs text-muted-foreground">{format(new Date(t.data_limite + "T12:00:00"), "dd/MM/yyyy")}</p>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${
                                  t.prioridade === "alta" ? "border-red-500/30 text-red-600" :
                                  t.prioridade === "média" ? "border-primary/30 text-primary" : ""
                                }`}>{t.prioridade}</span>
                              </div>
                            );
                          })
                    }
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editData ? "Editar Evento" : "Novo Evento"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Audiência - João Silva" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Hora *</Label>
                  <Input type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{tipoOptions.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Local</Label>
                <Input value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} placeholder="Ex: 1ª Vara Criminal" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes do compromisso..." rows={2} />
              </div>
              {gcalConnected && !editData && (
                <div className="flex items-center justify-between py-2 border rounded-xl px-3 bg-green-500/5 border-green-500/20">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#22c55e" strokeWidth="2" fill="none"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16" r="2" fill="#22c55e"/></svg>
                    <span className="text-xs font-medium">Sincronizar com Google Calendar</span>
                  </div>
                  <Switch checked={syncToGcal} onCheckedChange={setSyncToGcal} />
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editData ? "Salvar" : "Criar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Excluir evento?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Agenda;
