import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_BASE_URL = "https://api.asaas.com/v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLANS = {
  starter: { name: "Starter", price: 97 },
  profissional: { name: "Profissional", price: 197 },
  escritorio: { name: "Escritório", price: 397 },
} as const;

type PlanKey = keyof typeof PLANS;
type BillingType = "CREDIT_CARD" | "PIX" | "BOLETO";

interface CheckoutRequest {
  action: "create_checkout";
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

interface CancelRequest {
  action: "cancel_subscription";
}

type RequestBody = CheckoutRequest | CancelRequest;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function asaasRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${ASAAS_BASE_URL}/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      "User-Agent": "ADVeyes/1.0",
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

async function waitForFirstPayment(subscriptionId: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await asaasRequest(`subscriptions/${subscriptionId}/payments`);
    if (!result.ok) return result;

    const payload = result.data as { data?: Array<Record<string, unknown>> };
    const payment = payload.data?.[0];
    if (payment) return { ok: true as const, status: 200, data: payment };

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { ok: true as const, status: 200, data: null };
}

async function getCheckoutAssets(subscriptionId: string, billingType: BillingType) {
  let payment: Record<string, unknown> | null = null;
  let pix: unknown = null;

  if (billingType !== "CREDIT_CARD") {
    const firstPayment = await waitForFirstPayment(subscriptionId);
    if (!firstPayment.ok) {
      return { ok: false as const, error: "A cobrança da assinatura ainda não pôde ser consultada" };
    }
    payment = firstPayment.data as Record<string, unknown> | null;

    if (billingType === "PIX" && typeof payment?.id === "string") {
      const qrCode = await asaasRequest(`payments/${payment.id}/pixQrCode`);
      if (qrCode.ok) pix = qrCode.data;
    }
  }

  return { ok: true as const, payment, pix };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!ASAAS_API_KEY) return json({ error: "ASAAS_API_KEY não configurada" }, 503);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.slice("Bearer ".length);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json() as RequestBody;

