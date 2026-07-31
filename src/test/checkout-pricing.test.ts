import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BILLING_PLANS } from "@/lib/billing-plans";

describe("catálogo comercial aprovado", () => {
  it("expõe os quatro planos e valores mensais aprovados", () => {
    expect(Object.keys(BILLING_PLANS)).toEqual([
      "solo",
      "profissional",
      "escritorio",
      "performance",
    ]);
    expect(BILLING_PLANS.solo.price).toBe(79);
    expect(BILLING_PLANS.profissional.price).toBe(279);
    expect(BILLING_PLANS.escritorio.price).toBe(619);
    expect(BILLING_PLANS.performance.price).toBe(1099);
  });

  it("mantém os totais anuais de dez mensalidades", () => {
    for (const plan of Object.values(BILLING_PLANS)) {
      expect(plan.annualTotal).toBe(plan.price * 10);
    }
  });

  it("mantém o catálogo do banco alinhado ao catálogo exibido", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260730051538_billing_catalog_and_tenant_subscriptions.sql",
      ),
      "utf8",
    );

    for (const [key, plan] of Object.entries(BILLING_PLANS)) {
      expect(migration).toContain(`'${key}', 1, '${plan.name}'`);
      expect(migration).toContain(`${plan.price * 100}, ${plan.annualTotal * 100}`);
    }
  });
});
