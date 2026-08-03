// Trava de consumo dos provedores pagos.
// Toda chamada cobrada passa por aqui antes de sair, e o consumo é registrado
// só depois do sucesso — falha de rede não deve gastar cota do escritório.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type QuotaKind = "lookup" | "monitor";

export interface QuotaState {
  allowed: boolean;
  reason: "tenant_quota_exceeded" | "platform_quota_exceeded" | null;
  limit: number;
  used: number;
  platformLimit: number;
  platformUsed: number;
}

export class ProviderQuotaError extends Error {
  constructor(
    public readonly code: "tenant_quota_exceeded" | "platform_quota_exceeded",
    public readonly state: QuotaState,
  ) {
    super(code);
  }
}

interface RawQuotaState {
  allowed: boolean;
  reason: QuotaState["reason"];
  limit: number;
  used: number;
  platform_limit: number;
  platform_used: number;
}

export async function checkProviderQuota(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    provider: "escavador" | "datajud";
    kind: QuotaKind;
    quantity?: number;
  },
): Promise<QuotaState> {
  const { data, error } = await admin.rpc("provider_quota_check_server", {
    p_tenant_id: input.tenantId,
    p_provider: input.provider,
    p_kind: input.kind,
    p_quantity: input.quantity ?? 1,
  });

  if (error) {
    console.error("provider-quota: failed to evaluate quota");
    throw new Error("operation_failed");
  }

  const raw = data as RawQuotaState;
  return {
    allowed: raw.allowed,
    reason: raw.reason,
    limit: raw.limit,
    used: raw.used,
    platformLimit: raw.platform_limit,
    platformUsed: raw.platform_used,
  };
}

/** Recusa a operação quando a cota acabou, sem chamar o provedor. */
export async function assertProviderQuota(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    provider: "escavador" | "datajud";
    kind: QuotaKind;
    quantity?: number;
  },
): Promise<QuotaState> {
  const state = await checkProviderQuota(admin, input);
  if (!state.allowed && state.reason) {
    throw new ProviderQuotaError(state.reason, state);
  }
  return state;
}

/** Registra o consumo depois que o provedor respondeu com sucesso. */
export async function recordProviderUsage(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    provider: "escavador" | "datajud";
    operation:
      | "oab_discovery"
      | "process_lookup"
      | "monitor_created"
      | "monitor_check"
      | "public_document";
    quantity?: number;
    externalReference?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("legal_usage_events").insert({
    tenant_id: input.tenantId,
    provider: input.provider,
    operation: input.operation,
    quantity: input.quantity ?? 1,
    external_reference: input.externalReference ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    // O consumo já aconteceu no provedor; perder o registro subestimaria a
    // cota, então isso precisa aparecer no log para conferência.
    console.error("provider-quota: failed to record usage", input.operation);
  }
}
