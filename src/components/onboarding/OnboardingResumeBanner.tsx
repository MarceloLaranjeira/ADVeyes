import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import { readOnboarding, type OnboardingRow } from "@/services/onboarding";

export function OnboardingResumeBanner() {
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [onboarding, setOnboarding] = useState<OnboardingRow | null>(null);

  useEffect(() => {
    if (!currentTenant?.tenantId || !["owner", "admin"].includes(currentTenant.role)) return;
    void readOnboarding(currentTenant.tenantId).then(setOnboarding).catch(() => undefined);
  }, [currentTenant?.role, currentTenant?.tenantId]);

  if (!onboarding || onboarding.completed_at) return null;
  return (
    <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#081B48] text-white"><Scale className="h-5 w-5" /></span>
        <div><p className="font-semibold text-[#081B48]">Conclua a configuração do seu escritório</p><p className="mt-0.5 text-sm text-slate-600">Cadastre sua OAB para localizar processos e acompanhar publicações oficiais.</p></div>
      </div>
      <Button className="shrink-0 bg-[#2563EB]" onClick={() => navigate("/onboarding")}>Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button>
    </div>
  );
}