    const { data: subscriptionRow, error: subscriptionError } = await admin
      .from("asaas_subscriptions")
      .select("asaas_customer_id, asaas_subscription_id, plan, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    if (body.action === "cancel_subscription") {
      if (!subscriptionRow?.asaas_subscription_id) {
        return json({ error: "Assinatura não encontrada" }, 404);
      }

      const cancellation = await asaasRequest(
        `subscriptions/${subscriptionRow.asaas_subscription_id}`,
        "DELETE",
      );
      if (!cancellation.ok) return json({ error: "Falha ao cancelar assinatura", details: cancellation.data }, 502);

      await admin
        .from("asaas_subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      return json({ ok: true });
    }

    if (body.action !== "create_checkout") return json({ error: "Ação inválida" }, 400);
    if (!Object.hasOwn(PLANS, body.plan)) return json({ error: "Plano inválido" }, 400);
    if (!["CREDIT_CARD", "PIX", "BOLETO"].includes(body.billingType)) {
      return json({ error: "Forma de pagamento inválida" }, 400);
    }
    if (!body.customer?.name || !body.customer?.cpfCnpj || !body.customer?.email) {
      return json({ error: "Dados do cliente incompletos" }, 400);
    }
    if (body.billingType === "CREDIT_CARD") {
      const card = body.creditCard;
      if (
        !card?.holderName || !card.number || !card.expiryMonth || !card.expiryYear ||
        !card.ccv || !card.postalCode || !card.addressNumber || !card.phone
      ) {
        return json({ error: "Dados do cartão incompletos" }, 400);
      }
    }

    if (subscriptionRow?.asaas_subscription_id && subscriptionRow.status !== "cancelled") {
      if (subscriptionRow.plan !== body.plan) {
        return json({
          error: "Já existe uma assinatura em andamento. Cancele-a antes de trocar de plano.",
        }, 409);
      }
      if (subscriptionRow.status === "active") {
        return json({ error: "Este plano já está ativo para a sua conta." }, 409);
      }

      const existingResult = await asaasRequest(
        `subscriptions/${subscriptionRow.asaas_subscription_id}`,
      );
      if (!existingResult.ok) {
        return json({ error: "Não foi possível consultar a assinatura existente" }, 502);
      }
      const existingSubscription = existingResult.data as {
        id?: string;
        billingType?: BillingType;
      };
      if (existingSubscription.billingType && existingSubscription.billingType !== body.billingType) {
        return json({
          error: "Já existe uma cobrança pendente em outra forma de pagamento.",
        }, 409);
      }

      const assets = await getCheckoutAssets(
        subscriptionRow.asaas_subscription_id,
        existingSubscription.billingType ?? body.billingType,
      );
      if (!assets.ok) return json({ error: assets.error }, 502);

      return json({
        ok: true,
        reused: true,
        subscription: existingSubscription,
        payment: assets.payment,
        pix: assets.pix,
      });
    }

    let customerId = subscriptionRow?.asaas_customer_id;
    if (!customerId) {
      const customerResult = await asaasRequest("customers", "POST", {
        name: body.customer.name.trim(),
        cpfCnpj: body.customer.cpfCnpj.replace(/\D/g, ""),
        email: body.customer.email.trim(),
        phone: body.customer.phone?.replace(/\D/g, "") || undefined,
        externalReference: `adveyes:${user.id}`,
      });
      if (!customerResult.ok) {
        return json({ error: "Falha ao criar cliente no Asaas", details: customerResult.data }, 502);
      }
      customerId = (customerResult.data as { id?: string }).id;
      if (!customerId) return json({ error: "Asaas não retornou o cliente criado" }, 502);
    }

    const plan = PLANS[body.plan];
    const nextDueDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const { error: pendingError } = await admin.from("asaas_subscriptions").upsert({
      user_id: user.id,
      asaas_customer_id: customerId,
      plan: body.plan,
      status: "pending",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (pendingError) throw pendingError;

    const subscriptionPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: body.billingType,
      value: plan.price,
      nextDueDate,
      cycle: "MONTHLY",
      description: `ADVeyes ${plan.name}`,
      externalReference: `adveyes:${user.id}:${body.plan}`,
    };

    if (body.billingType === "CREDIT_CARD" && body.creditCard) {
      subscriptionPayload.creditCard = {
        holderName: body.creditCard.holderName,
        number: body.creditCard.number.replace(/\s/g, ""),
        expiryMonth: body.creditCard.expiryMonth,
        expiryYear: body.creditCard.expiryYear,
        ccv: body.creditCard.ccv,
      };
      subscriptionPayload.creditCardHolderInfo = {
        name: body.customer.name,
        email: body.customer.email,
        cpfCnpj: body.customer.cpfCnpj.replace(/\D/g, ""),
        postalCode: body.creditCard.postalCode.replace(/\D/g, ""),
        addressNumber: body.creditCard.addressNumber,
        phone: body.creditCard.phone.replace(/\D/g, ""),
      };
    }

    const subscriptionResult = await asaasRequest("subscriptions", "POST", subscriptionPayload);
    if (!subscriptionResult.ok) {
      return json({ error: "Falha ao criar assinatura no Asaas", details: subscriptionResult.data }, 502);
    }

    const subscription = subscriptionResult.data as { id?: string };
    if (!subscription.id) return json({ error: "Asaas não retornou a assinatura criada" }, 502);

    const { error: updateError } = await admin.from("asaas_subscriptions").update({
      asaas_subscription_id: subscription.id,
      plan: body.plan,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
    if (updateError) throw updateError;

    const assets = await getCheckoutAssets(subscription.id, body.billingType);
    if (!assets.ok) {
      return json({ error: `Assinatura criada, mas ${assets.error.toLowerCase()}` }, 502);
    }

    return json({
      ok: true,
      reused: false,
      subscription,
      payment: assets.payment,
      pix: assets.pix,
    });
  } catch (error) {
    console.error("[asaas] internal error:", error instanceof Error ? error.message : String(error));
    return json({ error: "Erro interno ao processar cobrança" }, 500);
  }
});
