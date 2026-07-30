export type BillingCycle = "monthly" | "annual";

export interface BillingPlanRow {
  id: string;
  code: string;
  version: number;
  name: string;
  rank: number;
  monthly_price_cents: number;
  annual_price_cents: number;
  activation_fee_cents: number;
  entitlements: Record<string, number | boolean>;
  features: string[];
}

export type BillingAddonCode =
  | "extra_user"
  | "extra_monitoring_100"
  | "extra_search_term"
  | "ai_credits_500"
  | "white_label_monthly"
  | "white_label_implementation";

export interface BillingAddonRow {
  id: string;
  code: BillingAddonCode;
  version: number;
  name: string;
  price_cents: number;
  billing_model: "recurring" | "prepaid" | "implementation";
  min_plan_rank: number;
  validity_days: number | null;
}

export interface CheckoutSelection {
  extraUsers: number;
  extraMonitoringPacks: number;
  extraSearchTerms: number;
  aiCreditPacks: number;
  whiteLabel: boolean;
}

export interface PricedCheckout {
  recurringTotalCents: number;
  initialTotalCents: number;
  activationFeeCents: number;
  implementationFeeCents: number;
  prepaidTotalCents: number;
  recurringAddonsMonthlyCents: number;
  items: Array<{
    addonId: string;
    code: BillingAddonCode;
    quantity: number;
    unitPriceCents: number;
    billingModel: BillingAddonRow["billing_model"];
    validityDays: number | null;
  }>;
}

const MAX_QUANTITY = 100;

function validQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_QUANTITY;
}

export function normalizeSelection(
  value: Partial<CheckoutSelection> | null | undefined,
): CheckoutSelection {
  const normalized: CheckoutSelection = {
    extraUsers: Number(value?.extraUsers ?? 0),
    extraMonitoringPacks: Number(value?.extraMonitoringPacks ?? 0),
    extraSearchTerms: Number(value?.extraSearchTerms ?? 0),
    aiCreditPacks: Number(value?.aiCreditPacks ?? 0),
    whiteLabel: value?.whiteLabel === true,
  };

  for (const quantity of [
    normalized.extraUsers,
    normalized.extraMonitoringPacks,
    normalized.extraSearchTerms,
    normalized.aiCreditPacks,
  ]) {
    if (!validQuantity(quantity)) {
      throw new Error("invalid_addon_quantity");
    }
  }

  return normalized;
}

export function priceCheckout(input: {
  plan: BillingPlanRow;
  addons: BillingAddonRow[];
  cycle: BillingCycle;
  selection: CheckoutSelection;
}): PricedCheckout {
  const { plan, addons, cycle, selection } = input;
  const byCode = new Map(addons.map((addon) => [addon.code, addon]));
  const quantities = new Map<BillingAddonCode, number>([
    ["extra_user", selection.extraUsers],
    ["extra_monitoring_100", selection.extraMonitoringPacks],
    ["extra_search_term", selection.extraSearchTerms],
    ["ai_credits_500", selection.aiCreditPacks],
    ["white_label_monthly", selection.whiteLabel ? 1 : 0],
    ["white_label_implementation", selection.whiteLabel ? 1 : 0],
  ]);

  const items: PricedCheckout["items"] = [];
  let recurringAddonsMonthlyCents = 0;
  let prepaidTotalCents = 0;
  let implementationFeeCents = 0;

  for (const [code, quantity] of quantities) {
    if (quantity === 0) continue;
    const addon = byCode.get(code);
    if (!addon) throw new Error(`missing_addon:${code}`);
    if (plan.rank < addon.min_plan_rank) {
      throw new Error(`addon_not_allowed:${code}`);
    }

    items.push({
      addonId: addon.id,
      code,
      quantity,
      unitPriceCents: addon.price_cents,
      billingModel: addon.billing_model,
      validityDays: addon.validity_days,
    });

    const lineTotal = addon.price_cents * quantity;
    if (addon.billing_model === "recurring") {
      recurringAddonsMonthlyCents += lineTotal;
    } else if (addon.billing_model === "prepaid") {
      prepaidTotalCents += lineTotal;
    } else {
      implementationFeeCents += lineTotal;
    }
  }

  const activationFeeCents =
    cycle === "monthly" ? plan.activation_fee_cents : 0;
  const recurringTotalCents =
    cycle === "monthly"
      ? plan.monthly_price_cents + recurringAddonsMonthlyCents
      : plan.annual_price_cents + recurringAddonsMonthlyCents * 12;

  return {
    recurringTotalCents,
    initialTotalCents:
      recurringTotalCents +
      activationFeeCents +
      implementationFeeCents +
      prepaidTotalCents,
    activationFeeCents,
    implementationFeeCents,
    prepaidTotalCents,
    recurringAddonsMonthlyCents,
    items,
  };
}

export function centsToReais(cents: number): number {
  return Number((cents / 100).toFixed(2));
}
