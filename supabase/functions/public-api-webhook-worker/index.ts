import { createClient } from "npm:@supabase/supabase-js@2";
import {
  decryptWebhookSecret,
  hmacSha256Hex,
  sha256Hex,
} from "../_shared/public-api-crypto.ts";

const RETRY_SECONDS = [60, 300, 1_800, 7_200, 43_200];
const TRANSIENT_STATUS = new Set([408, 409, 425, 429]);

interface ClaimedDelivery {
  delivery_id: string;
  tenant_id: string;
  attempt_count: number;
  event_id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  event_occurred_at: string;
  endpoint_id: string;
  endpoint_url: string;
  endpoint_secret_ciphertext: string;
  endpoint_active: boolean;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isTransient(status: number): boolean {
  return TRANSIENT_STATUS.has(status) || status >= 500;
}

function nextAttempt(attempt: number): string | null {
  const seconds = RETRY_SECONDS[attempt - 1];
  return seconds ? new Date(Date.now() + seconds * 1_000).toISOString() : null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "unauthorized" }, 401);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const encryptionKey = Deno.env.get("WEBHOOK_SECRET_ENCRYPTION_KEY");
  if (!supabaseUrl || !serviceRoleKey || !encryptionKey) {
    return json({ error: "server_configuration_error" }, 500);
  }

  let limit = 20;
  try {
    const body = await request.json() as { limit?: number };
    if (Number.isInteger(body.limit)) limit = Math.min(Math.max(body.limit ?? 20, 1), 50);
  } catch {
    // A body is optional; the scheduled call always sends one.
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("claim_public_api_webhook_deliveries", {
    batch_size: limit,
  });
  if (error) {
    console.error("webhook-worker claim", error.message);
    return json({ error: "claim_failed" }, 500);
  }

  const deliveries = (data ?? []) as ClaimedDelivery[];
  let delivered = 0;
  let retried = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    let statusCode: number | null = null;
    let failure = "";
    let transient = true;
    try {
      if (!delivery.endpoint_active) {
        transient = false;
        throw new Error("endpoint_inactive");
      }
      const secret = await decryptWebhookSecret(
        delivery.endpoint_secret_ciphertext,
        encryptionKey,
      );
      const tenantReference = (await sha256Hex(delivery.tenant_id)).slice(0, 24);
      const body = JSON.stringify({
        id: delivery.event_id,
        type: delivery.event_type,
        occurred_at: delivery.event_occurred_at,
        tenant_reference: tenantReference,
        data: delivery.event_payload,
        api_version: "v1",
      });
      const timestamp = Math.floor(Date.now() / 1_000).toString();
      const signature = await hmacSha256Hex(secret, `${timestamp}.${body}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let deliveryResponse: Response;
      try {
        deliveryResponse = await fetch(delivery.endpoint_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "ADVeyes-Webhooks/1.0",
            "X-ADVeyes-Event-Id": delivery.event_id,
            "X-ADVeyes-Timestamp": timestamp,
            "X-ADVeyes-Signature": `v1=${signature}`,
          },
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      statusCode = deliveryResponse.status;
      if (!deliveryResponse.ok) {
        transient = isTransient(deliveryResponse.status);
        throw new Error(`http_${deliveryResponse.status}`);
      }
      await admin.from("webhook_deliveries").update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        last_status_code: statusCode,
        last_error: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", delivery.delivery_id);
      delivered += 1;
      continue;
    } catch (error) {
      failure = error instanceof Error ? error.message : "delivery_failed";
    }

    const retryAt = transient ? nextAttempt(delivery.attempt_count) : null;
    const willRetry = Boolean(retryAt) && delivery.attempt_count < 6;
    const { error: updateError } = await admin.from("webhook_deliveries").update({
      status: willRetry ? "pending" : "failed",
      next_attempt_at: retryAt ?? new Date().toISOString(),
      last_status_code: statusCode,
      last_error: failure.slice(0, 500),
      locked_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", delivery.delivery_id);
    if (updateError) console.error("webhook-worker update", delivery.delivery_id, updateError.message);
    if (willRetry) retried += 1;
    else failed += 1;
  }

  return json({ claimed: deliveries.length, delivered, retried, failed });
});
