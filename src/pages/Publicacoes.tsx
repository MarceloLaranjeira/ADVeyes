import { DepthCard } from "@/components/dashboard/DepthCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileClock,
  FileText,
  RefreshCw,
  Search,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type FeedTab = "publicacoes" | "andamentos";

interface Publicacao {
  id: string;
  tenant_id: string;
  process_id: string | null;
  tipo: string;
  tribunal: string;
  numero_processo: string | null;
  cliente_nome: string | null;
  data_publicacao: string | null;
  conteudo: string;
  conteudo_simplificado: string | null;
  status: string;
  prazo_dias: number | null;
  data_prazo: string | null;
  tarefa_gerada: boolean | null;
  provider: "escavador" | "manual" | "legacy";
  origin_system: "pje" | "projudi" | "seeu" | "dje" | "other" | "unknown";
  review_status: "pending_review" | "reviewed" | "dismissed" | "no_deadline";
  possible_deadline: boolean;
  source_name: string | null;
}

interface Movimento {
  id: string;
  tenant_id: string;
  process_id: string;
  provider: "escavador" | "datajud" | "manual";
  movement_type: "ANDAMENTO" | "DOCUMENTO";
  occurred_at: string | null;
  title: string | null;
  content: string;
  source_name: string | null;
  source_url: string | null;
}

interface Processo {
  id: string;
  numero: string;
  cliente_nome: string | null;
}

interface SyncRun {
  id: string;
  provider: "escavador" | "datajud";
  sync_kind: string;
  status: "running" | "succeeded" | "partial" | "failed";
  records_created: number;
  started_at: string;
  finished_at: string | null;
}

const sourceLabels: Record<string, string> = {
  pje: "PJe",
  projudi: "Projudi",
  seeu: "SEEU",
  dje: "Diário de Justiça",
  other: "Outra fonte",
  unknown: "Origem a confirmar",
};

const statusLabels: Record<string, string> = {
  nova: "Nova",
  urgente: "Revisar prazo",
  lida: "Lida",
  processada: "Processada",
};

