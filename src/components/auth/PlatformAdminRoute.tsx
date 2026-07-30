import { Button } from "@/components/ui/button";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Navigate } from "react-router-dom";

export const PlatformAdminRoute = (
  { children }: { children: React.ReactNode },
) => {
  const { isPlatformAdmin, loading, error, refresh } = usePlatformAdmin();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!isPlatformAdmin && !error) {
    return <Navigate to="/" replace />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg rounded-xl border bg-card p-6">
          <h1 className="text-xl font-semibold">
            Não foi possível validar a conta geral
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confira sua conexão e tente novamente.
          </p>
          <Button className="mt-6" onClick={() => void refresh()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
