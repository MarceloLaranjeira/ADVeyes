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
import { PropostaPrazoCard } from "@/components/processos/PropostaPrazoCard";
import {
  deadlineService,
  DeadlineError,
  type PropostaPrazo,
} from "@/services/deadline";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileClock,
  FileText,
  ExternalLink,
  RefreshCw,
  Search,
  Scale,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import { decodeHtmlEntities } from "@/lib/html-entities";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProcessoTimeline } from "@/components/processos/ProcessoTimeline";
import { buildProcessTimeline } from "@/lib/process-timeline";

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
  provider: "djen" | "escavador" | "manual" | "legacy";
  origin_system: "pje" | "projudi" | "seeu" | "dje" | "other" | "unknown";
  review_status: "pending_review" | "reviewed" | "dismissed" | "no_deadline";
  possible_deadline: boolean;
  source_name: string | null;
  source_url: string | null;
}

interface Movimento {
  id: string;
  tenant_id: string;
  process_id: string;
  process_number: string | null;
  client_name: string | null;
  provider: "escavador" | "datajud" | "manual";
  movement_type: "ANDAMENTO" | "DOCUMENTO";
  occurred_at: string | null;
  title: string | null;
  content: string;
  source_name: string | null;
  source_url: string | null;
}

interface SyncRun {
  id: string;
  provider: "djen" | "escavador" | "datajud";
  sync_kind: string;
  status: "running" | "succeeded" | "partial" | "failed";
  records_created: number;
  started_at: string;
  finished_at: string | null;
  error_code: string | null;
}

interface SyncSource {
  id: string;
  source_kind: "oab" | "process";
  provider: "djen" | "escavador" | "datajud";
  reference: string;
  active: boolean;
  next_sync_at: string;
  last_success_at: string | null;
  failure_count: number;
  last_error_code: string | null;
  paused_reason: string | null;
}

interface SyncSummary {
  monitored_oabs: number;
  monitored_processes: number;
  pending_count: number;
  failing_count: number;
  stopped_count: number;
  next_run: string | null;
  last_success: string | null;
}

const providerLabels: Record<string, string> = {
  djen: "DJEN/CNJ oficial",
  escavador: "Escavador",
  datajud: "DataJud/CNJ",
  manual: "Manual",
  legacy: "Importação anterior",
};

const failureLabels: Record<string, string> = {
  integration_not_configured: "Aguardando token do provedor",
  escavador_unauthorized: "Token do Escavador recusado",
  escavador_insufficient_balance: "Escavador sem saldo",
  escavador_rate_limited: "Limite de consultas atingido",
  escavador_request_failed: "Escavador indisponível",
  datajud_unauthorized: "Chave do DataJud recusada",
  datajud_rate_limited: "Limite do DataJud atingido",
  datajud_request_failed: "DataJud indisponível",
  djen_rate_limited: "Limite temporário do DJEN atingido",
  djen_request_failed: "DJEN/CNJ temporariamente indisponível",
  djen_timeout: "DJEN/CNJ demorou para responder",
  djen_invalid_response: "Resposta inesperada do DJEN/CNJ",
  djen_invalid_reference: "OAB ou número CNJ inválido",
  datajud_court_not_supported: "Tribunal sem cobertura no DataJud",
  max_retries: "Interrompida após cinco tentativas",
  provider_error: "Falha do provedor",
};

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

function failureLabel(code: string | null) {
  if (!code) return null;
  return failureLabels[code] ?? "Falha registrada";
}

interface PublicacoesProps {
  mode?: "publicacoes" | "intimacoes";
}