function formattedDate(value: string | null) {
  if (!value) return "Data não informada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data não informada";
  return format(parsed, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

const Publicacoes = () => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<FeedTab>("publicacoes");
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [processos, setProcessos] = useState<Map<string, Processo>>(new Map());
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [source, setSource] = useState("todas");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Publicacao | null>(null);
  const [reviewForm, setReviewForm] = useState({
    deadline: "",
    days: "",
    reason: "",
    title: "",
  });
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    const tenantId = currentTenant.tenantId;
    const [publicationsResult, movementsResult, processesResult, runsResult] =
      await Promise.all([
        (supabase as any)
          .from("publicacoes")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("data_publicacao", { ascending: false }),
        (supabase as any)
          .from("process_movements")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("occurred_at", { ascending: false }),
        (supabase as any)
          .from("processos")
          .select("id, numero, cliente_nome")
          .eq("tenant_id", tenantId),
        (supabase as any)
          .from("legal_sync_runs")
          .select(
            "id, provider, sync_kind, status, records_created, started_at, finished_at",
          )
          .eq("tenant_id", tenantId)
          .order("started_at", { ascending: false })
          .limit(8),
      ]);

    const firstError = publicationsResult.error ??
      movementsResult.error ??
      processesResult.error ??
      runsResult.error;
    if (firstError) {
      toast({
        title: "Não foi possível carregar o acompanhamento jurídico",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } else {
      setPublicacoes(publicationsResult.data ?? []);
      setMovimentos(movementsResult.data ?? []);
      setProcessos(
        new Map(
          (processesResult.data ?? []).map((process: Processo) => [
            process.id,
            process,
          ]),
        ),
      );
      setSyncRuns(runsResult.data ?? []);
    }
    setLoading(false);
  }, [currentTenant, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPublications = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return publicacoes.filter((publication) => {
      if (status !== "todos" && publication.status !== status) return false;
      if (source !== "todas" && publication.origin_system !== source) {
        return false;
      }
      if (!normalized) return true;
      return [
        publication.numero_processo,
        publication.cliente_nome,
        publication.tribunal,
        publication.conteudo,
        publication.source_name,
      ].some((value) =>
        value?.toLocaleLowerCase("pt-BR").includes(normalized)
      );
    });
  }, [publicacoes, search, source, status]);

  const filteredMovements = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return movimentos.filter((movement) => {
      if (source !== "todas" && movement.provider !== source) return false;
      if (!normalized) return true;
      const process = processos.get(movement.process_id);
      return [
        movement.title,
        movement.content,
        movement.source_name,
        process?.numero,
        process?.cliente_nome,
      ].some((value) =>
        value?.toLocaleLowerCase("pt-BR").includes(normalized)
      );
    });
  }, [movimentos, processos, search, source]);

  const stats = useMemo(() => ({
    total: publicacoes.length,
    pending: publicacoes.filter((item) => item.status === "nova").length,
    deadline: publicacoes.filter((item) =>
      item.possible_deadline && item.review_status === "pending_review"
    ).length,
    movements: movimentos.length,
  }), [movimentos, publicacoes]);

  const synchronize = async () => {
    if (!currentTenant) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke(
      "capturar-publicacoes",
      { body: { tenantId: currentTenant.tenantId } },
    );
    if (error) {
      const message = data?.error === "integration_not_configured"
        ? "O token do Escavador ainda está pendente. A estrutura já está pronta."
        : "Não foi possível sincronizar agora.";
      toast({
        title: "Sincronização não concluída",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sincronização concluída",
        description: data?.message ?? "Dados atualizados.",
      });
      await load();
    }
    setSyncing(false);
  };

  const markAsRead = async (publication: Publicacao) => {
    if (!currentTenant) return;
    const { error } = await (supabase as any)
      .from("publicacoes")
      .update({ status: "lida" })
      .eq("tenant_id", currentTenant.tenantId)
      .eq("id", publication.id);
    if (!error) {
      setPublicacoes((items) =>
        items.map((item) =>
          item.id === publication.id ? { ...item, status: "lida" } : item
        )
      );
    }
  };

  const openDeadlineReview = (publication: Publicacao) => {
    setReviewing(publication);
    setReviewForm({
      deadline: publication.data_prazo
        ? publication.data_prazo.slice(0, 10)
        : "",
      days: publication.prazo_dias?.toString() ?? "",
      reason: "",
      title:
        `Cumprir prazo — ${publication.numero_processo ?? publication.tribunal}`,
    });
  };

  const submitReview = async (decision: "confirm" | "reject") => {
    if (!currentTenant || !reviewing || !reviewForm.reason.trim()) return;
    if (decision === "confirm" && !reviewForm.deadline) return;
    setSavingReview(true);
    const { error } = await supabase.functions.invoke(
      "review-publication-deadline",
      {
        body: {
          tenantId: currentTenant.tenantId,
          publicationId: reviewing.id,
          decision,
          proposedDate: decision === "confirm"
            ? new Date(`${reviewForm.deadline}T12:00:00`).toISOString()
            : null,
          proposedDays: reviewForm.days
            ? Number.parseInt(reviewForm.days, 10)
            : null,
          reason: reviewForm.reason,
          taskTitle: reviewForm.title,
        },
      },
    );
    if (error) {
      toast({
        title: "Não foi possível registrar a revisão",
        variant: "destructive",
      });
    } else {
      toast({
        title: decision === "confirm"
          ? "Prazo confirmado e tarefa criada"
          : "Publicação revisada sem prazo",
      });
      setReviewing(null);
      await load();
    }
    setSavingReview(false);
  };

  const lastSync = syncRuns[0];

  return (
    <AppLayout>
      <div className="space-y-6 p-5 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Publicações e andamentos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhamento real e isolado de {currentTenant?.displayName}.
            </p>
          </div>
          <Button onClick={() => void synchronize()} disabled={syncing}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DepthCard
            interactive
            onActivate={() => {
              setActiveTab("publicacoes");
              setStatus("todos");
            }}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">Publicações</p>
                <p className="mt-1 text-3xl font-bold">{stats.total}</p>
              </div>
              <Bell className="h-6 w-6 text-primary" />
            </CardContent>
          </DepthCard>
          <DepthCard
            interactive
            onActivate={() => {
              setActiveTab("publicacoes");
              setStatus("nova");
            }}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">Novas</p>
                <p className="mt-1 text-3xl font-bold">{stats.pending}</p>
              </div>
              <FileText className="h-6 w-6 text-blue-600" />
            </CardContent>
          </DepthCard>
          <DepthCard
            interactive
            onActivate={() => {
              setActiveTab("publicacoes");
              setStatus("urgente");
            }}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">
                  Prazos para revisar
                </p>
                <p className="mt-1 text-3xl font-bold">{stats.deadline}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </CardContent>
          </DepthCard>
          <DepthCard
            interactive
            onActivate={() => setActiveTab("andamentos")}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">Andamentos</p>
                <p className="mt-1 text-3xl font-bold">{stats.movements}</p>
              </div>
              <Scale className="h-6 w-6 text-emerald-600" />
            </CardContent>
          </DepthCard>
        </div>

        <DepthCard>
          <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">
                  DataJud/CNJ consulta processos e andamentos
                </p>
                <p className="text-xs text-muted-foreground">
                  Publicações chegam pelo Escavador. Nenhum prazo é criado sem
                  revisão humana.
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {lastSync
                ? `Última sincronização: ${formattedDate(lastSync.started_at)}`
                : "Nenhuma sincronização registrada"}
            </div>
          </CardContent>
        </DepthCard>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as FeedTab);
              setSource("todas");
            }}
          >
            <TabsList>
              <TabsTrigger value="publicacoes">
                Publicações ({publicacoes.length})
              </TabsTrigger>
              <TabsTrigger value="andamentos">
                Andamentos ({movimentos.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Processo, cliente, tribunal ou texto"
                className="pl-9"
              />
            </div>
            {activeTab === "publicacoes" && (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="nova">Novas</SelectItem>
                  <SelectItem value="urgente">Revisar prazo</SelectItem>
                  <SelectItem value="lida">Lidas</SelectItem>
                  <SelectItem value="processada">Processadas</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as origens</SelectItem>
                {activeTab === "publicacoes" ? (
                  <>
                    <SelectItem value="pje">PJe</SelectItem>
                    <SelectItem value="projudi">Projudi</SelectItem>
                    <SelectItem value="seeu">SEEU</SelectItem>
                    <SelectItem value="dje">Diário de Justiça</SelectItem>
                    <SelectItem value="unknown">A confirmar</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="datajud">DataJud/CNJ</SelectItem>
                    <SelectItem value="escavador">Escavador</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : activeTab === "publicacoes" ? (
          <div className="space-y-3">
            {filteredPublications.map((publication) => {
              const expanded = expandedId === publication.id;
              return (
                <DepthCard key={publication.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {sourceLabels[publication.origin_system]}
                          </Badge>
                          <Badge variant="secondary">
                            {publication.tribunal}
                          </Badge>
                          <Badge
                            variant={publication.status === "urgente"
                              ? "destructive"
                              : "outline"}
                          >
                            {statusLabels[publication.status] ??
                              publication.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-base">
                          {publication.numero_processo ??
                            "Processo ainda não vinculado"}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {publication.cliente_nome ?? "Cliente não identificado"}
                          {" · "}
                          {formattedDate(publication.data_publicacao)}
                          {" · "}
                          Fonte: {publication.provider}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {publication.possible_deadline &&
                          publication.review_status === "pending_review" && (
                            <Button
                              size="sm"
                              onClick={() => openDeadlineReview(publication)}
                            >
                              <CalendarClock className="mr-2 h-4 w-4" />
                              Revisar possível prazo
                            </Button>
                          )}
                        {publication.status !== "lida" &&
                          publication.status !== "processada" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void markAsRead(publication)}
                            >
                              <CheckCheck className="mr-2 h-4 w-4" />
                              Marcar como lida
                            </Button>
                          )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setExpandedId(expanded ? null : publication.id)}
                        >
                          {expanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className={expanded
                      ? "whitespace-pre-wrap text-sm leading-relaxed"
                      : "line-clamp-2 text-sm text-muted-foreground"}
                    >
                      {publication.conteudo}
                    </p>
                  </CardContent>
                </DepthCard>
              );
            })}
            {filteredPublications.length === 0 && (
              <EmptyState
                icon={Bell}
                title="Nenhuma publicação real encontrada"
                description="Quando o token do Escavador estiver configurado, as publicações do escritório aparecerão aqui. Dados do DataJud não são apresentados como publicação."
              />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMovements.map((movement) => {
              const process = processos.get(movement.process_id);
              const expanded = expandedId === movement.id;
              return (
                <DepthCard key={movement.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {movement.movement_type === "DOCUMENTO"
                              ? "Documento"
                              : "Andamento"}
                          </Badge>
                          <Badge variant="secondary">
                            {movement.provider === "datajud"
                              ? "DataJud/CNJ"
                              : movement.provider}
                          </Badge>
                        </div>
                        <CardTitle className="text-base">
                          {movement.title ?? "Movimentação processual"}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {process?.numero ?? "Processo não identificado"}
                          {" · "}
                          {process?.cliente_nome ?? "Cliente não identificado"}
                          {" · "}
                          {formattedDate(movement.occurred_at)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setExpandedId(expanded ? null : movement.id)}
                      >
                        {expanded
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className={expanded
                      ? "whitespace-pre-wrap text-sm leading-relaxed"
                      : "line-clamp-2 text-sm text-muted-foreground"}
                    >
                      {movement.content}
                    </p>
                  </CardContent>
                </DepthCard>
              );
            })}
            {filteredMovements.length === 0 && (
              <EmptyState
                icon={FileClock}
                title="Nenhum andamento encontrado"
                description="Os andamentos oficiais consultados no DataJud/CNJ e os eventos recebidos do Escavador aparecerão aqui."
              />
            )}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(reviewing)}
        onOpenChange={(open) => !open && setReviewing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar possível prazo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O sistema apenas sinalizou um possível prazo. Confirme a data
            somente após conferir a publicação original.
          </p>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="deadline">Data limite confirmada</Label>
              <Input
                id="deadline"
                type="date"
                value={reviewForm.deadline}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    deadline: event.target.value,
                  }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="days">Quantidade de dias (opcional)</Label>
              <Input
                id="days"
                type="number"
                min="1"
                value={reviewForm.days}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    days: event.target.value,
                  }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-title">Título da tarefa</Label>
              <Input
                id="task-title"
                value={reviewForm.title}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Fundamento da revisão</Label>
              <Input
                id="reason"
                value={reviewForm.reason}
                placeholder="Ex.: prazo expresso de 15 dias úteis no texto"
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={savingReview || !reviewForm.reason.trim()}
              onClick={() => void submitReview("reject")}
            >
              Não há prazo
            </Button>
            <Button
              disabled={savingReview ||
                !reviewForm.reason.trim() ||
                !reviewForm.deadline}
              onClick={() => void submitReview("confirm")}
            >
              {savingReview && (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar e criar tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

const EmptyState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
}) => (
  <DepthCard>
    <CardContent className="py-16 text-center">
      <Icon className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        {description}
      </p>
    </CardContent>
  </DepthCard>
);

export default Publicacoes;
