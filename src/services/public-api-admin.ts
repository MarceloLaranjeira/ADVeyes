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

async function invoke<T>(tenantId: string, command: AdminCommand): Promise<T> {
  const { data, error } = await supabase.functions.invoke("public-api-admin", {
    body: { tenantId, ...command },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
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
