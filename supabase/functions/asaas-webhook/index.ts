import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, asaas-access-token, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SubscriptionStatus = "active" | "past_due" | "canceled" | "pending";

interface AsaasWebhook {
  id?: string;
  event: string;
  payment?: {
    id?: string;
    subscription?: string;
    customer?: string;
    dueDate?: string;
    status?: string;
  };
  subscription?: {
    id?: string;
    customer?: string;
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    sha256(left),
    sha256(right),
  ]);
  let difference = leftHash.length ^ rightHash.length;
  for (let index = 0; index < leftHash.length; index++) {
    difference |= leftHash.charCodeAt(index) ^ rightHash.charCodeAt(index);
  }
  return difference === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = req.headers.get("asaas-access-token") || "";
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
  if (!token || !expectedToken || !(await secureEqual(token, expectedToken))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const rawBody = await req.text();
  let payload: AsaasWebhook;
  try {
    payload = JSON.parse(rawBody) as AsaasWebhook;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!payload.event) return json({ error: "Missing event" }, 400);

  const paymentId = payload.payment?.id;
  const subscriptionId =
    payload.payment?.subscription ?? payload.subscription?.id;
  const customerId =
    payload.payment?.customer ?? payload.subscription?.customer;
  const eventId = payload.id ||
    `${payload.event}:${paymentId ?? subscriptionId ?? customerId ?? "unknown"}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error: eventInsertError } = await supabase
    .from("billing_webhook_events")
    .insert({
      event_id: eventId,
      event_type: payload.event,
      payload_hash: await sha256(rawBody),
      status: "received",
    });
  if (eventInsertError?.code === "23505") {
    return json({ ok: true, duplicate: true, eventId });
  }
  if (eventInsertError) {
    console.error("[asaas-webhook] event insert:", eventInsertError.message);
    return json({ error: "Event persistence failed" }, 500);
  }

  const statusByEvent: Record<string, SubscriptionStatus | null> = {
    PAYMENT_CONFIRMED: "active",
    PAYMENT_RECEIVED: "active",
    PAYMENT_OVERDUE: "past_due",
    PAYMENT_REFUNDED: "canceled",
    PAYMENT_REFUND_IN_PROGRESS: "canceled",
    PAYMENT_CHARGEBACK_REQUESTED: "canceled",
    PAYMENT_CHARGEBACK_DISPUTE: "canceled",
    PAYMENT_AWAITING_CHARGEBACK_REVERSAL: "canceled",
    PAYMENT_DELETED: "pending",
    SUBSCRIPTION_CANCELLED: "canceled",
    SUBSCRIPTION_DELETED: "canceled",
    PAYMENT_CREATED: null,
    PAYMENT_AWAITING_RISK_ANALYSIS: null,
  };
  const newStatus = statusByEvent[payload.event];

  try {
    let order: {
      id: string;
      tenant_id: string;
    } | null = null;

    if (paymentId) {
      const { data, error } = await supabase
        .from("billing_checkout_orders")
        .select("id, tenant_id")
        .eq("asaas_initial_payment_id", paymentId)
        .maybeSingle();
      if (error) throw error;
      order = data;
    }

    let tenantSubscription: {
      id: string;
      tenant_id: string;
    } | null = null;
    if (order) {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("id, tenant_id")
        .eq("tenant_id", order.tenant_id)
        .maybeSingle();
      if (error) throw error;
      tenantSubscription = data;
    } else if (subscriptionId || customerId) {
      let query = supabase
        .from("tenant_subscriptions")
        .select("id, tenant_id");
      query = subscriptionId
        ? query.eq("asaas_subscription_id", subscriptionId)
        : query.eq("asaas_customer_id", customerId!);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      tenantSubscription = data;
    }

    if (newStatus && tenantSubscription) {
      const subscriptionUpdate: Record<string, unknown> = {
        status: newStatus,
      };
      if (newStatus === "active" && payload.payment?.dueDate) {
        subscriptionUpdate.next_due_date = payload.payment.dueDate;
      }
      if (newStatus === "canceled") {
        subscriptionUpdate.canceled_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("tenant_subscriptions")
        .update(subscriptionUpdate)
        .eq("id", tenantSubscription.id);
      if (updateError) throw updateError;

      if (newStatus === "active") {
        const activationResults = await Promise.all([
          supabase
            .from("tenant_subscription_items")
            .update({
              status: "active",
              starts_at: new Date().toISOString(),
            })
            .eq("subscription_id", tenantSubscription.id)
            .eq("status", "pending"),
          supabase
            .from("tenants")
            .update({
              status: "active",
              suspended_at: null,
              canceled_at: null,
              retention_until: null,
            })
            .eq("id", tenantSubscription.tenant_id),
        ]);
        const activationError = activationResults.find((result) => result.error)
          ?.error;
        if (activationError) throw activationError;
      } else if (newStatus === "past_due") {
        const { error } = await supabase
          .from("tenants")
          .update({ status: "past_due" })
          .eq("id", tenantSubscription.tenant_id);
        if (error) throw error;
      } else if (newStatus === "canceled") {
        const { error } = await supabase
          .from("tenants")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            retention_until: new Date(Date.now() + 30 * 86400000).toISOString(),
          })
          .eq("id", tenantSubscription.tenant_id);
        if (error) throw error;
      }
    }

    if (order && newStatus) {
      const orderStatus =
        newStatus === "active"
          ? "paid"
          : newStatus === "canceled"
          ? "canceled"
          : "pending";
      const { error: orderError } = await supabase
        .from("billing_checkout_orders")
        .update({ status: orderStatus })
        .eq("id", order.id);
      if (orderError) throw orderError;
    }

    // Compatibilidade temporária com assinaturas legadas por usuário.
    if (!tenantSubscription && customerId && newStatus) {
      const legacyStatus =
        newStatus === "past_due" ? "overdue" : newStatus === "canceled"
          ? "cancelled"
          : newStatus;
      const { error: legacyError } = await supabase
        .from("asaas_subscriptions")
        .update({
          status: legacyStatus,
          asaas_subscription_id: subscriptionId,
          next_due_date: payload.payment?.dueDate,
        })
        .eq("asaas_customer_id", customerId);
      if (legacyError) throw legacyError;
    }

    const { error: processedError } = await supabase
      .from("billing_webhook_events")
      .update({
        status: tenantSubscription || customerId ? "processed" : "ignored",
        tenant_id: tenantSubscription?.tenant_id ?? null,
        checkout_order_id: order?.id ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);
    if (processedError) throw processedError;

    return json({
      ok: true,
      eventId,
      newStatus: newStatus ?? "unchanged",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[asaas-webhook] processing:", message);
    await supabase
      .from("billing_webhook_events")
      .update({ status: "failed", error_message: message })
      .eq("event_id", eventId);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
