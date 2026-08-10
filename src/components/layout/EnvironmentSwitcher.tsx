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
import { Building2, Check, ChevronDown, ShieldCheck } from "lucide-react";
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
  const { memberships, currentTenant, selectTenant } = useTenant();
  const { isPlatformAdmin, loading } = usePlatformAdmin();

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

  const label = mode === "platform"
    ? "Conta geral — ADVeyes"
    : currentTenant?.branding.publicName ??
      currentTenant?.displayName ??
      (isPlatformAdmin ? "Visualização sem escritório" : "Escritório");

  if (loading && memberships.length < 2) {
    return (
      <div
        className={className}
        aria-label="Carregando ambientes"
      >
        <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!isPlatformAdmin && memberships.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`max-w-[260px] justify-between gap-2 ${className ?? ""}`}
          aria-label={`Ambiente atual: ${label}`}
        >
          {mode === "platform" ? (
            <ShieldCheck className="h-4 w-4 shrink-0" />
          ) : (
            <Building2 className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Trocar ambiente</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isPlatformAdmin && (
          <DropdownMenuItem onClick={openPlatform}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            <span className="flex-1">Conta geral — ADVeyes</span>
            {mode === "platform" && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        )}
        {isPlatformAdmin && memberships.length > 0 && (
          <DropdownMenuSeparator />
        )}
        {memberships.map((tenant) => (
          <DropdownMenuItem
            key={tenant.tenantId}
            onClick={() => openTenant(tenant)}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">
              {tenant.branding.publicName || tenant.displayName}
            </span>
            {mode === "tenant" &&
              currentTenant?.tenantId === tenant.tenantId && (
                <Check className="h-4 w-4" />
              )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
