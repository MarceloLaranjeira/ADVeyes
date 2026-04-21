// supabase/functions/asaas-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, asaas-access-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validar token secreto enviado pelo Asaas
  const token = req.headers.get("asaas-access-token");
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  if (!token || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let payload: {
    event: string;
    payment?: { subscriptionId?: string; customer?: string; dueDate?: string };
    subscription?: { id?: string; customer?: string };
  };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { event, payment, subscription } = payload;
  const asaasCustomerId = payment?.customer ?? subscription?.customer;
  const asaasSubscriptionId = payment?.subscriptionId ?? subscription?.id;

  if (!asaasCustomerId) {
    return new Response(JSON.stringify({ ok: true, skipped: "no customer id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  type DbStatus = "active" | "overdue" | "cancelled" | "pending";
  const STATUS_MAP: Record<string, DbStatus | null> = {
    // Dinheiro confirmado de fato → ativa
    PAYMENT_CONFIRMED:           "active",
    PAYMENT_RECEIVED:            "active",
    // Atraso → bloqueia
    PAYMENT_OVERDUE:             "overdue",
    // Estorno / chargeback / exclusão → reverte
    PAYMENT_REFUNDED:            "cancelled",
    PAYMENT_REFUND_IN_PROGRESS:  "cancelled",
    PAYMENT_CHARGEBACK_REQUESTED:"cancelled",
    PAYMENT_CHARGEBACK_DISPUTE:  "cancelled",
    PAYMENT_AWAITING_CHARGEBACK_REVERSAL: "cancelled",
    PAYMENT_DELETED:             "pending",
    SUBSCRIPTION_CANCELLED:      "cancelled",
    SUBSCRIPTION_DELETED:        "cancelled",
    // PIX agendado / aguardando compensação → NÃO ativa, mantém pending
    PAYMENT_CREATED:             null,
    PAYMENT_AWAITING_RISK_ANALYSIS: null,
  };

  const newStatus = STATUS_MAP[event];
  if (!newStatus) {
    return new Response(JSON.stringify({ ok: true, skipped: `unhandled event: ${event}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const update: Record<string, string> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (asaasSubscriptionId) update.asaas_subscription_id = asaasSubscriptionId;
  if (newStatus === "active" && payment?.dueDate) update.next_due_date = payment.dueDate;

  const { error } = await supabase
    .from("asaas_subscriptions")
    .update(update)
    .eq("asaas_customer_id", asaasCustomerId);

  if (error) {
    console.error("Webhook update error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, event, newStatus }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
