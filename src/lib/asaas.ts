// Asaas Payment Integration — Cobrança Recorrente
// Docs: https://docs.asaas.com/
// Set VITE_ASAAS_API_KEY in .env

const BASE_URL = "https://api.asaas.com/v3";
const API_KEY = import.meta.env.VITE_ASAAS_API_KEY || "";

const headers = {
  "Content-Type": "application/json",
  "access_token": API_KEY,
};

export const asaas = {
  /** Create a customer in Asaas */
  async createCustomer(data: {
    name: string;
    cpfCnpj: string;
    email?: string;
    phone?: string;
  }) {
    const res = await fetch(`${BASE_URL}/customers`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Asaas createCustomer: ${res.status}`);
    return res.json();
  },

  /** Create a recurring subscription */
  async createSubscription(data: {
    customer: string;          // Asaas customer ID
    billingType: "CREDIT_CARD" | "PIX" | "BOLETO";
    value: number;
    nextDueDate: string;       // "YYYY-MM-DD"
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
    const res = await fetch(`${BASE_URL}/subscriptions`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Asaas createSubscription: ${res.status}`);
    return res.json();
  },

  /** Get subscription status */
  async getSubscription(subscriptionId: string) {
    const res = await fetch(`${BASE_URL}/subscriptions/${subscriptionId}`, { headers });
    if (!res.ok) return null;
    return res.json();
  },

  /** Cancel subscription */
  async cancelSubscription(subscriptionId: string) {
    const res = await fetch(`${BASE_URL}/subscriptions/${subscriptionId}`, {
      method: "DELETE",
      headers,
    });
    return res.status === 200;
  },

  /** Create a one-time Pix payment */
  async createPixPayment(data: {
    customer: string;
    value: number;
    dueDate: string;
    description: string;
  }) {
    const res = await fetch(`${BASE_URL}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...data, billingType: "PIX" }),
    });
    if (!res.ok) throw new Error(`Asaas createPixPayment: ${res.status}`);
    return res.json();
  },

  /** Get Pix QR code for a payment */
  async getPixQrCode(paymentId: string) {
    const res = await fetch(`${BASE_URL}/payments/${paymentId}/pixQrCode`, { headers });
    if (!res.ok) return null;
    return res.json();
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
