import { supabase } from "@/integrations/supabase/client";

export interface PublicApiToken {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface PublicApiWebhook {
  id: string;
  name: string;
  url: string;
  event_types: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicApiAdminState {
  availableScopes: string[];
  availableEvents: string[];
  tokens: PublicApiToken[];
  webhooks: PublicApiWebhook[];
  providers: Record<"datajud" | "djen" | "judit" | "trackjud" | "escavador" | "conecta", boolean>;
}

type AdminCommand =
  | { action: "list" }
  | { action: "create_token"; name: string; scopes: string[]; expiresInDays: number }
  | { action: "revoke_token"; tokenId: string }
  | { action: "create_webhook"; name: string; url: string; eventTypes: string[] }
  | { action: "update_webhook"; webhookId: string; active: boolean }
  | { action: "delete_webhook"; webhookId: string };

const ERROR_MESSAGES: Record<string, string> = {
  permission_denied:
    "Sua conta não administra este escritório. Peça ao titular ou a um administrador do escritório para emitir a credencial.",
  support_session_required:
    "A Conta Geral abre este painel apenas para leitura. Use Ativar suporte por 30 minutos antes de emitir ou revogar credenciais.",
  tenant_required: "Selecione um escritório antes de gerenciar a API.",
  invalid_name: "Informe um nome de credencial entre 2 e 80 caracteres.",
  invalid_scopes: "Selecione ao menos uma permissão para a credencial.",
  invalid_expiration: "A validade deve ficar entre 1 e 365 dias.",
  invalid_webhook_url: "Informe uma URL de webhook válida.",
  https_required: "O webhook precisa usar HTTPS.",
  invalid_events: "Selecione ao menos um evento para o webhook.",
  token_not_found: "Credencial não encontrada.",
  webhook_not_found: "Webhook não encontrado.",
  webhook_encryption_unavailable:
    "A chave de criptografia de webhooks não está configurada no servidor.",
};

export function publicApiErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? code;
}

/**
 * `functions.invoke` entrega um FunctionsHttpError opaco em qualquer resposta
 * fora da faixa 2xx. O código real fica no corpo, então lemos a resposta antes
 * de mostrar a falha para quem está configurando a integração.
 */
export async function describeInvokeError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return publicApiErrorMessage(body.error);
    } catch {
      // Corpo ausente ou não-JSON: preservamos a mensagem original do SDK.
    }
  }
  return error instanceof Error ? error.message : String(error);
}

async function invoke<T>(tenantId: string, command: AdminCommand): Promise<T> {
  const { data, error } = await supabase.functions.invoke("public-api-admin", {
    body: { tenantId, ...command },
  });
  if (error) throw new Error(await describeInvokeError(error));
  if (data?.error) throw new Error(publicApiErrorMessage(data.error));
  return data as T;
}

export const publicApiAdmin = {
  list: (tenantId: string) => invoke<PublicApiAdminState>(tenantId, { action: "list" }),
  createToken: (tenantId: string, input: { name: string; scopes: string[]; expiresInDays: number }) =>
    invoke<{ token: string; record: PublicApiToken }>(tenantId, {
      action: "create_token",
      ...input,
    }),
  revokeToken: (tenantId: string, tokenId: string) =>
    invoke<{ revoked: true }>(tenantId, { action: "revoke_token", tokenId }),
  createWebhook: (tenantId: string, input: { name: string; url: string; eventTypes: string[] }) =>
    invoke<{ secret: string; webhook: PublicApiWebhook }>(tenantId, {
      action: "create_webhook",
      ...input,
    }),
  setWebhookActive: (tenantId: string, webhookId: string, active: boolean) =>
    invoke<{ webhook: PublicApiWebhook }>(tenantId, {
      action: "update_webhook",
      webhookId,
      active,
    }),
  deleteWebhook: (tenantId: string, webhookId: string) =>
    invoke<{ deleted: true }>(tenantId, { action: "delete_webhook", webhookId }),
};
