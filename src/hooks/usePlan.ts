import { useSubscription, type PlanFeature } from "@/contexts/SubscriptionContext";

export function usePlan() {
  const { canUse, plan, status, isTrialExpired, trialDaysLeft, isActive } = useSubscription();
  return { canUse, plan, status, isTrialExpired, trialDaysLeft, isActive };
}
