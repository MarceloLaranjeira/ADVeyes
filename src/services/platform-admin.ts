import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";

export interface PlatformTenantSummary {
  id: string;
  displayName: string;
  legalName: string;
  slug: string;
  status: string;
  trialEndsAt: string | null;
  createdAt: string;
  activeMembers: number;
  candidateProcesses: number;
  monitoredProcesses: number;
  integrationFailures: number;
  subscription: {
    planCode: string | null;
    status: string;
    nextDueDate: string | null;
    trialEndsAt: string | null;
  } | null;
}

export interface PlatformOverview {
  totals: {
    tenants: number;
    activeTenants: number;
    activeMembers: number;
    monitoredProcesses: number;
    integrationFailures: number;
  };
  tenants: PlatformTenantSummary[];
}

async function invokePlatformAdmin<T>(body: Record<string, unknown>) {
  const { data, error } = await withTimeout(
    supabase.functions.invoke("platform-admin", { body }),
  );
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("Resposta inválida da conta geral.");
  }
  if ("error" in data) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export const platformAdmin = {
  async session() {
    return invokePlatformAdmin<{ isPlatformAdmin: boolean }>({
      action: "session",
    });
  },

  async overview() {
    return invokePlatformAdmin<PlatformOverview>({ action: "overview" });
  },
};
