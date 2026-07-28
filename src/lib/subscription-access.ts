export type PlanName = "trial" | "starter" | "profissional" | "escritorio";
export type PlanStatus = "trial" | "pending" | "active" | "overdue" | "cancelled";

export type PlanFeature =
  | "adicionar_processo"
  | "adicionar_cliente"
  | "ia_juridica"
  | "exportar_relatorio"
  | "financeiro"
  | "equipe"
  | "api_webhooks";

const FEATURE_MATRIX: Record<PlanFeature, PlanName[]> = {
  adicionar_processo: ["trial", "starter", "profissional", "escritorio"],
  adicionar_cliente: ["trial", "starter", "profissional", "escritorio"],
  ia_juridica: ["trial", "starter", "profissional", "escritorio"],
  exportar_relatorio: ["trial", "starter", "profissional", "escritorio"],
  financeiro: ["trial", "starter", "profissional", "escritorio"],
  equipe: ["profissional", "escritorio"],
  api_webhooks: ["escritorio"],
};

export function getTrialDaysLeft(trialEndsAt: string, now = Date.now()): number {
  return Math.ceil((new Date(trialEndsAt).getTime() - now) / 86400000);
}

export function canUseFeature(input: {
  feature: PlanFeature;
  plan: PlanName;
  status: PlanStatus;
  trialDaysLeft: number;
}): boolean {
  const { feature, plan, status, trialDaysLeft } = input;
  const expired = (status === "trial" || status === "pending") && trialDaysLeft <= 0;
  if (expired || status === "overdue" || status === "cancelled") return false;

  const effectivePlan: PlanName = status === "pending" ? "trial" : plan;
  return FEATURE_MATRIX[feature].includes(effectivePlan);
}
