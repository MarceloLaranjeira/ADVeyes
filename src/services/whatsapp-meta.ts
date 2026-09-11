import { supabase } from "@/integrations/supabase/client";
import { readEdgeError } from "@/lib/edge-errors";

export interface WhatsAppConnection {
  tenant_id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  business_name: string | null;
  status: "connecting" | "connected" | "reconnect_required" | "revoked" | "error";
  billing_mode: "direct_meta";
  connected_at: string;
  last_webhook_at: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
}

export interface WhatsAppAdminState {
  connection: WhatsAppConnection | null;
  canManage: boolean;
  embeddedSignup: { appId: string | null; configurationId: string | null };
}

export interface WhatsAppTemplate { name: string; language: string; category: string | null; }

const messages: Record<string, string> = {
  permission_denied: "Seu acesso não permite alterar o WhatsApp deste escritório.",
  whatsapp_not_connected: "Conecte o WhatsApp Business deste escritório antes de enviar.",
  meta_not_configured: "A integração Meta ainda não foi configurada no servidor.",
  meta_code_exchange_failed: "A Meta não concluiu a autorização. Tente conectar novamente.",
  meta_waba_not_found: "A Meta não informou uma conta WhatsApp Business.",
  meta_phone_not_found: "Nenhum número WhatsApp registrado foi encontrado na conta Meta.",
  meta_system_user_not_found: "O usuário de sistema do provedor não foi encontrado na Meta.",
  meta_unauthorized: "A autorização da Meta expirou. Reconecte o WhatsApp.",
  meta_rate_limited: "A Meta limitou temporariamente os envios. Tente em instantes.",
  invalid_payload: "Revise os dados da mensagem e tente novamente.",
  operation_failed: "Não foi possível concluir a operação agora.",
};

async function invoke<T>(tenantId: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("whatsapp-admin", { body: { tenantId, ...payload } });
  if (error) {
    const parsed = await readEdgeError(error);
    throw new Error(messages[parsed.code] ?? messages.operation_failed);
  }
  if (data?.error) throw new Error(messages[data.error] ?? messages.operation_failed);
  return data as T;
}

export const whatsappMeta = {
  status: (tenantId: string) => invoke<WhatsAppAdminState>(tenantId, { action: "status" }),
  completeEmbeddedSignup: (tenantId: string, input: { code: string; wabaId?: string | null; phoneNumberId?: string | null }) =>
    invoke<{ connection: WhatsAppConnection }>(tenantId, { action: "complete_embedded_signup", ...input }),
  disconnect: (tenantId: string) => invoke<{ ok: true }>(tenantId, { action: "disconnect" }),
  templates: (tenantId: string) => invoke<{ templates: WhatsAppTemplate[] }>(tenantId, { action: "templates" }),
  sendText: (tenantId: string, input: { to: string; text: string; clientId?: string | null }) =>
    invoke<{ message: { id: string; wa_message_id: string; status: string; occurred_at: string } }>(tenantId, { action: "send_text", ...input }),
  sendTemplate: (tenantId: string, input: { to: string; templateName: string; templateLanguage: string; components?: unknown[]; clientId?: string | null }) =>
    invoke<{ message: { id: string; wa_message_id: string; status: string; occurred_at: string } }>(tenantId, { action: "send_template", ...input }),
};
