// src/contexts/SubscriptionContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  canUseFeature,
  getTrialDaysLeft,
  type PlanFeature,
  type PlanName,
  type PlanStatus,
} from "@/lib/subscription-access";

export type { PlanFeature, PlanName, PlanStatus } from "@/lib/subscription-access";

interface AsaasSubscription extends Omit<Tables<"asaas_subscriptions">, "plan" | "status"> {
  plan: PlanName;
  status: PlanStatus;
}

interface SubscriptionContextValue {
  subscription: AsaasSubscription | null;
  plan: PlanName;
  status: PlanStatus;
  isTrialExpired: boolean;
  trialDaysLeft: number;
  isActive: boolean;
  canUse: (feature: PlanFeature) => boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  plan: "trial",
  status: "trial",
  isTrialExpired: false,
  trialDaysLeft: 7,
  isActive: false,
  canUse: () => true,
  loading: true,
  refresh: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<AsaasSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setSubscription(null); setLoading(false); return; }
    const { data } = await supabase
      .from("asaas_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setSubscription((data as AsaasSubscription | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Realtime: atualiza contexto quando webhook mudar status no banco
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("subscription-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "asaas_subscriptions", filter: `user_id=eq.${user.id}` },
        (payload) => setSubscription(payload.new as AsaasSubscription)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const plan: PlanName = subscription?.plan ?? "trial";
  const status: PlanStatus = subscription?.status ?? "trial";
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : new Date(Date.now() + 7 * 86400000);
  const trialDaysLeft = getTrialDaysLeft(trialEndsAt.toISOString());
  const isTrialExpired = (status === "trial" || status === "pending") && trialDaysLeft <= 0;
  const isActive = status === "active";

  const canUse = useCallback((feature: PlanFeature): boolean => {
    return canUseFeature({ feature, plan, status, trialDaysLeft });
  }, [plan, status, trialDaysLeft]);

  return (
    <SubscriptionContext.Provider value={{
      subscription, plan, status, isTrialExpired, trialDaysLeft,
      isActive, canUse, loading, refresh: load,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
