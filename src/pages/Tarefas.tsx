import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Clock, Trash2, Pencil, LayoutList, Columns3, Calendar, Search, Tag, UserRound, Trophy, TriangleAlert, Gauge, BarChart3, Star, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useActivities } from "@/hooks/useActivities";
import { useActiveTeamMembers } from "@/hooks/useActiveTeamMembers";
import {
  ACTIVITY_STATUS_LABELS,
  calculateActivityMetrics,
  classifyActivityDueDate,
} from "@/lib/activity-status";
import type {
  ActivityPriority,
  ActivityStatus,
  ActivityTeamMember,
  ActivityWithUserState,
} from "@/types/activities";

// ─── Interfaces ───────────────────────────────────────────────────────────────

type Tarefa = ActivityWithUserState;

interface Processo {
  id: string;
  numero: string;
  area?: string;
  cliente_id?: string | null;
  cliente_nome?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KANBAN_COLS = [
  { id: "pendente",     label: "A Fazer",    color: "bg-warning/10 text-warning border-warning/20",    dot: "bg-orange-400"  },
  { id: "em_andamento", label: "Fazendo",    color: "bg-info/10 text-info border-info/20",              dot: "bg-blue-400"    },
  { id: "concluída",    label: "Concluída",  color: "bg-success/10 text-success border-success/20",     dot: "bg-green-400"   },
];

const PRIORIDADE_BORDER: Record<string, string> = {
  alta:  "border-l-destructive",
  média: "border-l-primary",
  baixa: "border-l-muted-foreground/30",
};

const PRIORIDADE_BADGE: Record<string, string> = {
  alta:  "bg-red-500/10 text-red-600 border-red-500/20",
  média: "bg-primary/10 text-primary border-primary/20",
  baixa: "bg-muted text-muted-foreground border-muted-foreground/20",
};

const prioridades: ActivityPriority[] = ["alta", "média", "baixa"];
const statusList: ActivityStatus[] = ["pendente", "em_andamento", "concluída"];
const statusLabels = ACTIVITY_STATUS_LABELS;

function fmtDate(d: string | null | undefined) {
  const due = classifyActivityDueDate(d);
  return due.label ? due : null;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({
  tarefa, processos, members, onEdit, onDelete, onFavorite, onDragStart,
}: {
  tarefa: Tarefa; processos: Processo[]; members: ActivityTeamMember[];
  onEdit: (t: Tarefa) => void; onDelete: (id: string) => void;
  onFavorite: (t: Tarefa) => void;
  onDragStart: (id: string) => void;
}) {
  const processo = processos.find(p => p.id === tarefa.processo_id);
  const responsible = members.find(member => member.userId === tarefa.responsavel_id);
  const date = fmtDate(tarefa.data_limite);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(tarefa.id)}
      className={`bg-card border border-l-4 ${PRIORIDADE_BORDER[tarefa.prioridade] || "border-l-muted"} rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-snug flex-1">
          {!tarefa.userState?.lida_em && <span className="inline-block h-2 w-2 rounded-full bg-primary mr-2" title="Não lida" />}
          {tarefa.titulo}
        </p>
        <div className="flex gap-0.5 shrink-0">
          <button onClick={() => onFavorite(tarefa)} className="p-1 rounded hover:bg-muted text-muted-foreground" title={tarefa.userState?.favorita ? "Remover dos favoritos" : "Favoritar"}>
            <Star className={`w-3 h-3 ${tarefa.userState?.favorita ? "fill-amber-400 text-amber-500" : ""}`} />
          </button>
          <button onClick={() => onEdit(tarefa)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(tarefa.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {tarefa.descricao && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{tarefa.descricao}</p>
      )}

      {processo && (
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 truncate">
          {processo.numero} · {processo.cliente_nome || processo.area}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-dashed">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${PRIORIDADE_BADGE[tarefa.prioridade]}`}>
            {tarefa.prioridade}
          </span>
          {responsible && (
            <Avatar className="h-6 w-6" title={responsible.name}>
              <AvatarImage src={responsible.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[9px]">{initials(responsible.name)}</AvatarFallback>
            </Avatar>
          )}
        </div>
        {date && (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${date.urgent ? "text-destructive" : "text-muted-foreground"}`}>
            <Clock className="w-3 h-3" />
            {date.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  col, tarefas, processos, members, onEdit, onDelete, onFavorite, onDragStart, onDrop, onAdd,
}: {
  col: typeof KANBAN_COLS[0]; tarefas: Tarefa[]; processos: Processo[]; members: ActivityTeamMember[];
  onEdit: (t: Tarefa) => void; onDelete: (id: string) => void;
  onFavorite: (t: Tarefa) => void;
  onDragStart: (id: string) => void; onDrop: (colId: string) => void;
  onAdd: (status: string) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`flex flex-col min-h-[500px] rounded-2xl p-3 transition-colors ${over ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(col.id); }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
          <h3 className="text-sm font-semibold">{col.label}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-medium">
            {tarefas.length}
          </span>
        </div>
        <button
          onClick={() => onAdd(col.id)}
          className="w-6 h-6 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {tarefas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
            <LayoutList className="w-8 h-8 mb-2" />
            <p className="text-xs">Sem tarefas aqui</p>
          </div>
        )}
        {tarefas.map(t => (
          <KanbanCard
            key={t.id}
            tarefa={t}
            processos={processos}
            members={members}
            onEdit={onEdit}
            onDelete={onDelete}
            onFavorite={onFavorite}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Tarefas = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.tenantId ?? null;
  const userId = user?.id ?? null;
  const activityData = useActivities(tenantId, userId);
  const { data: members = [] } = useActiveTeamMembers(tenantId);
  const tarefas = activityData.activities;
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [view, setView] = useState<"overview" | "kanban" | "lista" | "performance">("overview");
  const [showForm, setShowForm]   = useState(false);
  const [editData, setEditData]   = useState<Tarefa | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [filterPrioridade, setFilterPrioridade] = useState("Todos");
  const [filterResponsavel, setFilterResponsavel] = useState("Todos");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const dragId = useRef<string | null>(null);

  const changeView = (next: typeof view) => {
    setView(next);
    if (tenantId) sessionStorage.setItem(`adveyes:activity-view:${tenantId}`, next);
  };

  const [form, setForm] = useState({
    titulo: "", descricao: "", prioridade: "média",
    status: "pendente", data_limite: "", processo_id: "",
    responsavel_id: "", categoria: "", pontos: "0",
  });

  // ── Fetch ──
  const fetchProcessos = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("processos")
      .select("id, numero, area, cliente_id")
      .eq("tenant_id", tenantId)
      .order("numero");
    // also fetch client names
    if (data) {
      const clientIds = [...new Set(data.map(p => p.cliente_id).filter(Boolean))];
      const clientMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clientes } = await supabase
          .from("clientes")
          .select("id, nome")
          .eq("tenant_id", tenantId)
          .in("id", clientIds);
        if (clientes) clientes.forEach(c => { clientMap[c.id] = c.nome; });
      }
      setProcessos(data.map(p => ({ ...p, cliente_nome: clientMap[p.cliente_id] || null })));
    }
  }, [tenantId]);

  useEffect(() => { void fetchProcessos(); }, [fetchProcessos]);

  useEffect(() => {
    if (!tenantId) return;
    const saved = sessionStorage.getItem(`adveyes:activity-view:${tenantId}`);
    if (["overview", "kanban", "lista", "performance"].includes(saved ?? "")) {
      setView(saved as typeof view);
    } else if (currentTenant?.role === "owner" || currentTenant?.role === "admin") {
      setView("overview");
    } else {
      setView("lista");
      if (userId) setFilterResponsavel(userId);
    }

    try {
      const stored = JSON.parse(
        sessionStorage.getItem(`adveyes:activity-filters:${tenantId}`) ?? "null",
      ) as { search?: string; priority?: string; responsible?: string; favorites?: boolean; unread?: boolean } | null;
      if (stored) {
        setSearch(stored.search ?? "");
        setFilterPrioridade(stored.priority ?? "Todos");
        setFilterResponsavel(stored.responsible ?? "Todos");
        setFavoritesOnly(Boolean(stored.favorites));
        setUnreadOnly(Boolean(stored.unread));
      }
    } catch {
      sessionStorage.removeItem(`adveyes:activity-filters:${tenantId}`);
    }
  }, [currentTenant?.role, tenantId, userId]);

  useEffect(() => {
    if (!tenantId) return;
    sessionStorage.setItem(`adveyes:activity-filters:${tenantId}`, JSON.stringify({
      search,
      priority: filterPrioridade,
      responsible: filterResponsavel,
      favorites: favoritesOnly,
      unread: unreadOnly,
    }));
  }, [favoritesOnly, filterPrioridade, filterResponsavel, search, tenantId, unreadOnly]);

  useEffect(() => {
    if (editData) {
      setForm({
        titulo:      editData.titulo      || "",
        descricao:   editData.descricao   || "",
        prioridade:  editData.prioridade  || "média",
        status:      editData.status      || "pendente",
        data_limite: editData.data_limite || "",
        processo_id: editData.processo_id || "",
        responsavel_id: editData.responsavel_id || "",
        categoria: editData.categoria || "",
        pontos: String(editData.pontos ?? 0),
      });
    } else {
      setForm({
        titulo: "", descricao: "", prioridade: "média", status: "pendente",
        data_limite: "", processo_id: "", responsavel_id: userId ?? "",
        categoria: "", pontos: "0",
      });
    }
  }, [editData, showForm, userId]);

  // ── Form submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) { toast({ title: "Título é obrigatório", variant: "destructive" }); return; }
    setLoading(true);
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      prioridade: form.prioridade,
      status: form.status,
      data_limite: form.data_limite || null,
      processo_id: form.processo_id || null,
      responsavel_id: form.responsavel_id || null,
      categoria: form.categoria.trim() || null,
      pontos: Math.max(0, Number.parseInt(form.pontos, 10) || 0),
    };
    try {
      if (editData) {
        await activityData.update.mutateAsync({ id: editData.id, input: payload });
        toast({ title: "Tarefa atualizada!" });
      } else {
        await activityData.create.mutateAsync({
          ...payload,
          user_id: user!.id,
          tenant_id: currentTenant!.tenantId,
        });
        toast({ title: "Tarefa criada!" });
      }
      setShowForm(false);
    } catch (error) {
      toast({
        title: "Não foi possível salvar a tarefa",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await activityData.remove.mutateAsync(deleteId);
      toast({ title: "Tarefa excluída!" });
      setDeleteId(null);
    } catch (error) {
      toast({
        title: "Não foi possível excluir a tarefa",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  // ── Drag & Drop ──
  const handleDrop = async (toStatus: string) => {
    if (!dragId.current) return;
    const tarefa = tarefas.find(t => t.id === dragId.current);
    if (!tarefa || tarefa.status === toStatus) return;
    const id = dragId.current;
    dragId.current = null;
    try {
      await activityData.update.mutateAsync({ id, input: { status: toStatus } });
    } catch (error) {
      toast({
        title: "Não foi possível mover a tarefa",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  // ── Open form helpers ──
  const openNew = (status = "pendente") => {
    setEditData(null);
    setForm(f => ({ ...f, status }));
    setShowForm(true);
  };
  const openEdit = (t: Tarefa) => {
    setEditData(t);
    setShowForm(true);
    if (!t.userState?.lida_em) {
      void activityData.setUserState
        .mutateAsync({ id: t.id, lidaEm: new Date().toISOString() })
        .catch(() => undefined);
    }
  };
  const toggleFavorite = async (t: Tarefa) => {
    try {
      await activityData.setUserState.mutateAsync({
        id: t.id,
        favorita: !t.userState?.favorita,
      });
    } catch (error) {
      toast({
        title: "Não foi possível alterar o favorito",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  // ── Filtered tarefas ──
  const filtered = tarefas.filter(t => {
    const matchSearch = !search ||
      t.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (t.descricao || "").toLowerCase().includes(search.toLowerCase());
    const matchPri = filterPrioridade === "Todos" || t.prioridade === filterPrioridade;
    const matchResponsible = filterResponsavel === "Todos" ||
      (filterResponsavel === "Sem responsável"
        ? !t.responsavel_id
        : t.responsavel_id === filterResponsavel);
    const matchFavorite = !favoritesOnly || Boolean(t.userState?.favorita);
    const matchUnread = !unreadOnly || !t.userState?.lida_em;
    return matchSearch && matchPri && matchResponsible && matchFavorite && matchUnread;
  });

  const counts = {
    pendente:     filtered.filter(t => t.status === "pendente").length,
    em_andamento: filtered.filter(t => t.status === "em_andamento").length,
    concluída:    filtered.filter(t => t.status === "concluída").length,
  };
  const metrics = calculateActivityMetrics(filtered);

  return (
    <AppLayout>
      <div className="animate-fade-in">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold font-serif tracking-tight">Tarefas</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestão de tarefas e atividades do escritório</p>
          </div>
          <Button onClick={() => openNew()} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Tarefa
          </Button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {KANBAN_COLS.map(col => (
            <Card key={col.id} className="border-none shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{col.label}</p>
                  <p className="text-2xl font-bold">{counts[col.id as keyof typeof counts]}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <TriangleAlert className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Atrasadas</p>
                <p className="text-2xl font-bold">{metrics.overdue}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <Trophy className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">Pontos concluídos</p>
                <p className="text-2xl font-bold">{metrics.completedPoints}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Buscar tarefa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Priority filter */}
          <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <Tag className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os tipos</SelectItem>
              {prioridades.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <UserRound className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os responsáveis</SelectItem>
              <SelectItem value="Sem responsável">Sem responsável</SelectItem>
              {members.map(member => (
                <SelectItem key={member.userId} value={member.userId}>{member.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant={favoritesOnly ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setFavoritesOnly(value => !value)}
          >
            <Star className="h-3.5 w-3.5" /> Favoritas
          </Button>
          <Button
            type="button"
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setUnreadOnly(value => !value)}
          >
            <Mail className="h-3.5 w-3.5" /> Não lidas
          </Button>

          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => changeView("overview")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === "overview" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <Gauge className="w-3.5 h-3.5" /> Visão geral
            </button>
            <button
              onClick={() => changeView("lista")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === "lista" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Lista
            </button>
            <button
              onClick={() => changeView("kanban")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <Columns3 className="w-3.5 h-3.5" /> Quadro
            </button>
            <button
              onClick={() => changeView("performance")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === "performance" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Desempenho
            </button>
          </div>
        </div>

        {activityData.loading && (
          <div className="mb-5 rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Carregando atividades do escritório...
          </div>
        )}
        {activityData.error && (
          <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Não foi possível carregar as atividades. Tente atualizar a página.
          </div>
        )}

        {view === "overview" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-none shadow-sm">
              <CardContent className="p-5">
                <h2 className="font-semibold mb-4">Prioridades imediatas</h2>
                <div className="space-y-3">
                  {filtered
                    .filter(task => task.status !== "concluída")
                    .sort((a, b) => (a.data_limite ?? "9999").localeCompare(b.data_limite ?? "9999"))
                    .slice(0, 6)
                    .map(task => {
                      const due = fmtDate(task.data_limite);
                      return (
                        <button key={task.id} onClick={() => openEdit(task)} className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/40">
                          <span className="text-sm font-medium truncate">{task.titulo}</span>
                          <span className={`text-xs shrink-0 ${due?.urgent ? "text-destructive" : "text-muted-foreground"}`}>{due?.label ?? "Sem prazo"}</span>
                        </button>
                      );
                    })}
                  {filtered.filter(task => task.status !== "concluída").length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade pendente.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-5">
                <h2 className="font-semibold mb-4">Carga por responsável</h2>
                <div className="space-y-4">
                  {members.map(member => {
                    const open = filtered.filter(task => task.responsavel_id === member.userId && task.status !== "concluída").length;
                    const width = metrics.pending + metrics.inProgress === 0 ? 0 : Math.round((open / (metrics.pending + metrics.inProgress)) * 100);
                    return (
                      <div key={member.userId}>
                        <div className="flex justify-between text-sm mb-1"><span>{member.name}</span><span className="text-muted-foreground">{open}</span></div>
                        <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} /></div>
                      </div>
                    );
                  })}
                  {members.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum membro ativo encontrado.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── KANBAN VIEW ── */}
        {view === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {KANBAN_COLS.map(col => (
              <KanbanColumn
                key={col.id}
                col={col}
                tarefas={filtered.filter(t => t.status === col.id)}
                processos={processos}
                members={members}
                onEdit={openEdit}
                onDelete={setDeleteId}
                onFavorite={toggleFavorite}
                onDragStart={id => { dragId.current = id; }}
                onDrop={handleDrop}
                onAdd={openNew}
              />
            ))}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === "lista" && (
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border">
                Nenhuma tarefa encontrada
              </div>
            )}
            {filtered.map(t => {
              const date = fmtDate(t.data_limite);
              const processo = processos.find(p => p.id === t.processo_id);
              const responsible = members.find(member => member.userId === t.responsavel_id);
              return (
                <div
                  key={t.id}
                  className={`bg-card border border-l-4 ${PRIORIDADE_BORDER[t.prioridade] || "border-l-muted"} rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow group`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className={`font-medium text-sm flex-1 ${t.status === "concluída" ? "line-through text-muted-foreground" : ""}`}>
                        {!t.userState?.lida_em && <span className="inline-block h-2 w-2 rounded-full bg-primary mr-2" title="Não lida" />}
                        {t.titulo}
                      </p>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORIDADE_BADGE[t.prioridade]}`}>
                        {t.prioridade}
                      </Badge>
                    </div>
                    {t.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.descricao}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        t.status === "pendente"     ? "bg-orange-500/10 text-orange-600" :
                        t.status === "em_andamento" ? "bg-blue-500/10 text-blue-600"    :
                                                      "bg-green-500/10 text-green-600"
                      }`}>
                        {statusLabels[t.status]}
                      </span>
                      {processo && (
                        <span className="text-[10px] text-muted-foreground">
                          {processo.numero}
                          {processo.cliente_nome && ` · ${processo.cliente_nome}`}
                        </span>
                      )}
                      {date && (
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${date.urgent ? "text-destructive" : "text-muted-foreground"}`}>
                          <Calendar className="w-3 h-3" /> {date.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {responsible && (
                      <Avatar className="h-8 w-8 mr-1" title={responsible.name}>
                        <AvatarImage src={responsible.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials(responsible.name)}</AvatarFallback>
                      </Avatar>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void toggleFavorite(t)} title={t.userState?.favorita ? "Remover dos favoritos" : "Favoritar"}>
                      <Star className={`w-4 h-4 ${t.userState?.favorita ? "fill-amber-400 text-amber-500" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "performance" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {members.map(member => {
              const memberTasks = filtered.filter(task => task.responsavel_id === member.userId);
              const memberMetrics = calculateActivityMetrics(memberTasks);
              return (
                <Card key={member.userId} className="border-none shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-5">
                      <Avatar><AvatarImage src={member.avatarUrl ?? undefined} /><AvatarFallback>{initials(member.name)}</AvatarFallback></Avatar>
                      <div className="min-w-0"><p className="font-semibold truncate">{member.name}</p><p className="text-xs text-muted-foreground">{member.jobTitle || "Equipe"}</p></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted/50 p-2"><p className="text-xl font-bold">{memberMetrics.completed}</p><p className="text-[10px] text-muted-foreground">Concluídas</p></div>
                      <div className="rounded-lg bg-muted/50 p-2"><p className="text-xl font-bold">{memberMetrics.pending + memberMetrics.inProgress}</p><p className="text-[10px] text-muted-foreground">Abertas</p></div>
                      <div className="rounded-lg bg-muted/50 p-2"><p className="text-xl font-bold">{memberMetrics.completedPoints}</p><p className="text-[10px] text-muted-foreground">Pontos</p></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── FORM DIALOG ── */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editData ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Descreva a tarefa"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Detalhes adicionais..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={v => setForm({ ...form, prioridade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {prioridades.map(p => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusList.map(s => (
                        <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Processo vinculado</Label>
                <Select value={form.processo_id || "none"} onValueChange={v => setForm({ ...form, processo_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar processo (opcional)" /></SelectTrigger>
                  <SelectContent className="max-h-52">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {processos.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero}{p.cliente_nome ? ` · ${p.cliente_nome}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select
                  value={form.responsavel_id || "none"}
                  onValueChange={v => setForm({ ...form, responsavel_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {members.map(member => (
                      <SelectItem key={member.userId} value={member.userId}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={form.data_limite}
                    onChange={e => setForm({ ...form, data_limite: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pontos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.pontos}
                    onChange={e => setForm({ ...form, pontos: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Ex.: prazo, audiência, atendimento"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Salvando..." : editData ? "Salvar" : "Criar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── DELETE CONFIRM ── */}
        <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppLayout>
  );
};

export default Tarefas;
