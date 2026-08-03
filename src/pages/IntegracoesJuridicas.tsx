import { useCallback, useEffect, useMemo, useState } from "react";
import { UsageMeter } from "@/components/integracoes/UsageMeter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import {
  LegalIntegrationError,
  legalIntegrationService,
  type LegalOverview,
} from "@/services/legal-integration";
import {
  platformAdmin,
  type PlatformIntegrationStatus,
} from "@/services/platform-admin";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  KeyRound,
  Newspaper,
  RefreshCw,
  Scale,
} from "lucide-react";

/** Traduz a falha da busca automática sem esconder a causa. */
function discoveryErrorMessage(code: string): string {
  const reasons: Record<string, string> = {
    datajud_request_failed:
      "O DataJud não respondeu a tempo. Tente novamente em alguns minutos.",
    datajud_unauthorized: "A chave do DataJud foi recusada.",
    datajud_rate_limited: "O limite de consultas do DataJud foi atingido.",
    datajud_court_not_supported:
      "O DataJud não cobre os tribunais dessa seccional.",
  };
  return reasons[code] ??
    "A busca automática falhou, mas a OAB continua cadastrada.";
}

export default function IntegracoesJuridicas() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [overview, setOverview] = useState<LegalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [professionalId, setProfessionalId] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [oabState, setOabState] = useState("AM");
  const [frequency, setFrequency] = useState<"DIARIA" | "SEMANAL">("DIARIA");
  const [selected, setSelected] = useState<string[]>([]);
  const [platformStatus, setPlatformStatus] =
    useState<PlatformIntegrationStatus | null>(null);
  const [escavadorToken, setEscavadorToken] = useState("");
  const isPlatformAccess = currentTenant?.accessMode === "platform";

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      setOverview(
        await legalIntegrationService.overview(currentTenant.tenantId),
      );
      if (currentTenant.accessMode === "platform") {
        setPlatformStatus(await platformAdmin.integrationStatus());
      } else {
        setPlatformStatus(null);
      }
    } catch (error) {
      toast({
        title: "Não foi possível carregar as integrações",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentTenant, toast]);

  const saveEscavadorToken = async () => {
    if (!isPlatformAccess || escavadorToken.trim().length < 16) return;
    setWorking(true);
    try {
      await platformAdmin.setEscavadorToken(escavadorToken.trim());
      setEscavadorToken("");
      toast({
        title: "Escavador conectado",
        description: "O token global foi validado e armazenado com segurança.",
      });
      await load();
    } catch (error) {
      toast({
        title: "Token não configurado",
        description: error instanceof Error
          ? error.message
          : "Não foi possível validar o token do Escavador.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const candidates = useMemo(
    () => overview?.discoveries.filter((item) => item.state === "candidate") ?? [],
    [overview],
  );

  const discover = async () => {
    if (!currentTenant || !professionalId || !oabNumber.trim()) return;
    setWorking(true);
    try {
      const result = await legalIntegrationService.discover({
        tenantId: currentTenant.tenantId,
        professionalId,
        oabNumber,
        oabState,
      });
      if (result.discoveryError) {
        // O cadastro foi salvo; apenas a busca automática não completou.
        toast({
          title: "OAB salva, mas a busca não completou",
          description: discoveryErrorMessage(result.discoveryError),
        });
      } else {
        toast({
          title: "Consulta concluída",
          description: `${result.totalCandidates ?? 0} processo(s) candidato(s) encontrado(s).`,
        });
      }
    } catch (error) {
      if (
        error instanceof LegalIntegrationError &&
        error.code === "integration_not_configured"
      ) {
        toast({
          title: "OAB salva",
          description: "A consulta será liberada assim que o token do Escavador chegar.",
        });
      } else {
        toast({
          title: "Não foi possível consultar",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      await load();
      setWorking(false);
    }
  };

  const confirm = async () => {
    if (!currentTenant || selected.length === 0) return;
    setWorking(true);
    try {
      const result = await legalIntegrationService.confirm(
        currentTenant.tenantId,
        selected,
        frequency,
      );
      toast({
        title: `${result.confirmed} processo(s) confirmado(s)`,
        description: result.providerConfigured
          ? "Os monitoramentos foram enviados ao Escavador."
          : "Os monitoramentos ficaram na fila aguardando o token.",
      });
      setSelected([]);
      await load();
    } catch (error) {
      toast({
        title: "Não foi possível confirmar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações jurídicas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre OABs, revise processos reais e controle o monitoramento.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Newspaper className="h-4 w-4" /> DJEN/CNJ
                </CardTitle>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  Ativo
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Publicações oficiais automáticas por OAB e processo. Não exige
              token do escritório.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4" /> DataJud/CNJ
                </CardTitle>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  Ativo
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Processos e andamentos oficiais, normalizados e vinculados ao
              cadastro do escritório.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="h-4 w-4" /> Escavador
                </CardTitle>
                <Badge
                  variant={overview?.providerConfigured ? "secondary" : "outline"}
                  className={overview?.providerConfigured
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                    : "border-amber-300 text-amber-800"}
                >
                  {overview?.providerConfigured ? "Conectado" : "Aguardando token"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Fonte complementar para descoberta e monitoramento ampliado. As
                fontes oficiais continuam funcionando sem ela.
              </p>
              {overview?.usage && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <UsageMeter
                    label="Orçamento do mês"
                    used={overview.usage.spent_cents}
                    total={overview.usage.budget_cents}
                    asCurrency
                  />
                  <UsageMeter
                    label="Processos monitorados"
                    used={overview.usage.monitors.used}
                    total={overview.usage.monitors.limit}
                  />
                  <p className="text-xs">
                    Atingido o orçamento, as consultas param automaticamente
                    até a virada do mês ou a contratação de adicional.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {isPlatformAccess && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">
                    Credencial global do Escavador
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Visível somente para a Conta geral. O token é criptografado
                    e nunca é exibido novamente.
                  </p>
                </div>
                <Badge variant="outline">
                  {platformStatus?.providers.escavador.configured
                    ? "Configurado"
                    : "Não configurado"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="password"
                autoComplete="new-password"
                value={escavadorToken}
                onChange={(event) => setEscavadorToken(event.target.value)}
                placeholder="Cole o token recebido do Escavador"
                aria-label="Token global do Escavador"
              />
              <Button
                className="shrink-0"
                disabled={working || escavadorToken.trim().length < 16}
                onClick={() => void saveEscavadorToken()}
              >
                {working && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Validar e salvar
              </Button>
            </CardContent>
          </Card>
        )}

        {!overview?.providerConfigured && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertTitle>Escavador complementar aguardando token</AlertTitle>
            <AlertDescription>
              O DJEN/CNJ e o DataJud/CNJ continuam ativos. Você já pode
              cadastrar as OABs; apenas as consultas pagas e o monitoramento
              complementar aguardam a credencial.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5" /> Advogado e OAB
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Profissional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(overview?.professionals ?? []).filter((item) => item.ativo)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número da OAB</Label>
              <Input
                inputMode="numeric"
                value={oabNumber}
                onChange={(event) => setOabNumber(event.target.value.replace(/\D/g, ""))}
                placeholder="12345"
              />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input
                value={oabState}
                maxLength={2}
                onChange={(event) => setOabState(event.target.value.toUpperCase())}
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button
                onClick={() => void discover()}
                disabled={working || !professionalId || !oabNumber || oabState.length !== 2}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {overview?.providerConfigured ? "Buscar processos" : "Salvar OAB"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Processos candidatos</CardTitle>
            <Badge variant="secondary">{candidates.length} pendente(s)</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum processo aguardando confirmação.
              </p>
            ) : candidates.map((candidate) => (
              <label
                key={candidate.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4"
              >
                <Checkbox
                  checked={selected.includes(candidate.id)}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked
                        ? [...current, candidate.id]
                        : current.filter((id) => id !== candidate.id)
                    )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{candidate.numero_cnj}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {candidate.title_active_party ?? "Parte ativa não informada"} ×{" "}
                    {candidate.title_passive_party ?? "parte passiva não informada"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[candidate.tribunal, candidate.court_unit].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </label>
            ))}

            {candidates.length > 0 && (
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-48 space-y-2">
                  <Label>Frequência</Label>
                  <Select
                    value={frequency}
                    onValueChange={(value: "DIARIA" | "SEMANAL") => setFrequency(value)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIARIA">Diária</SelectItem>
                      <SelectItem value="SEMANAL">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => void confirm()}
                  disabled={working || selected.length === 0}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirmar selecionados ({selected.length})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
