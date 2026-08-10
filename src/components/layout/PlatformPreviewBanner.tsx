import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Eye, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export function PlatformPreviewBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTenant, error } = useTenant();
  const { isPlatformAdmin, loading } = usePlatformAdmin();

  if (
    loading ||
    !isPlatformAdmin ||
    currentTenant ||
    error !== "no_membership" ||
    location.pathname === "/admin"
  ) return null;

  return (
    <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-950">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span>
          <strong>Visualização da Conta Geral:</strong>{" "}
          este módulo está vazio porque ainda não há escritório cadastrado.
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={() => navigate("/admin")}>
        <ShieldCheck className="mr-2 h-4 w-4" />
        Voltar à administração
      </Button>
    </div>
  );
}
