import { describe, expect, it } from "vitest";
import {
  canUseFeature,
  getTrialDaysLeft,
  type PlanFeature,
} from "@/lib/subscription-access";

describe("subscription access", () => {
  it("não libera recursos pagos enquanto o pagamento está pendente", () => {
    expect(canUseFeature({
      feature: "equipe",
      plan: "profissional",
      status: "pending",
      trialDaysLeft: 3,
    })).toBe(false);
  });

  it("mantém recursos de trial durante um pagamento pendente", () => {
    expect(canUseFeature({
      feature: "ia_juridica",
      plan: "profissional",
      status: "pending",
      trialDaysLeft: 3,
    })).toBe(true);
  });

  it("bloqueia todos os recursos controlados quando a assinatura está vencida", () => {
    expect(canUseFeature({
      feature: "ia_juridica",
      plan: "profissional",
      status: "overdue",
      trialDaysLeft: 10,
    })).toBe(false);
  });

  it("restringe webhooks aos planos Performance e Parceiro ativos", () => {
    expect(canUseFeature({
      feature: "api_webhooks",
      plan: "profissional",
      status: "active",
      trialDaysLeft: 0,
    })).toBe(false);
    expect(canUseFeature({
      feature: "api_webhooks",
      plan: "performance",
      status: "active",
      trialDaysLeft: 0,
    })).toBe(true);
    expect(canUseFeature({
      feature: "api_webhooks",
      plan: "parceiro",
      status: "active",
      trialDaysLeft: 0,
    })).toBe(true);
  });

  it("libera todos os recursos para o plano Parceiro ativo", () => {
    const features: PlanFeature[] = [
      "adicionar_processo",
      "adicionar_cliente",
      "ia_juridica",
      "exportar_relatorio",
      "financeiro",
      "equipe",
      "api_webhooks",
    ];

    for (const feature of features) {
      expect(canUseFeature({
        feature,
        plan: "parceiro",
        status: "active",
        trialDaysLeft: 0,
      })).toBe(true);
    }
  });

  it("calcula os dias restantes de trial arredondando para cima", () => {
    const now = Date.parse("2026-07-27T12:00:00Z");
    expect(getTrialDaysLeft("2026-07-29T00:00:00Z", now)).toBe(2);
  });
});
