import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { asaas, type TenantSubscription } from "@/lib/asaas";
import {
  canUseFeature,
  getTrialDaysLeft,
  type PlanFeature,
  type PlanName,
  type PlanStatus,
} from "@/lib/subscription-access";

export type { PlanFeature, PlanName, PlanStatus } from "@/lib/subscription-access";

interface SubscriptionContextValue {
  subscription: TenantSubscription | null;
  plan: PlanName;
  status: PlanStatus;
  isTrialExpired: boolean;
  trialDaysLeft: number;
  isActive: boolean;
  canManage: boolean;
  canUse: (feature: PlanFeature) => boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  plan: "trial",
  status: "trial",
  isTrialExpired: false,
  trialDaysLeft: 14,
  isActive: false,
  canManage: false,
  canUse: () => true,
  loading: true,
  refresh: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

function mapStatus(
  status: TenantSubscription["status"] | undefined,
): PlanStatus {
  if (status === "trialing") return "trial";
  if (status === "past_due") return "overdue";
  if (status === "canceled") return "cancelled";
  return status ?? "trial";
}

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [subscription, setSubscription] =
    useState<TenantSubscription | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !currentTenant) {
      setSubscription(null);
      setCanManage(false);
      setLoading(tenantLoading);
      return;
    }

    setLoading(true);
    try {
      const result = await asaas.getSubscription(currentTenant.tenantId);
      setSubscription(result.subscription);
      setCanManage(result.canManage);
    } catch {
      setSubscription(null);
      setCanManage(["owner", "admin"].includes(currentTenant.role));
    } finally {
      setLoading(false);
    }
  }, [currentTenant, tenantLoading, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!currentTenant) return;
    const channel = supabase
      .channel(`tenant-subscription-${currentTenant.tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tenant_subscriptions",
          filter: `tenant_id=eq.${currentTenant.tenantId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentTenant, load]);

  const planCode = subscription?.billing_plans?.code;
  const plan: PlanName = planCode ?? "trial";
  const status = mapStatus(subscription?.status);
  const trialEndsAt = subscription?.trial_ends_at ??
    new Date(Date.now() + 14 * 86400000).toISOString();
  const trialDaysLeft = getTrialDaysLeft(trialEndsAt);
  const isTrialExpired =
    (status === "trial" || status === "pending") && trialDaysLeft <= 0;
  const isActive = status === "active";

  const canUse = useCallback(
    (feature: PlanFeature): boolean =>
      canUseFeature({ feature, plan, status, trialDaysLeft }),
    [plan, status, trialDaysLeft],
  );

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plan,
        status,
        isTrialExpired,
        trialDaysLeft,
        isActive,
        canManage,
        canUse,
        loading,
        refresh: load,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
