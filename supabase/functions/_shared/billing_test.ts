import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizeSelection,
  priceCheckout,
  type BillingAddonRow,
  type BillingPlanRow,
} from "./billing.ts";

const plan: BillingPlanRow = {
  id: "plan",
  code: "escritorio",
  version: 1,
  name: "Escritório",
  rank: 3,
  monthly_price_cents: 61900,
  annual_price_cents: 619000,
  activation_fee_cents: 61900,
  entitlements: {},
  features: [],
};

const addons: BillingAddonRow[] = [
  ["extra_user", 4900, "recurring", 1, null],
  ["extra_monitoring_100", 4900, "recurring", 1, null],
  ["extra_search_term", 3900, "recurring", 1, null],
  ["ai_credits_500", 3900, "prepaid", 1, 90],
  ["white_label_monthly", 34900, "recurring", 3, null],
  ["white_label_implementation", 249000, "implementation", 3, null],
].map(([code, price, model, minRank, validity]) => ({
  id: String(code),
  code: code as BillingAddonRow["code"],
  version: 1,
  name: String(code),
  price_cents: Number(price),
  billing_model: model as BillingAddonRow["billing_model"],
  min_plan_rank: Number(minRank),
  validity_days: validity === null ? null : Number(validity),
}));

Deno.test("mensal inclui primeira recorrência, ativação e implantação", () => {
  const result = priceCheckout({
    plan,
    addons,
    cycle: "monthly",
    selection: {
      extraUsers: 1,
      extraMonitoringPacks: 0,
      extraSearchTerms: 0,
      aiCreditPacks: 1,
      whiteLabel: true,
    },
  });

  assertEquals(result.recurringTotalCents, 101700);
  assertEquals(result.activationFeeCents, 61900);
  assertEquals(result.implementationFeeCents, 249000);
  assertEquals(result.prepaidTotalCents, 3900);
  assertEquals(result.initialTotalCents, 416500);
});

Deno.test("anual concede dois meses no plano e não cobra ativação", () => {
  const result = priceCheckout({
    plan,
    addons,
    cycle: "annual",
    selection: {
      extraUsers: 0,
      extraMonitoringPacks: 0,
      extraSearchTerms: 0,
      aiCreditPacks: 0,
      whiteLabel: false,
    },
  });

  assertEquals(result.recurringTotalCents, 619000);
  assertEquals(result.initialTotalCents, 619000);
  assertEquals(result.activationFeeCents, 0);
});

Deno.test("white-label é recusado abaixo do plano Escritório", () => {
  assertThrows(
    () =>
      priceCheckout({
        plan: { ...plan, code: "profissional", rank: 2 },
        addons,
        cycle: "monthly",
        selection: {
          extraUsers: 0,
          extraMonitoringPacks: 0,
          extraSearchTerms: 0,
          aiCreditPacks: 0,
          whiteLabel: true,
        },
      }),
    Error,
    "addon_not_allowed",
  );
});

Deno.test("quantidades fracionárias ou excessivas são recusadas", () => {
  assertThrows(
    () => normalizeSelection({ extraUsers: 1.5 }),
    Error,
    "invalid_addon_quantity",
  );
  assertThrows(
    () => normalizeSelection({ aiCreditPacks: 101 }),
    Error,
    "invalid_addon_quantity",
  );
});
