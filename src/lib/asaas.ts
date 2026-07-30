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

export interface CheckoutInput {
  plan: PlanKey;
  billingType: BillingType;
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
}

async function call(body: object): Promise<CheckoutResult> {
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
  return result as CheckoutResult;
}

export const asaas = {
  createCheckout(input: CheckoutInput) {
    return call({ action: "create_checkout", ...input });
  },

  cancelSubscription() {
    return call({ action: "cancel_subscription" });
  },
};

// Alias temporário para os consumidores existentes. O catálogo comercial
// aprovado vive em billing-plans.ts; o backend continua sendo a autoridade.
export const PLANS = BILLING_PLANS;
