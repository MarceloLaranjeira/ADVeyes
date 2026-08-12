import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import {
  type TenantMembership,
  useTenant,
} from "@/contexts/TenantContext";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { platformAdmin, type PlatformTenantSummary } from "@/services/platform-admin";
import { Building2, Check, ChevronDown, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface EnvironmentSwitcherProps {
  mode: "platform" | "tenant";
  onTenantSelect?: (tenant: TenantMembership) => void;
  className?: string;
}

export const EnvironmentSwitcher = ({
  mode,
  onTenantSelect,
  className,
}: EnvironmentSwitcherProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { memberships, currentTenant, selectTenant, selectPlatformTenant } = useTenant();
  const { isPlatformAdmin, loading } = usePlatformAdmin();
  const [platformTenants, setPlatformTenants] = useState<PlatformTenantSummary[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    let cancel = false;
    setLoadingTenants(true);
    platformAdmin.overview()
      .then((data) => {
        if (!cancel) {
          setPlatformTenants(data.tenants ?? []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoadingTenants(false);
      });
    return () => { cancel = true; };
  }, [isPlatformAdmin]);

  const rememberEnvironment = (value: string) => {
    if (!user) return;
    localStorage.setItem(`adveyes:last-environment:${user.id}`, value);
  };

  const openPlatform = () => {
    rememberEnvironment("platform");
    navigate("/admin");
  };

  const openTenant = (tenant: TenantMembership) => {
    rememberEnvironment(`tenant:${tenant.slug}`);
    if (onTenantSelect) {
      onTenantSelect(tenant);
      return;
    }
    selectTenant(tenant);
    navigate("/");
  };

  const openPlatformTenant = (tenant: PlatformTenantSummary) => {
    rememberEnvironment(`tenant:${tenant.slug}`);
    const platformMembership: TenantMembership = {
      tenantId: tenant.id,
      slug: tenant.slug,
      displayName: tenant.displayName,
      status: tenant.status,
      role: "admin",
      dataScope: "tenant",
      accessMode: "platform",
      branding: {
        publicName: tenant.displayName,
        shortName: tenant.displayName,
        logoLightPath: null,
        logoDarkPath: null,
        faviconPath: null,
        iconPath: null,
        colorTokens: {},
      },
    };
    if (onTenantSelect) {
      onTenantSelect(platformMembership);
      return;
    }
    selectPlatformTenant(platformMembership);
    navigate("/");
  };

  const label = mode === "platform"
    ? "Conta geral — ADVeyes"
    : currentTenant?.branding?.publicName ??
      currentTenant?.displayName ??
      (isPlatformAdmin ? "Visualização de escritório" : "Escritório");

  if (loading && memberships.length < 2) {
    return (
      <div className={className} aria-label="Carregando ambientes">
        <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!isPlatformAdmin && memberships.length <= 1) return null;

  const directTenantIds = new Set(memberships.map((m) => m.tenantId));
  const otherPlatformTenants = platformTenants.filter(
    (pt) => !directTenantIds.has(pt.id),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`max-w-[280px] justify-between gap-2 ${className ?? ""}`}
          aria-label={`Ambiente atual: ${label}`}
        >
          {mode === "platform" ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
          )}
          <span className="truncate font-medium">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 max-h-[420px] overflow-y-auto">
        <DropdownMenuLabel>Trocar ambiente</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isPlatformAdmin && (
          <DropdownMenuItem onClick={openPlatform} className="cursor-pointer">
            <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
            <span className="flex-1 font-medium">Painel Conta Geral — ADVeyes</span>
            {mode === "platform" && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        )}

        {memberships.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">
              Meus escritórios
            </DropdownMenuLabel>
            {memberships.map((tenant) => (
              <DropdownMenuItem
                key={tenant.tenantId}
                onClick={() => openTenant(tenant)}
                className="cursor-pointer"
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span className="flex-1 truncate">
                  {tenant.branding?.publicName || tenant.displayName}
                </span>
                {mode === "tenant" &&
                  currentTenant?.tenantId === tenant.tenantId && (
                    <Check className="h-4 w-4" />
                  )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {isPlatformAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">
              Escritórios cadastrados ({platformTenants.length})
            </DropdownMenuLabel>
            {loadingTenants && otherPlatformTenants.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground italic text-center">
                Carregando escritórios...
              </div>
            ) : otherPlatformTenants.length === 0 && memberships.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground italic text-center">
                Nenhum outro escritório encontrado.
              </div>
            ) : (
              otherPlatformTenants.map((tenant) => (
                <DropdownMenuItem
                  key={tenant.id}
                  onClick={() => openPlatformTenant(tenant)}
                  className="cursor-pointer"
                >
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {tenant.displayName}
                  </span>
                  {mode === "tenant" && currentTenant?.tenantId === tenant.id && (
                    <Check className="h-4 w-4" />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
