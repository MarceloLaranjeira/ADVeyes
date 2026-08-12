import { useCallback, useEffect, useMemo, useState } from "react";
import { UsageMeter } from "@/components/integracoes/UsageMeter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import {
  legalIntegrationService,
  type LegalOverview,
} from "@/services/legal-integration";
import {
  platformAdmin,
  type PlatformIntegrationStatus,
} from "@/services/platform-admin";
import {
  AlertTriangle,
  Database,
  KeyRound,
  Newspaper,
  Pencil,
  RefreshCw,
  Scale,
  Trash2,
} from "lucide-react";

export default function IntegracoesJuridicas() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [overview, setOverview] = useState<LegalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [professionalId, setProfessionalId] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [oabState, setOabState] = useState("AM");
  const [editingRegistration, setEditingRegistration] = useState<
    LegalOverview["registrations"][number] | null
  >(null);
  const [editProfessionalId, setEditProfessionalId] = useState("");
  const [editOabNumber, setEditOabNumber] = useState("");
  const [editOabState, setEditOabState] = useState("AM");
  const [deletingRegistration, setDeletingRegistration] = useState<
    LegalOverview["registrations"][number] | null
  >(null);
  const [platformStatus, setPlatformStatus] =
    useState<PlatformIntegrationStatus | null>(null);
  const [escavadorToken, setEscavadorToken] = useState("");
  const isPlatformAccess = currentTenant?.accessMode === "platform";
  const tenantId = currentTenant?.tenantId;
  const accessMode = currentTenant?.accessMode;

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      setOverview(
        await legalIntegrationService.overview(tenantId),
      );
      if (accessMode === "platform") {
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
  }, [accessMode, tenantId, toast]);

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
  const activeProfessionals = useMemo(
    () => (overview?.professionals ?? []).filter((item) => item.ativo),
    [overview],
  );
  const activeRegistrations = useMemo(
    () => (overview?.registrations ?? []).filter((item) =>
      item.status !== "disabled" && item.status !== "invalid"
    ),
    [overview],
  );
  const selectedProfessionalId = activeProfessionals.some(
      (item) => item.id === professionalId,
    )
    ? professionalId
    : activeProfessionals.length === 1
    ? activeProfessionals[0].id
    : "";
  const professionalById = useMemo(
    () => new Map((overview?.professionals ?? []).map((item) => [item.id, item])),
    [overview],
  );
  const sourcesByRegistration = useMemo(() => {
    const grouped = new Map<string, NonNullable<LegalOverview["sources"]>>();
    for (const source of overview?.sources ?? []) {
      if (!source.lawyer_registration_id) continue;
      const items = grouped.get(source.lawyer_registration_id) ?? [];
      items.push(source);
      grouped.set(source.lawyer_registration_id, items);
    }
    return grouped;
  }, [overview]);

  const discover = async () => {
    if (!currentTenant || !selectedProfessionalId || !oabNumber.trim()) return;
    setWorking(true);
    try {
      await legalIntegrationService.register({
        tenantId: currentTenant.tenantId,
        professionalId: selectedProfessionalId,
        oabNumber,
        oabState,
      });
      toast({
        title: "OAB salva e sincronização ativada",
        description:
          "A consulta continuará no servidor. Os processos encontrados serão importados automaticamente.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível salvar a OAB",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      await load();
      setWorking(false);
    }
  };

  const openEdit = (registration: LegalOverview["registrations"][number]) => {
    setEditingRegistration(registration);
    setEditProfessionalId(registration.professional_id);
    setEditOabNumber(registration.oab_number);
    setEditOabState(registration.oab_state);
  };

  const saveEdit = async () => {
    if (!currentTenant || !editingRegistration) return;
    setWorking(true);
    try {
      await legalIntegrationService.updateRegistration({
        tenantId: currentTenant.tenantId,
        registrationId: editingRegistration.id,
        professionalId: editProfessionalId,
        oabNumber: editOabNumber,
        oabState: editOabState,
      });
      setEditingRegistration(null);
      toast({
        title: "OAB atualizada",
        description: "As fontes foram atualizadas e a sincronização foi agendada.",
      });
      await load();
    } catch (error) {
      toast({
        title: "Não foi possível editar a OAB",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const disableRegistration = async () => {
    if (!currentTenant || !deletingRegistration) return;
    setWorking(true);
    try {
      await legalIntegrationService.disableRegistration(
        currentTenant.tenantId,
        deletingRegistration.id,
      );
      setDeletingRegistration(null);
      toast({
        title: "OAB excluída do monitoramento",
        description: "Os processos e todo o histórico importado foram preservados.",
      });
      await load();
    } catch (error) {
      toast({
        title: "Não foi possível excluir a OAB",
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
              <Select value={selectedProfessionalId} onValueChange={setProfessionalId}>
                <SelectTrigger disabled={!overview?.access.canMutate}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {activeProfessionals.map((item) => (
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
                disabled={!overview?.access.canMutate}
                value={oabNumber}
                onChange={(event) => setOabNumber(event.target.value.replace(/\D/g, ""))}
                placeholder="12345"
              />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input
                value={oabState}
                disabled={!overview?.access.canMutate}
                maxLength={2}
                onChange={(event) => setOabState(event.target.value.toUpperCase())}
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button
                onClick={() => void discover()}
                disabled={
                  working || !overview?.access.canMutate || !selectedProfessionalId ||
                  !oabNumber || oabState.length !== 2
                }
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {working
                  ? "Salvando e agendando..."
                  : overview?.providerConfigured
                    ? "Salvar OAB e sincronizar"
                    : "Salvar OAB"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">OABs monitoradas</CardTitle>
            <Badge variant="secondary">
              {activeRegistrations.length} inscrição(ões)
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : activeRegistrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma OAB cadastrada neste escopo.
              </p>
            ) : activeRegistrations.map((registration) => {
              const professional = professionalById.get(registration.professional_id);
              const currentReference = `${registration.oab_number}/${registration.oab_state}`;
              const sources = (sourcesByRegistration.get(registration.id) ?? [])
                .filter((source) => source.reference === currentReference);
              const latestSuccess = sources.reduce<string | null>(
                (latest, source) => !source.last_success_at ||
                    (latest && latest >= source.last_success_at)
                  ? latest
                  : source.last_success_at,
                null,
              ) ?? registration.last_discovery_at;
              return (
                <div key={registration.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">
                      OAB {registration.oab_number}/{registration.oab_state}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {professional?.nome ?? registration.verified_name ?? "Profissional"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sources.map((source) => (
                        <Badge
                          key={source.id}
                          variant="outline"
                          className={source.active && !source.last_error_code
                            ? "border-emerald-300 text-emerald-800"
                            : source.active && source.last_error_code === "integration_not_configured"
                              ? "border-slate-300 text-slate-700"
                              : source.active && source.last_error_code === "escavador_insufficient_balance"
                                ? "border-amber-400 bg-amber-50 text-amber-900 font-medium"
                                : source.active
                                  ? "border-amber-300 text-amber-800"
                                  : "border-red-300 text-red-800"}
                        >
                          {source.provider.toUpperCase()}: {source.last_error_code === "integration_not_configured"
                            ? "não configurado"
                            : source.last_error_code === "escavador_insufficient_balance"
                              ? "saldo insuficiente"
                              : source.last_error_code === "escavador_rate_limited"
                                ? "limite de chamadas"
                                : source.last_error_code
                                  ? "retentativa"
                                  : source.last_success_at
                                    ? "sincronizado"
                                    : "aguardando"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <Badge variant={registration.status === "verified" ? "secondary" : "outline"}>
                      {registration.status === "verified" ? "Verificada" : "Sincronização ativa"}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {latestSuccess
                        ? `Último sucesso: ${new Date(latestSuccess).toLocaleString("pt-BR")}`
                        : "Aguardando primeira descoberta"}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={working}
                        onClick={() => {
                          if (overview?.access && !overview.access.canMutate) {
                            toast({
                              title: "Modo leitura (Conta Geral)",
                              description: "Clique em 'Ativar suporte por 30 minutos' no topo da tela para habilitar a edição.",
                              variant: "default",
                            });
                            return;
                          }
                          openEdit(registration);
                        }}
                        aria-label={`Editar OAB ${currentReference}`}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={working}
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          if (overview?.access && !overview.access.canMutate) {
                            toast({
                              title: "Modo leitura (Conta Geral)",
                              description: "Clique em 'Ativar suporte por 30 minutos' no topo da tela para habilitar a exclusão.",
                              variant: "default",
                            });
                            return;
                          }
                          setDeletingRegistration(registration);
                        }}
                        aria-label={`Excluir OAB ${currentReference}`}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {candidates.length > 0 && (
              <Alert>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <AlertTitle>Importação automática em andamento</AlertTitle>
                <AlertDescription>
                  {candidates.length} processo(s) descoberto(s) ainda estão na fila.
                  Não é necessário selecionar ou confirmar; o servidor continuará sozinho.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={Boolean(editingRegistration)}
          onOpenChange={(open) => !open && !working && setEditingRegistration(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar OAB</DialogTitle>
              <DialogDescription>
                A alteração atualizará o perfil e agendará nova sincronização.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select value={editProfessionalId} onValueChange={setEditProfessionalId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeProfessionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>
                        {professional.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <div className="space-y-2">
                  <Label>Número da OAB</Label>
                  <Input
                    inputMode="numeric"
                    value={editOabNumber}
                    onChange={(event) => setEditOabNumber(event.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input
                    maxLength={2}
                    value={editOabState}
                    onChange={(event) => setEditOabState(event.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={working} onClick={() => setEditingRegistration(null)}>
                Cancelar
              </Button>
              <Button
                disabled={working || !editProfessionalId || !editOabNumber || editOabState.length !== 2}
                onClick={() => void saveEdit()}
              >
                {working && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(deletingRegistration)}
          onOpenChange={(open) => !open && !working && setDeletingRegistration(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir esta OAB do monitoramento?</AlertDialogTitle>
              <AlertDialogDescription>
                A OAB {deletingRegistration?.oab_number}/{deletingRegistration?.oab_state}
                {" "}será desativada. Os processos, partes, andamentos, documentos e
                demais dados já importados serão preservados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={working}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(event) => {
                  event.preventDefault();
                  void disableRegistration();
                }}
              >
                {working && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Excluir OAB
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
