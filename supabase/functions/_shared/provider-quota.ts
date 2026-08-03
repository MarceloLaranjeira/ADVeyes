// Trava de custo dos provedores pagos.
// Limitar por contagem não protege — 100 monitoramentos custam R$ 8 ou R$ 176
// conforme a frequência. Aqui a autorização é pelo custo estimado em centavos,
// e o consumo só é registrado depois que o provedor respondeu.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ProviderName = "escavador" | "datajud";

/** Serviços com preço cadastrado; o banco recusa qualquer outro. */
export type ServiceCode =
  | "oab_processes"
  | "involved_processes"
  | "lawyer_summary"
  | "involved_summary"
  | "process_cover"
  | "process_parties"
  | "process_movements"
  | "process_ai_summary"
  | "court_update"
  | "court_update_public_docs"
  | "monitor_daily"
  | "monitor_weekly"
  | "monitor_monthly"
  | "monitor_daily_docs"
  | "monitor_weekly_docs"
  | "monitor_monthly_docs"
  | "monitor_new_processes";

export interface BudgetState {
  allowed: boolean;
  reason: "tenant_budget_exceeded" | "platform_budget_exceeded" | null;
  estimatedCents: number;
  budgetCents: number;
  spentCents: number;
  platformBudgetCents: number;
  platformSpentCents: number;
}

export class ProviderBudgetError extends Error {
  constructor(
    public readonly code:
      | "tenant_budget_exceeded"
      | "platform_budget_exceeded",
    public readonly state: BudgetState,
  ) {
    super(code);
  }
}

interface RawBudgetState {
  allowed: boolean;
  reason: BudgetState["reason"];
  estimated_cents: number;
  budget_cents: number;
  spent_cents: number;
  platform_budget_cents: number;
  platform_spent_cents: number;
}

export interface BudgetInput {
  tenantId: string;
  provider: ProviderName;
  service: ServiceCode;
  quantity?: number;
  /** Itens esperados, para serviços que cobram adicional por faixa. */
  itemCount?: number | null;
}

export async function checkProviderBudget(
  admin: SupabaseClient,
  input: BudgetInput,
): Promise<BudgetState> {
  const { data, error } = await admin.rpc("provider_budget_check_server", {
    p_tenant_id: input.tenantId,
    p_provider: input.provider,
    p_service_code: input.service,
    p_quantity: input.quantity ?? 1,
    p_item_count: input.itemCount ?? null,
  });

  if (error) {
    console.error("provider-quota: failed to evaluate budget");
    throw new Error("operation_failed");
  }

  const raw = data as RawBudgetState;
  return {
    allowed: raw.allowed,
    reason: raw.reason,
    estimatedCents: raw.estimated_cents,
    budgetCents: raw.budget_cents,
    spentCents: raw.spent_cents,
    platformBudgetCents: raw.platform_budget_cents,
    platformSpentCents: raw.platform_spent_cents,
  };
}

/** Recusa antes de chamar o provedor quando o orçamento não comporta. */
export async function assertProviderBudget(
  admin: SupabaseClient,
  input: BudgetInput,
): Promise<BudgetState> {
  const state = await checkProviderBudget(admin, input);
  if (!state.allowed && state.reason) {
    throw new ProviderBudgetError(state.reason, state);
  }
  return state;
}

export type UsageOperation =
  | "oab_discovery"
  | "process_lookup"
  | "monitor_created"
  | "monitor_check"
  | "public_document";

/**
 * Registra o consumo com o custo real. O custo é recalculado com a contagem
 * de itens efetivamente retornada, que só se conhece após a resposta.
 */
export async function recordProviderUsage(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    provider: ProviderName;
    operation: UsageOperation;
    service: ServiceCode;
    quantity?: number;
    itemCount?: number | null;
    externalReference?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<number> {
  const state = await checkProviderBudget(admin, {
    tenantId: input.tenantId,
    provider: input.provider,
    service: input.service,
    quantity: input.quantity,
    itemCount: input.itemCount,
  });

  const { error } = await admin.from("legal_usage_events").insert({
    tenant_id: input.tenantId,
    provider: input.provider,
    operation: input.operation,
    service_code: input.service,
    quantity: input.quantity ?? 1,
    cost_cents: state.estimatedCents,
    external_reference: input.externalReference ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    // O provedor já cobrou; perder o registro subestimaria o gasto do mês.
    console.error("provider-quota: failed to record usage", input.operation);
  }

  return state.estimatedCents;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
