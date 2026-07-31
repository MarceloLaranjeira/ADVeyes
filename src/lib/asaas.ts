// Asaas Payment Integration — via Supabase Edge Function proxy
// A chave de API fica no servidor (ASAAS_API_KEY em Supabase Secrets).
// Configure em: Supabase Dashboard → Edge Functions → Secrets → ASAAS_API_KEY

import { supabase } from "@/integrations/supabase/client";
import {
  BILLING_PLANS,
  type BillingPlanKey,
} from "@/lib/billing-plans";

export type PlanKey = BillingPlanKey;
export type BillingType = "CREDIT_CARD" | "PIX" | "BOLETO";
export type BillingCycle = "monthly" | "annual";

export interface CheckoutSelection {
  extraUsers: number;
  extraMonitoringPacks: number;
  extraSearchTerms: number;
  aiCreditPacks: number;
  whiteLabel: boolean;
}

export interface CheckoutInput {
  tenantId: string;
  plan: PlanKey;
  billingCycle: BillingCycle;
  billingType: BillingType;
  idempotencyKey: string;
  selection: CheckoutSelection;
  installmentCount?: number;
  customer: {
    name: string;
    cpfCnpj: string;
    email: string;
    phone?: string;
  };
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
}

export interface CheckoutResult {
  ok: true;
  subscription?: { id?: string };
  payment?: {
    id?: string;
    bankSlipUrl?: string;
    invoiceUrl?: string;
  } | null;
  pix?: {
    payload?: string;
    encodedImage?: string;
  } | null;
  pricing?: {
    recurringTotalCents: number;
    initialTotalCents: number;
    activationFeeCents: number;
    implementationFeeCents: number;
    prepaidTotalCents: number;
    recurringAddonsMonthlyCents: number;
  };
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  status: "trialing" | "pending" | "active" | "past_due" | "canceled";
  billing_cycle: BillingCycle | null;
  trial_ends_at: string | null;
  next_due_date: string | null;
  billing_plans: {
    code: PlanKey;
    name: string;
    version: number;
    entitlements: Record<string, number | boolean>;
    features: string[];
  } | null;
}

export interface CatalogResult {
  ok: true;
  plans: Array<Record<string, unknown>>;
  addons: Array<Record<string, unknown>>;
  canManage: boolean;
}

export interface SubscriptionResult {
  ok: true;
  subscription: TenantSubscription | null;
  canManage: boolean;
}

async function call<T>(body: object): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke("asaas", {
    body,
  });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      try {
        const payload = await error.context.clone().json() as { error?: string };
        message = payload.error || message;
      } catch {
        // Mantém a mensagem padrão quando a resposta não é JSON.
      }
    }
    throw new Error(message);
  }
  if (!result?.ok) {
    const detail =
      result?.details?.errors?.[0]?.description ||
      result?.details?.message ||
      result?.error ||
      "Falha ao processar cobrança";
    throw new Error(detail);
  }
  return result as T;
}

export const asaas = {
  createCheckout(input: CheckoutInput) {
    return call<CheckoutResult>({ action: "create_checkout", ...input });
  },

  getCatalog(tenantId: string) {
    return call<CatalogResult>({ action: "get_catalog", tenantId });
  },

  getSubscription(tenantId: string) {
    return call<SubscriptionResult>({ action: "get_subscription", tenantId });
  },

  cancelSubscription(tenantId: string) {
    return call<{ ok: true }>({ action: "cancel_subscription", tenantId });
  },
};

// Alias temporário para os consumidores existentes. O catálogo comercial
// aprovado vive em billing-plans.ts; o backend continua sendo a autoridade.
export const PLANS = BILLING_PLANS;
