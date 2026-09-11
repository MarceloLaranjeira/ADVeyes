import { authenticateTenantRequest, json, resolveTenantLegalAccess } from "../_shared/tenant-auth.ts";
import {
  decryptWhatsAppToken,
  encryptWhatsAppToken,
  exchangeEmbeddedSignupCode,
  MetaApiError,
  provisionProviderAccess,
  listApprovedTemplates,
  resolveMetaConnection,
  sendTextMessage,
  sendTemplateMessage,
} from "../_shared/whatsapp-meta.ts";

type Action = "status" | "complete_embedded_signup" | "disconnect" | "templates" | "send_text" | "send_template";

function errorResponse(error: unknown): Response {
  if (error instanceof MetaApiError) return json({ error: error.code }, 422);
  console.error("whatsapp-admin", error);
  return json({ error: "operation_failed" }, 500);
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function canManageConnection(access: { kind: string; role: string; canMutate: boolean }): boolean {
  return access.canMutate && (access.kind === "platform" || ["owner", "admin"].includes(access.role));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  const action = body.action as Action;
  if (!tenantId || !action) return json({ error: "invalid_payload" }, 400);

  try {
    const access = await resolveTenantLegalAccess(auth.admin, auth.user.id, tenantId);
    if (!access) return json({ error: "permission_denied" }, 403);

    if (action === "status") {
      const { data, error } = await auth.admin.from("whatsapp_connections")
        .select("tenant_id,waba_id,phone_number_id,display_phone_number,verified_name,business_name,status,billing_mode,connected_at,last_webhook_at,last_error_code,last_error_at")
        .eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      return json({
        connection: data,
        canManage: canManageConnection(access),
        embeddedSignup: {
          appId: Deno.env.get("META_APP_ID") ?? null,
          configurationId: Deno.env.get("META_EMBEDDED_SIGNUP_CONFIG_ID") ?? null,
        },
      });
    }

    if (!canManageConnection(access)) return json({ error: "permission_denied" }, 403);

    if (action === "complete_embedded_signup") {
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const selectedWabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : null;
      const selectedPhoneNumberId = typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : null;
      if (!code) return json({ error: "invalid_payload" }, 400);

      const accessToken = await exchangeEmbeddedSignupCode(code);
      const meta = await resolveMetaConnection(accessToken, selectedWabaId, selectedPhoneNumberId);
      const operationalToken = await provisionProviderAccess(meta.wabaId, accessToken);
      const { data, error } = await auth.admin.from("whatsapp_connections").upsert({
        tenant_id: tenantId,
        waba_id: meta.wabaId,
        phone_number_id: meta.phoneNumberId,
        display_phone_number: meta.displayPhoneNumber,
        verified_name: meta.verifiedName,
        business_name: meta.businessName,
        access_token_ciphertext: await encryptWhatsAppToken(operationalToken),
        status: "connected",
        billing_mode: "direct_meta",
        connected_by: auth.user.id,
        connected_at: new Date().toISOString(),
        last_error_code: null,
        last_error_at: null,
      }, { onConflict: "tenant_id" }).select("tenant_id,waba_id,phone_number_id,display_phone_number,verified_name,business_name,status,billing_mode,connected_at").single();
      if (error) throw error;
      return json({ connection: data }, 201);
    }

    if (action === "disconnect") {
      const { error } = await auth.admin.from("whatsapp_connections").update({
        status: "revoked",
        access_token_ciphertext: null,
      }).eq("tenant_id", tenantId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "templates") {
      const { data: connection, error } = await auth.admin.from("whatsapp_connections")
        .select("waba_id,access_token_ciphertext,status").eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      if (!connection || connection.status !== "connected" || !connection.access_token_ciphertext) return json({ error: "whatsapp_not_connected" }, 409);
      return json({ templates: await listApprovedTemplates({ wabaId: connection.waba_id, accessToken: await decryptWhatsAppToken(connection.access_token_ciphertext) }) });
    }

    if (action === "send_text" || action === "send_template") {
      const phone = typeof body.to === "string" ? normalizePhone(body.to) : "";
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const clientId = typeof body.clientId === "string" ? body.clientId : null;
      const templateName = typeof body.templateName === "string" ? body.templateName.trim() : "";
      const templateLanguage = typeof body.templateLanguage === "string" ? body.templateLanguage.trim() : "";
      const components = Array.isArray(body.components) ? body.components : undefined;
      if (phone.length < 8 || (action === "send_text" && (!text || text.length > 4096)) || (action === "send_template" && (!templateName || !templateLanguage))) return json({ error: "invalid_payload" }, 400);
      const { data: connection, error: connectionError } = await auth.admin.from("whatsapp_connections")
        .select("phone_number_id,access_token_ciphertext,status").eq("tenant_id", tenantId).maybeSingle();
      if (connectionError) throw connectionError;
      if (!connection || connection.status !== "connected" || !connection.access_token_ciphertext) {
        return json({ error: "whatsapp_not_connected" }, 409);
      }
      const preview = action === "send_template" ? `[Template: ${templateName}]` : text;
      const { data: conversation, error: conversationError } = await auth.admin.from("whatsapp_conversations").upsert({
        tenant_id: tenantId, client_id: clientId, contact_phone: phone, last_message_at: new Date().toISOString(), last_message_preview: preview.slice(0, 240), unread_count: 0,
      }, { onConflict: "tenant_id,contact_phone" }).select("id").single();
      if (conversationError || !conversation) throw conversationError ?? new Error("conversation_not_created");
      const token = await decryptWhatsAppToken(connection.access_token_ciphertext);
      const waMessageId = action === "send_template"
        ? await sendTemplateMessage({ phoneNumberId: connection.phone_number_id, accessToken: token, to: phone, name: templateName, language: templateLanguage, components })
        : await sendTextMessage({ phoneNumberId: connection.phone_number_id, accessToken: token, to: phone, body: text });
      const { data: message, error: messageError } = await auth.admin.from("whatsapp_messages").insert({
        tenant_id: tenantId, conversation_id: conversation.id, client_id: clientId, direction: "outbound", message_type: action === "send_template" ? "template" : "text", body_text: preview, template_name: action === "send_template" ? templateName : null, wa_message_id: waMessageId, status: "sent", occurred_at: new Date().toISOString(), raw_payload: {},
      }).select("id,wa_message_id,status,occurred_at").single();
      if (messageError) throw messageError;
      return json({ message }, 201);
    }

    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    return errorResponse(error);
  }
});
