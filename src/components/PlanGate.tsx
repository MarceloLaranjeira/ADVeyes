import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlan } from "@/hooks/usePlan";
import type { PlanFeature } from "@/contexts/SubscriptionContext";

interface PlanGateProps {
  feature: PlanFeature;
  children: React.ReactNode;
  overlay?: boolean;
}

export function PlanGate({ feature, children, overlay = false }: PlanGateProps) {
  const { canUse } = usePlan();
  const navigate = useNavigate();

  if (canUse(feature)) return <>{children}</>;

  if (overlay) {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-40 select-none">{children}</div>
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={() => navigate("/checkout")}
        >
          <div className="bg-background/90 border rounded-lg px-4 py-2 flex items-center gap-2 shadow text-sm font-medium">
            <Lock className="w-4 h-4 text-primary" />
            Assine para continuar
          </div>
        </div>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative inline-flex cursor-not-allowed opacity-60">
          <div className="pointer-events-none">{children}</div>
          <Lock className="absolute -top-1 -right-1 w-3.5 h-3.5 text-primary bg-background rounded-full" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Assine um plano para usar esta funcionalidade</p>
        <button
          className="text-xs text-primary underline mt-1"
          onClick={() => navigate("/checkout")}
        >
          Ver planos
        </button>
      </TooltipContent>
    </Tooltip>
  );
}
