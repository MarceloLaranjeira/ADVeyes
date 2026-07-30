export const BILLING_PLANS = {
  solo: {
    name: "Solo",
    price: 79,
    annualTotal: 790,
    users: 1,
    monitoredCases: 100,
    searchTerms: 1,
    aiCredits: 100,
    features: [
      "1 usuário",
      "Processos cadastrados ilimitados",
      "100 processos monitorados",
      "1 termo OAB ou nome",
      "100 créditos de IA/mês",
      "Agenda e Google Calendar",
      "Tarefas, prazos e publicações",
      "Portal básico do cliente",
    ],
  },
  profissional: {
    name: "Profissional",
    price: 279,
    annualTotal: 2790,
    users: 3,
    monitoredCases: 400,
    searchTerms: 3,
    aiCredits: 500,
    popular: true,
    features: [
      "3 usuários",
      "Processos cadastrados ilimitados",
      "400 processos monitorados",
      "3 termos OAB ou nome",
      "500 créditos de IA/mês",
      "Tudo do Solo",
      "CRM, financeiro e contratos",
      "Automações e relatórios",
      "Funções e permissões",
    ],
  },
  escritorio: {
    name: "Escritório",
    price: 619,
    annualTotal: 6190,
    users: 10,
    monitoredCases: 1000,
    searchTerms: 7,
    aiCredits: 2000,
    features: [
      "10 usuários",
      "Processos cadastrados ilimitados",
      "1.000 processos monitorados",
      "7 termos OAB ou nome",
      "2.000 créditos de IA/mês",
      "Tudo do Profissional",
      "Equipes e visibilidade avançada",
      "Auditoria e relatórios avançados",
      "Elegível ao white-label",
    ],
  },
  performance: {
    name: "Performance",
    price: 1099,
    annualTotal: 10990,
    users: 30,
    monitoredCases: 2500,
    searchTerms: 15,
    aiCredits: 6000,
    features: [
      "30 usuários",
      "Processos cadastrados ilimitados",
      "2.500 processos monitorados",
      "15 termos OAB ou nome",
      "6.000 créditos de IA/mês",
      "Tudo do Escritório",
      "API, webhooks e BI",
      "Onboarding assistido e SLA",
      "Elegível ao white-label",
    ],
  },
} as const;

export type BillingPlanKey = keyof typeof BILLING_PLANS;

export function isBillingPlanKey(value: string | null): value is BillingPlanKey {
  return value !== null && Object.prototype.hasOwnProperty.call(BILLING_PLANS, value);
}

export function getMonthlyEquivalent(annualTotal: number): number {
  return Math.round((annualTotal / 12) * 100) / 100;
}
