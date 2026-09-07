import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { verifyWebhookSignature } from "../_shared/whatsapp-meta.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type,x-hub-signature-256", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const deliveryStatuses = new Set(["sent", "delivered", "read", "failed", "deleted"]);

function normalizePhone(value: string): string { return value.replace(/\D/g, ""); }
function eventKey(type: string, id: string, fallback: unknown): string {
  if (id) return `${type}:${id}`;
  return `${type}:${JSON.stringify(fallback).slice(0, 512)}`;
}

async function resolveAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("server_configuration_error");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function processChange(admin: Awaited<ReturnType<typeof resolveAdmin>>, wabaId: string, change: Record<string, unknown>) {
  const { data: connection } = await admin.from("whatsapp_connections").select("tenant_id,phone_number_id").eq("waba_id", wabaId).maybeSingle();
  if (!connection) return;
  const value = (change.value ?? {}) as Record<string, unknown>;
  const metadata = (value.metadata ?? {}) as Record<string, unknown>;
  if (metadata.phone_number_id && metadata.phone_number_id !== connection.phone_number_id) return;
  const now = new Date().toISOString();
  const messages = Array.isArray(value.messages) ? value.messages as Array<Record<string, unknown>> : [];
  const statuses = Array.isArray(value.statuses) ? value.statuses as Array<Record<string, unknown>> : [];

  for (const item of messages) {
    const id = typeof item.id === "string" ? item.id : "";
    const from = normalizePhone(typeof item.from === "string" ? item.from : "");
    if (!id || !from) continue;
    const key = eventKey("message", id, item);
    const inserted = await admin.from("whatsapp_webhook_events").insert({ tenant_id: connection.tenant_id, event_key: key, event_type: "message", payload: item }).select("id").maybeSingle();
    if (inserted.error?.code === "23505" || !inserted.data) continue;
    const contactName = Array.isArray(value.contacts) ? String((value.contacts[0] as Record<string, unknown>)?.profile && ((value.contacts[0] as Record<string, unknown>).profile as Record<string, unknown>).name || "") : null;
    const text = typeof (item.text as Record<string, unknown> | undefined)?.body === "string" ? String((item.text as Record<string, unknown>).body) : `[${String(item.type ?? "mensagem")}]`;
    const { data: client } = await admin.from("clientes").select("id,nome").eq("tenant_id", connection.tenant_id).eq("telefone", from).maybeSingle();
    const { data: conversation, error: conversationError } = await admin.from("whatsapp_conversations").upsert({ tenant_id: connection.tenant_id, client_id: client?.id ?? null, contact_phone: from, contact_name: client?.nome ?? contactName, last_message_at: now, last_message_preview: text.slice(0, 240), unread_count: 1 }, { onConflict: "tenant_id,contact_phone" }).select("id").single();
    if (conversationError || !conversation) throw conversationError ?? new Error("conversation_not_created");
    await admin.from("whatsapp_messages").insert({ tenant_id: connection.tenant_id, conversation_id: conversation.id, client_id: client?.id ?? null, direction: "inbound", message_type: String(item.type ?? "unknown"), body_text: text, wa_message_id: id, status: "received", occurred_at: new Date(Number(item.timestamp ?? 0) * 1000 || Date.now()).toISOString(), raw_payload: item });
    await admin.from("whatsapp_webhook_events").update({ processed_at: now }).eq("id", inserted.data.id);
  }

  for (const item of statuses) {
    const id = typeof item.id === "string" ? item.id : "";
    const receivedStatus = typeof item.status === "string" ? item.status : "";
    const status = deliveryStatuses.has(receivedStatus)
      ? receivedStatus
      : "failed";
    if (!id || !status) continue;
    const key = eventKey("status", `${id}:${status}`, item);
    const inserted = await admin.from("whatsapp_webhook_events").insert({ tenant_id: connection.tenant_id, event_key: key, event_type: "status", payload: item }).select("id").maybeSingle();
    if (inserted.error?.code === "23505" || !inserted.data) continue;
    await admin.from("whatsapp_messages").update({ status, error_code: status === "failed" ? "meta_delivery_failed" : null }).eq("tenant_id", connection.tenant_id).eq("wa_message_id", id);
    await admin.from("whatsapp_webhook_events").update({ processed_at: now }).eq("id", inserted.data.id);
  }
  await admin.from("whatsapp_connections").update({ last_webhook_at: now, last_error_code: null, last_error_at: null }).eq("tenant_id", connection.tenant_id);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") && challenge) {
      return new Response(challenge, { status: 200, headers: { ...cors, "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403, headers: cors });
  }
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  const rawBody = await request.text();
  if (!await verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"))) return response({ error: "invalid_signature" }, 401);
  try {
    const payload = JSON.parse(rawBody) as { object?: string; entry?: Array<{ id?: string; changes?: Array<Record<string, unknown>> }> };
    if (payload.object !== "whatsapp_business_account") return response({ ok: true });
    const admin = await resolveAdmin();
    for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
      if (entry.id && change.field === "messages") await processChange(admin, entry.id, change);
    }
    return response({ ok: true });
  } catch (error) {
    console.error("whatsapp-webhook", error);
    return response({ error: "processing_failed" }, 500);
  }
});
