// Asaas Payment Integration — via Supabase Edge Function proxy
// A chave de API fica no servidor (ASAAS_API_KEY em Supabase Secrets).
// Configure em: Supabase Dashboard → Edge Functions → Secrets → ASAAS_API_KEY

import { supabase } from "@/integrations/supabase/client";

async function call(path: string, method = "GET", body?: object) {
  const { data, error } = await supabase.functions.invoke("asaas", {
    body: { path, method, body },
  });
  if (error) throw new Error(error.message);
  if (data?.errors) throw new Error(JSON.stringify(data.errors));
  return data;
}

export const asaas = {
  /** Create a customer in Asaas */
  createCustomer(data: {
    name: string;
    cpfCnpj: string;
    email?: string;
    phone?: string;
  }) {
    return call("customers", "POST", data);
  },

  /** Create a recurring subscription */
  createSubscription(data: {
    customer: string;
    billingType: "CREDIT_CARD" | "PIX" | "BOLETO";
    value: number;
    nextDueDate: string;
    cycle: "MONTHLY" | "YEARLY";
    description: string;
    creditCard?: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
    };
    creditCardHolderInfo?: {
      name: string;
      email: string;
      cpfCnpj: string;
      postalCode: string;
      addressNumber: string;
      phone: string;
    };
  }) {
    return call("subscriptions", "POST", data);
  },

  /** Get subscription status */
  getSubscription(subscriptionId: string) {
    return call(`subscriptions/${subscriptionId}`);
  },

  /** Cancel subscription */
  cancelSubscription(subscriptionId: string) {
    return call(`subscriptions/${subscriptionId}`, "DELETE");
  },

  /** Create a one-time PIX payment */
  createPixPayment(data: {
    customer: string;
    value: number;
    dueDate: string;
    description: string;
  }) {
    return call("payments", "POST", { ...data, billingType: "PIX" });
  },

  /** Get PIX QR code for a payment */
  getPixQrCode(paymentId: string) {
    return call(`payments/${paymentId}/pixQrCode`);
  },
};

// Plan definitions
export const PLANS = {
  starter: {
    name: "Starter",
    price: 97,
    yearlyPrice: 77,
    features: ["1 advogado", "50 processos", "Agenda e Tarefas", "IA básica (50 consultas/mês)", "Suporte por e-mail"],
  },
  profissional: {
    name: "Profissional",
    price: 197,
    yearlyPrice: 157,
    popular: true,
    features: ["3 advogados", "Processos ilimitados", "Todas as ferramentas", "IA avançada ilimitada", "Diário Oficial automático", "Andamentos automáticos", "Suporte prioritário"],
  },
  escritorio: {
    name: "Escritório",
    price: 397,
    yearlyPrice: 317,
    features: ["Advogados ilimitados", "Tudo do Profissional", "API personalizada", "Webhooks", "Relatórios customizados", "Gerente de conta dedicado", "Onboarding personalizado"],
  },
} as const;
