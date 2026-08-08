import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { session, loading } = useAuth();
  const {
    memberships,
    currentTenant,
    loading: tenantLoading,
    error,
    selectTenant,
    refresh,
  } = useTenant();

  if (loading || (session && tenantLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (error === "no_membership") {
    return <Navigate to="/cadastro/concluir" replace />;
  }

  if (error || !currentTenant) {
    const messages = {
      invalid_host: {
        title: "Endereço inválido",
        description: "Acesse o ADVeyes pelo domínio oficial do seu escritório.",
      },
      tenant_unavailable: {
        title: "Escritório indisponível",
        description: "Este ambiente está temporariamente indisponível. Fale com o administrador.",
      },
      tenant_forbidden: {
        title: "Acesso não autorizado",
        description: "Sua conta não está vinculada ao escritório deste endereço.",
      },
      no_membership: {
        title: "Conta sem escritório",
        description: "Conclua o cadastro para criar seu escritório.",
      },
      tenant_load_failed: {
        title: "Não foi possível carregar o escritório",
        description: "Confira sua conexão e tente novamente.",
      },
      public_config_failed: {
        title: "Não foi possível validar este endereço",
        description: "Confira sua conexão e tente novamente.",
      },
    } as const;
    const message = error ? messages[error] : null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">
            {message?.title ?? "Escolha o escritório"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {message?.description ??
              "Selecione o escritório que deseja acessar nesta sessão."}
          </p>

          {!error && memberships.length > 1 && (
            <div className="mt-6 grid gap-3">
              {memberships.map((membership) => (
                <Button
                  key={membership.tenantId}
                  variant="outline"
                  className="h-auto justify-start px-4 py-3 text-left"
                  onClick={() => selectTenant(membership)}
                >
                  <span>
                    <span className="block font-medium">
                      {membership.branding.publicName}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {membership.role}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          )}

          {error && (
            <Button className="mt-6" onClick={() => void refresh()}>
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
