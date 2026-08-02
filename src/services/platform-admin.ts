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

export interface PlatformSupportSession {
  id: string;
  reason: string;
  started_at: string;
  expires_at: string;
}

export interface PlatformSupportStatus {
  active: boolean;
  session: PlatformSupportSession | null;
}

export interface PlatformIntegrationStatus {
  providers: {
    djen: { configured: boolean; mode: "official" };
    datajud: { configured: boolean; mode: "official" };
    escavador: {
      configured: boolean;
      updatedAt: string | null;
      mode: "complementary";
    };
  };
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

  async integrationStatus() {
    return invokePlatformAdmin<PlatformIntegrationStatus>({
      action: "integration_status",
    });
  },

  async setEscavadorToken(token: string) {
    return invokePlatformAdmin<{ configured: boolean; updatedAt: string | null }>({
      action: "set_escavador_token",
      token,
    });
  },

  async supportStatus(tenantId: string) {
    return invokePlatformAdmin<PlatformSupportStatus>({
      action: "support_status",
      tenantId,
    });
  },

  async startSupport(tenantId: string, reason: string) {
    return invokePlatformAdmin<PlatformSupportStatus>({
      action: "start_support",
      tenantId,
      reason,
    });
  },

  async endSupport(tenantId: string) {
    return invokePlatformAdmin<PlatformSupportStatus>({
      action: "end_support",
      tenantId,
    });
  },
};
