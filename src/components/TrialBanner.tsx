import { useNavigate } from "react-router-dom";
import { AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/usePlan";

export function TrialBanner() {
  const { status, trialDaysLeft, isTrialExpired } = usePlan();
  const navigate = useNavigate();

  if (status === "active") return null;

  if (status === "overdue") {
    return (
      <div className="w-full bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>Pagamento em atraso — algumas funcionalidades estão bloqueadas.</span>
        </div>
        <Button size="sm" variant="destructive" onClick={() => navigate("/checkout")}>
          Regularizar
        </Button>
      </div>
    );
  }

  if (isTrialExpired) {
    return (
      <div className="w-full bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>Seu período de teste encerrou. Assine para continuar usando.</span>
        </div>
        <Button size="sm" variant="destructive" onClick={() => navigate("/checkout")}>
          Escolher plano
        </Button>
      </div>
    );
  }

  if (status === "trial" && trialDaysLeft <= 3) {
    return (
      <div className="w-full bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-yellow-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {trialDaysLeft <= 0
              ? "Seu trial expira hoje!"
              : `Seu trial expira em ${trialDaysLeft} dia${trialDaysLeft > 1 ? "s" : ""}.`}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/checkout")}>
          Assinar agora
        </Button>
      </div>
    );
  }

  return null;
}
