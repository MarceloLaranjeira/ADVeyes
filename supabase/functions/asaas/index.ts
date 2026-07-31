import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  centsToReais,
  normalizeSelection,
  priceCheckout,
  type BillingAddonRow,
  type BillingCycle,
  type BillingPlanRow,
  type CheckoutSelection,
} from "../_shared/billing.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_BASE_URL =
  Deno.env.get("ASAAS_BASE_URL") || "https://api.asaas.com/v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BillingType = "CREDIT_CARD" | "PIX" | "BOLETO";

interface CustomerInput {
  name: string;
  cpfCnpj: string;
  email: string;
  phone?: string;
}

interface CreditCardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

interface CreateCheckoutRequest {
  action: "create_checkout";
  tenantId: string;
  plan: string;
  billingCycle: BillingCycle;
  billingType: BillingType;
  idempotencyKey: string;
  selection?: Partial<CheckoutSelection>;
  installmentCount?: number;
  customer: CustomerInput;
  creditCard?: CreditCardInput;
}

interface CatalogRequest {
  action: "get_catalog";
  tenantId: string;
}

interface SummaryRequest {
  action: "get_subscription";
  tenantId: string;
}

interface CancelRequest {
  action: "cancel_subscription";
  tenantId: string;
}

type RequestBody =
  | CreateCheckoutRequest
  | CatalogRequest
  | SummaryRequest
  | CancelRequest;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function asaasRequest(
  path: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(`${ASAAS_BASE_URL}/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      "User-Agent": "ADVeyes/2.0",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text || "Resposta inválida do Asaas" };
  }

  if (!response.ok) {
    console.error(`[asaas] ${method} ${path} failed with ${response.status}`);
    return { ok: false as const, status: response.status, data };
  }

  return { ok: true as const, status: response.status, data };
}

function addMonths(date: Date, months: number): string {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString().slice(0, 10);
}

function validateUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function cardPayload(body: CreateCheckoutRequest) {
  if (body.billingType !== "CREDIT_CARD" || !body.creditCard) return {};
  return {
    creditCard: {
      holderName: body.creditCard.holderName,
      number: body.creditCard.number.replace(/\s/g, ""),
      expiryMonth: body.creditCard.expiryMonth,
      expiryYear: body.creditCard.expiryYear,
      ccv: body.creditCard.ccv,
    },
    creditCardHolderInfo: {
      name: body.customer.name,
      email: body.customer.email,
      cpfCnpj: body.customer.cpfCnpj.replace(/\D/g, ""),
      postalCode: body.creditCard.postalCode.replace(/\D/g, ""),
      addressNumber: body.creditCard.addressNumber,
      phone: body.creditCard.phone.replace(/\D/g, ""),
    },
  };
}

function validateCheckout(body: CreateCheckoutRequest): string | null {
  if (!validateUuid(body.tenantId) || !validateUuid(body.idempotencyKey)) {
    return "Identificador de contratação inválido";
  }
  if (!["monthly", "annual"].includes(body.billingCycle)) {
    return "Ciclo de cobrança inválido";
  }
  if (!["CREDIT_CARD", "PIX", "BOLETO"].includes(body.billingType)) {
    return "Forma de pagamento inválida";
  }
  if (!body.customer?.name || !body.customer?.cpfCnpj || !body.customer?.email) {
    return "Dados do cliente incompletos";
  }
  if (body.billingType === "CREDIT_CARD") {
    const card = body.creditCard;
    if (
      !card?.holderName ||
      !card.number ||
      !card.expiryMonth ||
      !card.expiryYear ||
      !card.ccv ||
      !card.postalCode ||
      !card.addressNumber ||
      !card.phone
    ) {
      return "Dados do cartão incompletos";
    }
  }
  const installments = Number(body.installmentCount ?? 1);
  if (
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > 12 ||
    (body.billingCycle === "monthly" && installments !== 1) ||
    (body.billingType !== "CREDIT_CARD" && installments !== 1)
  ) {
    return "Parcelamento inválido";
  }
  return null;
}

async function paymentAssets(payment: Record<string, unknown> | null) {
  if (!payment) return { payment: null, pix: null };
  if (payment.billingType === "PIX" && typeof payment.id === "string") {
    const qrCode = await asaasRequest(`payments/${payment.id}/pixQrCode`);
    return {
      payment,
      pix: qrCode.ok ? qrCode.data : null,
    };
  }
  return { payment, pix: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.slice("Bearer ".length);
    const { data: { user }, error: authError } =
      await userClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json() as RequestBody;

    if (!body.tenantId || !validateUuid(body.tenantId)) {
      return json({ error: "Escritório inválido" }, 400);
    }

    const { data: membership, error: membershipError } = await admin
      .from("tenant_memberships")
      .select("role, status")
      .eq("tenant_id", body.tenantId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || membership.status !== "active") {
      return json({ error: "Acesso ao escritório negado" }, 403);
    }

    const canManage = ["owner", "admin"].includes(membership.role);

    if (body.action === "get_catalog") {
      const [{ data: plans, error: plansError }, {
        data: addons,
        error: addonsError,
      }] = await Promise.all([
        admin
          .from("billing_plans")
          .select("*")
          .eq("is_active", true)
          .is("retired_at", null)
          .order("rank"),
        admin
          .from("billing_addons")
          .select("*")
          .eq("is_active", true)
          .is("retired_at", null)
          .order("price_cents"),
      ]);
      if (plansError || addonsError) throw plansError ?? addonsError;
      return json({ ok: true, plans, addons, canManage });
    }

    const { data: currentSubscription, error: subscriptionError } = await admin
      .from("tenant_subscriptions")
      .select("*, billing_plans(code, name, version, entitlements, features)")
      .eq("tenant_id", body.tenantId)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    if (body.action === "get_subscription") {
      return json({
        ok: true,
        subscription: currentSubscription,
        canManage,
      });
    }

    if (!canManage) {
      return json({
        error: "Somente proprietário ou administrador pode alterar a assinatura",
      }, 403);
    }

    if (body.action === "cancel_subscription") {
      if (!currentSubscription?.asaas_subscription_id) {
        return json({ error: "Assinatura recorrente não encontrada" }, 404);
      }
      if (!ASAAS_API_KEY) {
        return json({ error: "ASAAS_API_KEY não configurada" }, 503);
      }
      const cancellation = await asaasRequest(
        `subscriptions/${currentSubscription.asaas_subscription_id}`,
        "DELETE",
      );
      if (!cancellation.ok) {
        return json({
          error: "Falha ao cancelar assinatura",
          details: cancellation.data,
        }, 502);
      }
      await admin
        .from("tenant_subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("tenant_id", body.tenantId);
      return json({ ok: true });
    }

    if (body.action !== "create_checkout") {
      return json({ error: "Ação inválida" }, 400);
    }
    if (!ASAAS_API_KEY) {
      return json({ error: "ASAAS_API_KEY não configurada" }, 503);
    }

    const validationError = validateCheckout(body);
    if (validationError) return json({ error: validationError }, 400);

    if (
      currentSubscription?.asaas_subscription_id &&
      ["pending", "active", "past_due"].includes(currentSubscription.status)
    ) {
      return json({
        error:
          "Este escritório já possui uma assinatura recorrente. Cancele ou altere a assinatura atual antes de contratar outra.",
      }, 409);
    }

    let selection: CheckoutSelection;
    try {
      selection = normalizeSelection(body.selection);
    } catch {
      return json({ error: "Quantidade de adicional inválida" }, 400);
    }

    const [{ data: plan, error: planError }, {
      data: addons,
      error: addonsError,
    }] = await Promise.all([
      admin
        .from("billing_plans")
        .select("*")
        .eq("code", body.plan)
        .eq("is_active", true)
        .is("retired_at", null)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("billing_addons")
        .select("*")
        .eq("is_active", true)
        .is("retired_at", null),
    ]);
    if (planError || addonsError) throw planError ?? addonsError;
    if (!plan) return json({ error: "Plano inválido" }, 400);

    let priced;
    try {
      priced = priceCheckout({
        plan: plan as BillingPlanRow,
        addons: (addons ?? []) as BillingAddonRow[],
        cycle: body.billingCycle,
        selection,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "invalid_selection";
      return json({
        error: code.startsWith("addon_not_allowed")
          ? "Este adicional não está disponível para o plano selecionado"
          : "Não foi possível calcular a contratação",
      }, 400);
    }

    const { data: existingOrder, error: existingOrderError } = await admin
      .from("billing_checkout_orders")
      .select("*")
      .eq("idempotency_key", body.idempotencyKey)
      .maybeSingle();
    if (existingOrderError) throw existingOrderError;
    if (existingOrder) {
      if (existingOrder.requested_by !== user.id ||
        existingOrder.tenant_id !== body.tenantId) {
        return json({ error: "Chave de contratação inválida" }, 409);
      }
      if (existingOrder.asaas_initial_payment_id) {
        const recovered = await asaasRequest(
          `payments/${existingOrder.asaas_initial_payment_id}`,
        );
        if (!recovered.ok) {
          return json({ error: "Não foi possível recuperar a cobrança" }, 502);
        }
        const assets = await paymentAssets(
          recovered.data as Record<string, unknown>,
        );
        return json({
          ok: true,
          reused: true,
          orderId: existingOrder.id,
          pricing: existingOrder.pricing_snapshot,
          ...assets,
        });
      }
      return json({
        error: "Esta contratação ainda está sendo processada",
      }, 409);
    }

    const pricingSnapshot = {
      currency: "BRL",
      catalog: { planCode: plan.code, planVersion: plan.version },
      planName: plan.name,
      billingCycle: body.billingCycle,
      recurringTotalCents: priced.recurringTotalCents,
      initialTotalCents: priced.initialTotalCents,
      activationFeeCents: priced.activationFeeCents,
      implementationFeeCents: priced.implementationFeeCents,
      prepaidTotalCents: priced.prepaidTotalCents,
      recurringAddonsMonthlyCents: priced.recurringAddonsMonthlyCents,
      items: priced.items,
    };

    const { data: order, error: orderError } = await admin
      .from("billing_checkout_orders")
      .insert({
        tenant_id: body.tenantId,
        requested_by: user.id,
        plan_id: plan.id,
        billing_cycle: body.billingCycle,
        idempotency_key: body.idempotencyKey,
        selection,
        pricing_snapshot: pricingSnapshot,
        recurring_total_cents: priced.recurringTotalCents,
        initial_total_cents: priced.initialTotalCents,
      })
      .select("id")
      .single();
    if (orderError) throw orderError;

    let customerId = currentSubscription?.asaas_customer_id as
      | string
      | undefined;
    if (!customerId) {
      const customerResult = await asaasRequest("customers", "POST", {
        name: body.customer.name.trim(),
        cpfCnpj: body.customer.cpfCnpj.replace(/\D/g, ""),
        email: body.customer.email.trim(),
        phone: body.customer.phone?.replace(/\D/g, "") || undefined,
        externalReference: `adveyes:tenant:${body.tenantId}`,
      });
      if (!customerResult.ok) {
        await admin.from("billing_checkout_orders").update({
          status: "failed",
          error_code: "customer_creation_failed",
        }).eq("id", order.id);
        return json({
          error: "Falha ao criar cliente no Asaas",
          details: customerResult.data,
        }, 502);
      }
      customerId = (customerResult.data as { id?: string }).id;
      if (!customerId) throw new Error("Asaas customer id missing");
    }

    const subscriptionExternalReference = `adveyes:subscription:${order.id}`;
    const existingSubscriptions = await asaasRequest(
      `subscriptions?externalReference=${
        encodeURIComponent(subscriptionExternalReference)
      }`,
    );
    let asaasSubscription = existingSubscriptions.ok
      ? (existingSubscriptions.data as {
        data?: Array<Record<string, unknown>>;
      }).data?.[0]
      : undefined;

    if (!asaasSubscription) {
      const recurring = await asaasRequest("subscriptions", "POST", {
        customer: customerId,
        billingType: body.billingType,
        value: centsToReais(priced.recurringTotalCents),
        nextDueDate: addMonths(
          new Date(),
          body.billingCycle === "monthly" ? 1 : 12,
        ),
        cycle: body.billingCycle === "monthly" ? "MONTHLY" : "YEARLY",
        description: `ADVeyes ${plan.name} — ${
          body.billingCycle === "monthly" ? "mensal" : "anual"
        }`,
        externalReference: subscriptionExternalReference,
        ...cardPayload(body),
      });
      if (!recurring.ok) {
        await admin.from("billing_checkout_orders").update({
          status: "failed",
          error_code: "subscription_creation_failed",
          asaas_customer_id: customerId,
        }).eq("id", order.id);
        return json({
          error: "Falha ao criar recorrência no Asaas",
          details: recurring.data,
        }, 502);
      }
      asaasSubscription = recurring.data as Record<string, unknown>;
    }

    const subscriptionId = asaasSubscription.id;
    if (typeof subscriptionId !== "string") {
      throw new Error("Asaas subscription id missing");
    }

    const paymentExternalReference = `adveyes:initial:${order.id}`;
    const existingPayments = await asaasRequest(
      `payments?externalReference=${encodeURIComponent(paymentExternalReference)}`,
    );
    let initialPayment = existingPayments.ok
      ? (existingPayments.data as {
        data?: Array<Record<string, unknown>>;
      }).data?.[0]
      : undefined;

    if (!initialPayment) {
      const installmentCount = Number(body.installmentCount ?? 1);
      const installment =
        body.billingCycle === "annual" &&
          body.billingType === "CREDIT_CARD" &&
          installmentCount > 1
          ? {
            installmentCount,
            totalValue: centsToReais(priced.initialTotalCents),
          }
          : {};
      const initial = await asaasRequest("payments", "POST", {
        customer: customerId,
        billingType: body.billingType,
        value: centsToReais(priced.initialTotalCents),
        dueDate: new Date().toISOString().slice(0, 10),
        description: `ADVeyes ${plan.name} — contratação inicial`,
        externalReference: paymentExternalReference,
        ...installment,
        ...cardPayload(body),
      });
      if (!initial.ok) {
        await asaasRequest(`subscriptions/${subscriptionId}`, "DELETE");
        await admin.from("billing_checkout_orders").update({
          status: "failed",
          error_code: "initial_payment_failed",
          asaas_customer_id: customerId,
          asaas_subscription_id: subscriptionId,
        }).eq("id", order.id);
        return json({
          error: "Falha ao criar cobrança inicial no Asaas",
          details: initial.data,
        }, 502);
      }
      initialPayment = initial.data as Record<string, unknown>;
    }

    const paymentId = initialPayment.id;
    if (typeof paymentId !== "string") {
      throw new Error("Asaas payment id missing");
    }

    const { data: tenantSubscription, error: upsertError } = await admin
      .from("tenant_subscriptions")
      .upsert({
        tenant_id: body.tenantId,
        plan_id: plan.id,
        status: "pending",
        billing_cycle: body.billingCycle,
        price_snapshot: pricingSnapshot,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
        next_due_date: addMonths(
          new Date(),
          body.billingCycle === "monthly" ? 1 : 12,
        ),
        trial_ends_at: null,
        canceled_at: null,
        created_by: user.id,
      }, { onConflict: "tenant_id" })
      .select("id")
      .single();
    if (upsertError) throw upsertError;

    if (priced.items.length > 0) {
      const itemRows = priced.items.map((item) => ({
        tenant_id: body.tenantId,
        subscription_id: tenantSubscription.id,
        addon_id: item.addonId,
        quantity: item.quantity,
        status: "pending",
        price_snapshot: {
          code: item.code,
          unitPriceCents: item.unitPriceCents,
          billingModel: item.billingModel,
          catalogVersion: 1,
        },
        expires_at: item.validityDays
          ? new Date(Date.now() + item.validityDays * 86400000).toISOString()
          : null,
      }));
      const { error: itemError } = await admin
        .from("tenant_subscription_items")
        .upsert(itemRows, { onConflict: "subscription_id,addon_id" });
      if (itemError) throw itemError;
    }

    await admin.from("billing_checkout_orders").update({
      status: "pending",
      asaas_customer_id: customerId,
      asaas_subscription_id: subscriptionId,
      asaas_initial_payment_id: paymentId,
    }).eq("id", order.id);

    const assets = await paymentAssets(initialPayment);
    return json({
      ok: true,
      reused: false,
      orderId: order.id,
      pricing: pricingSnapshot,
      subscription: asaasSubscription,
      ...assets,
    });
  } catch (error) {
    console.error(
      "[asaas] internal error:",
      error instanceof Error ? error.message : String(error),
    );
    return json({ error: "Erro interno ao processar cobrança" }, 500);
  }
});
