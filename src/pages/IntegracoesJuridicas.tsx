import { useCallback, useEffect, useMemo, useState } from "react";
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
import { AlertTriangle, CheckCircle2, RefreshCw, Scale } from "lucide-react";

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

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      setOverview(
        await legalIntegrationService.overview(currentTenant.tenantId),
      );
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
      toast({
        title: "Consulta concluída",
        description: `${result.totalCandidates ?? 0} processo(s) candidato(s) encontrado(s).`,
      });
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

        {!overview?.providerConfigured && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertTitle>Aguardando token do Escavador</AlertTitle>
            <AlertDescription>
              Você já pode cadastrar as OABs. Nenhuma consulta paga ou
              monitoração será executada até o token ser configurado.
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