const Publicacoes = ({ mode = "publicacoes" }: PublicacoesProps) => {
  const isIntimations = mode === "intimacoes";
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<FeedTab>("publicacoes");
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [movementsLoaded, setMovementsLoaded] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncSources, setSyncSources] = useState<SyncSource[]>([]);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [taskByPublication, setTaskByPublication] = useState<Map<string, string>>(
    new Map(),
  );
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
  // Proposta calculada pelo motor de prazos. Ela pré-preenche o formulário,
  // mas quem confirma continua sendo o advogado — a proposta nunca grava.
  const [proposta, setProposta] = useState<PropostaPrazo | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erroCalculo, setErroCalculo] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    const tenantId = currentTenant.tenantId;
    let publicationsQuery = supabase
      .from("publicacoes")
      .select(
        "id, tenant_id, process_id, tipo, tribunal, numero_processo, cliente_nome, data_publicacao, conteudo, conteudo_simplificado, status, prazo_dias, data_prazo, tarefa_gerada, provider, origin_system, review_status, possible_deadline, source_name, source_url",
      )
      .eq("tenant_id", tenantId)
      .order("data_publicacao", { ascending: false });

    if (isIntimations) {
      publicationsQuery = publicationsQuery.eq(
        "review_status",
        "pending_review",
      );
    }

    const [
      publicationsResult,
      runsResult,
      sourcesResult,
      summaryResult,
      linksResult,
    ] = await Promise.all([
        publicationsQuery,
        supabase
          .from("legal_sync_runs")
          .select(
            "id, provider, sync_kind, status, records_created, started_at, finished_at, error_code",
          )
          .eq("tenant_id", tenantId)
          .order("started_at", { ascending: false })
          .limit(8),
        supabase
          .from("legal_sync_sources")
          .select(
            "id, source_kind, provider, reference, active, next_sync_at, last_success_at, failure_count, last_error_code, paused_reason",
          )
          .eq("tenant_id", tenantId)
          .or("active.eq.false,last_error_code.not.is.null")
          .or("paused_reason.is.null,paused_reason.neq.covered_by_oab")
          .order("failure_count", { ascending: false })
          .limit(12),
        // A view agregada preserva o RLS da tabela-base (security_invoker).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("legal_sync_source_summary")
          .select(
            "monitored_oabs, monitored_processes, pending_count, failing_count, stopped_count, next_run, last_success",
          )
          .eq("tenant_id", tenantId)
          .maybeSingle(),
        // A migration desta entrega ainda não integra o arquivo de tipos
        // gerado; o acesso permanece tipado no resultado logo abaixo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("publication_task_links")
          .select("publication_id, task_id")
          .eq("tenant_id", tenantId),
      ]);

    const auxiliaryError = runsResult.error ?? sourcesResult.error ??
      summaryResult.error ??
      linksResult.error;
    if (publicationsResult.error) {
      toast({
        title: "Não foi possível carregar as intimações",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } else if (auxiliaryError) {
      toast({
        title: "Intimações carregadas",
        description:
          "Alguns dados complementares da sincronização não responderam.",
      });
    }

    if (!publicationsResult.error) {
      setPublicacoes((publicationsResult.data ?? []) as Publicacao[]);
    }
    if (!runsResult.error) {
      setSyncRuns((runsResult.data ?? []) as SyncRun[]);
    }
    if (!sourcesResult.error) {
      setSyncSources((sourcesResult.data ?? []) as SyncSource[]);
    }
    if (!summaryResult.error) {
      setSyncSummary((summaryResult.data ?? null) as SyncSummary | null);
    }
    if (!linksResult.error) {
      setTaskByPublication(new Map(
        (linksResult.data ?? []).map((link: {
          publication_id: string;
          task_id: string;
        }) => [link.publication_id, link.task_id]),
      ));
    }
    setLoading(false);
  }, [currentTenant, isIntimations, toast]);

  const loadMovements = useCallback(async () => {
    if (!currentTenant || movementsLoaded || loadingMovements) return;
    setLoadingMovements(true);
    const { data, error } = await supabase
      .from("process_movements")
      .select(
        "id, tenant_id, process_id, process_number, client_name, provider, movement_type, occurred_at, title, content, source_name, source_url",
      )
      .eq("tenant_id", currentTenant.tenantId)
      .order("occurred_at", { ascending: false })
      .limit(500);

    if (error) {
      toast({
        title: "Não foi possível carregar os andamentos",
        description: "As intimações continuam disponíveis normalmente.",
        variant: "destructive",
      });
    } else {
      setMovimentos((data ?? []) as Movimento[]);
      setMovementsLoaded(true);
    }
    setLoadingMovements(false);
  }, [currentTenant, loadingMovements, movementsLoaded, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setMovimentos([]);
    setMovementsLoaded(false);
  }, [currentTenant?.tenantId]);

  useEffect(() => {
    if (activeTab === "andamentos") void loadMovements();
  }, [activeTab, loadMovements]);

  useEffect(() => {
    const publicationId = searchParams.get("publication");
    if (publicationId) setExpandedId(publicationId);
  }, [searchParams]);

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
      return [
        movement.title,
        movement.content,
        movement.source_name,
        movement.process_number,
        movement.client_name,
      ].some((value) =>
        value?.toLocaleLowerCase("pt-BR").includes(normalized)
      );
    });
  }, [movimentos, search, source]);

  const movementGroups = useMemo(() => {
    const grouped = new Map<string, Movimento[]>();
    for (const movement of filteredMovements) {
      const key = movement.process_id || movement.process_number || "unlinked";
      grouped.set(key, [...(grouped.get(key) ?? []), movement]);
    }
    return Array.from(grouped.entries()).map(([key, items]) => ({
      key,
      processId: items[0]?.process_id,
      processNumber: items[0]?.process_number,
      clientName: items[0]?.client_name,
      items,
      timeline: buildProcessTimeline({ movements: items }),
    }));
  }, [filteredMovements]);

  const stats = useMemo(() => ({
    total: publicacoes.length,
    pending: publicacoes.filter((item) => item.status === "nova").length,
    pendingReview: publicacoes.filter((item) =>
      item.review_status === "pending_review"
    ).length,
    deadline: publicacoes.filter((item) =>
      item.possible_deadline && item.review_status === "pending_review"
    ).length,
    movements: movimentos.length,
  }), [movimentos, publicacoes]);

  const synchronize = async () => {
    if (!currentTenant) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("legal-reconcile", {
      body: { tenantId: currentTenant.tenantId },
    });
    if (error) {
      toast({
        title: "Sincronização não concluída",
        description: "Não foi possível sincronizar agora.",
        variant: "destructive",
      });
    } else {
      const failed = typeof data?.failed === "number" ? data.failed : 0;
      toast({
        title: failed > 0
          ? "Sincronização concluída parcialmente"
          : "Sincronização concluída",
        description: data?.message ?? "Dados atualizados.",
        variant: failed > 0 ? "destructive" : undefined,
      });
      await load();
    }
    setSyncing(false);
  };

  const markAsRead = async (publication: Publicacao) => {
    if (!currentTenant) return;
    const { error } = await supabase
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
    setProposta(null);
    setErroCalculo(null);
    setReviewForm({
      deadline: publication.data_prazo
        ? publication.data_prazo.slice(0, 10)
        : "",
      days: publication.prazo_dias?.toString() ?? "",
      reason: "",
      title:
        `Cumprir prazo — ${publication.numero_processo ?? publication.tribunal}`,
    });
    void calcularPrazo(publication);
  };

  /**
   * Pede a proposta ao motor de prazos e usa o resultado para pré-preencher o
   * formulário. Falha de cálculo não bloqueia nada: o advogado continua com o
   * preenchimento manual que sempre existiu.
   */
  const calcularPrazo = async (publication: Publicacao) => {
    if (!currentTenant) return;
    setCalculando(true);
    setErroCalculo(null);
    try {
      const resultado = await deadlineService.compute({
        tenantId: currentTenant.tenantId,
        publicationId: publication.id,
      });
      setProposta(resultado);
      setReviewForm((current) => ({
        ...current,
        deadline: resultado.vencimento,
        days: String(resultado.dias),
        reason: current.reason ||
          `${resultado.fundamentoDoPrazo} ${resultado.fundamentos.join(" ")}`
            .trim()
            .slice(0, 500),
      }));
    } catch (error) {
      setErroCalculo(
        error instanceof DeadlineError
          ? error.message
          : "Não foi possível calcular o prazo agora.",
      );
    } finally {
      setCalculando(false);
    }
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

  const syncPanel = useMemo(() => {
    const active = syncSources.filter((source) => source.active);
    const nowIso = new Date().toISOString();
    const upcomingRuns = active
      .map((source) => source.next_sync_at)
      .filter((value): value is string => Boolean(value) && value > nowIso)
      .sort();
    const nextRun = upcomingRuns.at(0) ??
      active.map((source) => source.next_sync_at).filter(Boolean).sort().at(-1) ??
      null;
    const lastSuccess = syncSources
      .map((source) => source.last_success_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    return {
      monitoredOabs: syncSummary?.monitored_oabs ?? new Set(
        active.filter((source) => source.source_kind === "oab")
          .map((source) => source.reference),
      ).size,
      monitoredProcesses: syncSummary?.monitored_processes ?? new Set(
        active.filter((source) => source.source_kind === "process")
          .map((source) => source.reference),
      ).size,
      nextRun: syncSummary?.next_run ?? nextRun,
      lastSuccess: syncSummary?.last_success ?? lastSuccess,
      pendingCount: syncSummary?.pending_count ?? syncSources.filter((source) =>
        source.last_error_code === "integration_not_configured"
      ).length,
      failingCount: syncSummary?.failing_count ?? syncSources.filter((source) =>
        source.last_error_code &&
        source.last_error_code !== "integration_not_configured"
      ).length,
      stoppedCount: syncSummary?.stopped_count ?? syncSources.filter((source) =>
        !source.active && source.paused_reason !== "covered_by_oab"
      ).length,
      pending: syncSources.filter((source) =>
        source.last_error_code === "integration_not_configured"
      ),
      failing: syncSources.filter((source) =>
        source.last_error_code &&
        source.last_error_code !== "integration_not_configured"
      ),
      stopped: syncSources.filter((source) =>
        !source.active && source.paused_reason !== "covered_by_oab"
      ),
    };
  }, [syncSources, syncSummary]);

  const lastSync = syncRuns[0];

  return (
    <AppLayout>
      <div className="space-y-6 p-5 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isIntimations
                ? "Intimações aguardando revisão"
                : "Publicações e andamentos"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isIntimations
                ? `Comunicações oficiais que exigem conferência de ${currentTenant?.displayName}.`
                : `Acompanhamento real e isolado de ${currentTenant?.displayName}.`}
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
                <p className="text-sm text-muted-foreground">
                  {isIntimations ? "Intimações" : "Publicações"}
                </p>
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
                <p className="text-sm text-muted-foreground">
                  {isIntimations ? "Aguardando revisão" : "Novas"}
                </p>
                <p className="mt-1 text-3xl font-bold">
                  {isIntimations ? stats.pendingReview : stats.pending}
                </p>
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
          <CardContent className="space-y-4 p-5 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Situação da sincronização</p>
                  <p className="text-xs text-muted-foreground">
                    O DJEN/CNJ traz publicações oficiais; o DataJud/CNJ traz
                    processos e andamentos. O Escavador é complementar. Nenhum
                    prazo é criado sem revisão humana.
                  </p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground sm:text-right">
                <p>
                  Última execução:{" "}
                  {lastSync
                    ? formattedDate(lastSync.started_at)
                    : "nenhuma registrada"}
                </p>
                <p>
                  Próxima reconciliação:{" "}
                  {syncPanel.nextRun
                    ? formattedDate(syncPanel.nextRun)
                    : "sem fonte ativa"}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SyncMetric
                label="OABs monitoradas"
                value={syncPanel.monitoredOabs}
              />
              <SyncMetric
                label="Processos monitorados"
                value={syncPanel.monitoredProcesses}
              />
              <SyncMetric
                label="Fontes com falha"
                value={syncPanel.failingCount}
                tone={syncPanel.failingCount > 0 ? "warning" : "neutral"}
              />
              <SyncMetric
                label="Fontes interrompidas"
                value={syncPanel.stoppedCount}
                tone={syncPanel.stoppedCount > 0 ? "danger" : "neutral"}
              />
            </div>

            {syncPanel.pendingCount > 0 && (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                {syncPanel.pendingCount} fonte(s) aguardam a configuração do
                provedor. Os andamentos disponíveis continuam sendo atualizados.
              </p>
            )}

            {(syncPanel.failingCount > 0 || syncPanel.stoppedCount > 0) && (
              <ul className="space-y-1 text-xs">
                {[...syncPanel.stopped, ...syncPanel.failing]
                  .filter((source, index, list) =>
                    list.findIndex((item) => item.id === source.id) === index
                  )
                  .slice(0, 6)
                  .map((source) => (
                    <li
                      key={source.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Badge variant={source.active ? "outline" : "destructive"}>
                        {providerLabels[source.provider] ?? source.provider}
                      </Badge>
                      <span className="font-medium">{source.reference}</span>
                      <span className="text-muted-foreground">
                        {failureLabel(
                          source.paused_reason ?? source.last_error_code,
                        )}
                        {source.failure_count > 0 &&
                          ` · ${source.failure_count} tentativa(s)`}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
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
                {isIntimations ? "Intimações pendentes" : "Publicações"} (
                {publicacoes.length})
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

        {loading || (activeTab === "andamentos" && loadingMovements) ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : activeTab === "publicacoes" ? (
          <div className="space-y-3">
            {filteredPublications.map((publication) => {
              const expanded = expandedId === publication.id;
              const readableContent = decodeHtmlEntities(publication.conteudo);
              const missingOfficialContent = readableContent
                .toLocaleLowerCase("pt-BR")
                .includes("não foi possível extrair conteúdo");
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
                          {publication.cliente_nome ?? "Cliente ainda não vinculado"}
                          {" · "}
                          {formattedDate(publication.data_publicacao)}
                          {" · "}
                          Fonte:{" "}
                          {providerLabels[publication.provider] ??
                            publication.provider}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {taskByPublication.has(publication.id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(
                              `/tarefas?task=${taskByPublication.get(publication.id)}`,
                            )}
                          >
                            <ListChecks className="mr-2 h-4 w-4" />
                            Abrir tarefa
                          </Button>
                        )}
                        {publication.process_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(
                              `/processos/${publication.process_id}`,
                            )}
                          >
                            <Scale className="mr-2 h-4 w-4" />
                            Abrir processo
                          </Button>
                        )}
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
                      {readableContent}
                    </p>
                    {publication.source_url &&
                      (expanded || missingOfficialContent) && (
                        <Button asChild variant="outline" size="sm" className="mt-3">
                          <a
                            href={publication.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Abrir publicação no tribunal
                          </a>
                        </Button>
                      )}
                    {missingOfficialContent && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        O próprio DJEN não forneceu o texto deste documento. Use
                        o link oficial acima para consultar os autos.
                      </p>
                    )}
                  </CardContent>
                </DepthCard>
              );
            })}
            {filteredPublications.length === 0 && (
              <EmptyState
                icon={Bell}
                title={isIntimations
                  ? "Nenhuma intimação aguardando revisão"
                  : "Nenhuma publicação real encontrada"}
                description={isIntimations
                  ? "Quando uma nova comunicação oficial exigir conferência, ela aparecerá aqui."
                  : "As publicações oficiais encontradas no DJEN/CNJ por OAB ou processo aparecerão aqui automaticamente. Dados do DataJud não são apresentados como publicação."}
              />
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {movementGroups.map((group) => {
              return (
                <DepthCard key={group.key}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Processo</Badge>
                          <Badge variant="secondary">{group.items.length} evento(s)</Badge>
                        </div>
                        <CardTitle className="mt-3 font-mono text-base">
                          {group.processNumber ?? "Processo não identificado"}
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {group.clientName ?? "Cliente não identificado"}
                        </p>
                      </div>
                      {group.processId && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/processos/${group.processId}`)}>
                          Abrir processo
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <ProcessoTimeline events={group.timeline} previewLimit={4} />
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
            O sistema calcula uma proposta a partir do texto e do CPC. Confirme
            a data somente após conferir a publicação original.
          </p>

          {calculando && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              Lendo a publicação e contando os dias úteis…
            </div>
          )}

          {erroCalculo && !calculando && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden="true"
              />
              <span>{erroCalculo} Preencha a data manualmente abaixo.</span>
            </div>
          )}

          {proposta && !calculando && (
            <PropostaPrazoCard
              proposta={proposta}
              isConfirming={savingReview}
              onConfirmar={() => void submitReview("confirm")}
              onAjustar={() => setProposta(null)}
            />
          )}

          {/* Com a proposta na tela, os campos manuais ficam fora do caminho.
              "Ajustar" limpa a proposta e devolve o preenchimento à mão, já
              com os valores calculados dentro. */}
          <div className={proposta ? "hidden" : "grid gap-4 py-2"}>
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
            {/* O cartão da proposta traz o próprio Confirmar. Manter os dois
                na tela deixaria o advogado sem saber qual dos dois grava. */}
            {!proposta && (
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
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

const SyncMetric = ({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "danger";
}) => (
  <div className="rounded-lg border bg-muted/30 px-3 py-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p
      className={`text-xl font-semibold ${
        tone === "danger"
          ? "text-destructive"
          : tone === "warning"
          ? "text-amber-600"
          : ""
      }`}
    >
      {value}
    </p>
  </div>
);

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
