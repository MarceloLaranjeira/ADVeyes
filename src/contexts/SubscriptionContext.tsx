// src/contexts/SubscriptionContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanName = "trial" | "starter" | "profissional" | "escritorio";
export type PlanStatus = "trial" | "active" | "overdue" | "cancelled";

export type PlanFeature =
  | "adicionar_processo"
  | "adicionar_cliente"
  | "ia_juridica"
  | "exportar_relatorio"
  | "financeiro"
  | "equipe"
  | "api_webhooks";

interface AsaasSubscription {
  id: string;
  user_id: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  plan: PlanName;
  status: PlanStatus;
  trial_ends_at: string;
  next_due_date: string | null;
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

const FEATURE_MATRIX: Record<PlanFeature, PlanName[]> = {
  adicionar_processo:  ["trial", "starter", "profissional", "escritorio"],
  adicionar_cliente:   ["trial", "starter", "profissional", "escritorio"],
  ia_juridica:         ["trial", "starter", "profissional", "escritorio"],
  exportar_relatorio:  ["trial", "starter", "profissional", "escritorio"],
  financeiro:          ["trial", "starter", "profissional", "escritorio"],
  equipe:              ["profissional", "escritorio"],
  api_webhooks:        ["escritorio"],
};

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
      .single();
    setSubscription(data ?? null);
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
  const trialDaysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000);
  const isTrialExpired = status === "trial" && trialDaysLeft <= 0;
  const isActive = status === "active";

  const canUse = useCallback((feature: PlanFeature): boolean => {
    if (isTrialExpired || status === "overdue" || status === "cancelled") {
      const blockedWhenExpired: PlanFeature[] = [
        "adicionar_processo", "adicionar_cliente", "ia_juridica",
        "exportar_relatorio", "financeiro", "equipe", "api_webhooks",
      ];
      return !blockedWhenExpired.includes(feature);
    }
    return FEATURE_MATRIX[feature]?.includes(plan) ?? false;
  }, [plan, status, isTrialExpired]);

  return (
    <SubscriptionContext.Provider value={{
      subscription, plan, status, isTrialExpired, trialDaysLeft,
      isActive, canUse, loading, refresh: load,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
