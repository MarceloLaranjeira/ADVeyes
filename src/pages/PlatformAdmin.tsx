import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DepthCard } from "@/components/dashboard/DepthCard";
import { EnvironmentSwitcher } from "@/components/layout/EnvironmentSwitcher";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  buildTenantAppUrl,
  shouldNavigateTenantInPlace,
} from "@/lib/tenant-host";
import {
  platformAdmin,
  type PlatformOverview,
} from "@/services/platform-admin";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  LogOut,
  RefreshCw,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const statusLabel: Record<string, string> = {
  active: "Ativo",
  trialing: "Em teste",
  past_due: "Pagamento pendente",
  suspended: "Suspenso",
  canceled: "Cancelado",
  archived: "Arquivado",
};

type TenantListMode = "all" | "active" | "members" | "monitored" | "failures";

const PlatformAdmin = () => {
  const { user, signOut } = useAuth();
  const { host, memberships, selectTenant } = useTenant();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [listMode, setListMode] = useState<TenantListMode>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await platformAdmin.overview());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openTenant = (tenantId: string) => {
    const membership = memberships.find((item) => item.tenantId === tenantId);
    if (!membership) return;

    if (shouldNavigateTenantInPlace(host)) {
      selectTenant(membership);
      navigate("/");
      return;
    }

    window.location.assign(
      buildTenantAppUrl({
        slug: membership.slug,
        pathname: "/",
        protocol: window.location.protocol,
      }),
    );
  };

  const displayedTenants = useMemo(() => {
    const tenants = [...(overview?.tenants ?? [])];
    if (listMode === "active") {
      return tenants.filter((tenant) =>
        ["active", "trialing"].includes(tenant.status),
      );
    }
    if (listMode === "failures") {
      return tenants.filter((tenant) => tenant.integrationFailures > 0);
    }
    if (listMode === "members") {
      return tenants.sort((a, b) => b.activeMembers - a.activeMembers);
    }
    if (listMode === "monitored") {
      return tenants.sort(
        (a, b) => b.monitoredProcesses - a.monitoredProcesses,
      );
    }
    return tenants;
  }, [listMode, overview]);

  const metricCards = [
    {
      label: "Escritórios",
      value: overview?.totals.tenants ?? 0,
      icon: Building2,
      mode: "all" as const,
    },
    {
      label: "Escritórios ativos",
      value: overview?.totals.activeTenants ?? 0,
      icon: ShieldCheck,
      mode: "active" as const,
    },
    {
      label: "Usuários ativos",
      value: overview?.totals.activeMembers ?? 0,
      icon: Users,
      mode: "members" as const,
    },
    {
      label: "Processos monitorados",
      value: overview?.totals.monitoredProcesses ?? 0,
      icon: Scale,
      mode: "monitored" as const,
    },
    {
      label: "Falhas de integração",
      value: overview?.totals.integrationFailures ?? 0,
      icon: AlertTriangle,
      mode: "failures" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">ADVeyes — Conta geral</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <EnvironmentSwitcher
              mode="platform"
              onTenantSelect={(tenant) => openTenant(tenant.tenantId)}
              className="ml-3 hidden sm:inline-flex"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-8 px-5 py-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Visão geral da plataforma
          </h1>
          <p className="mt-1 text-muted-foreground">
            Escritórios, usuários, assinaturas e integrações jurídicas.
          </p>
        </div>

        {error ? (
          <Card>
            <CardContent className="flex items-center justify-between gap-4 p-6">
              <div>
                <p className="font-medium">Não foi possível carregar o painel</p>
                <p className="text-sm text-muted-foreground">
                  Confira sua conexão e tente novamente.
                </p>
              </div>
              <Button onClick={() => void load()}>Tentar novamente</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {metricCards.map(({ label, value, icon: Icon, mode }) => (
                <DepthCard
                  key={label}
                  interactive
                  onActivate={() => setListMode(mode)}
                  aria-label={`${label}: ${value}. Filtrar escritórios`}
                  className={listMode === mode ? "border-primary/40" : ""}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">
                      {loading ? "—" : value}
                    </div>
                  </CardContent>
                </DepthCard>
              ))}
            </div>

            <DepthCard>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Escritórios</CardTitle>
                  {listMode !== "all" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setListMode("all")}
                    >
                      Limpar filtro
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Escritório</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead className="text-right">Usuários</TableHead>
                      <TableHead className="text-right">Candidatos</TableHead>
                      <TableHead className="text-right">Monitorados</TableHead>
                      <TableHead className="text-right">Falhas</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedTenants.map((tenant) => {
                      const canOpen = memberships.some(
                        (item) => item.tenantId === tenant.id,
                      );
                      return (
                        <TableRow key={tenant.id}>
                          <TableCell>
                            <div className="font-medium">{tenant.displayName}</div>
                            <div className="text-xs text-muted-foreground">
                              {tenant.slug}
                            </div>
                          </TableCell>
                          <TableCell>
                            {statusLabel[tenant.status] ?? tenant.status}
                          </TableCell>
                          <TableCell>
                            {tenant.subscription?.planCode ?? "Sem plano"}
                          </TableCell>
                          <TableCell className="text-right">
                            {tenant.activeMembers}
                          </TableCell>
                          <TableCell className="text-right">
                            {tenant.candidateProcesses}
                          </TableCell>
                          <TableCell className="text-right">
                            {tenant.monitoredProcesses}
                          </TableCell>
                          <TableCell className="text-right">
                            {tenant.integrationFailures}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!canOpen}
                              onClick={() => openTenant(tenant.id)}
                            >
                              Abrir
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!loading && displayedTenants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center">
                          Nenhum escritório cadastrado.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </DepthCard>
          </>
        )}
      </main>
    </div>
  );
};

export default PlatformAdmin;
