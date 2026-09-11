import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  hmacSha256Hex,
} from "./public-api-crypto.ts";

const graphVersion = Deno.env.get("META_GRAPH_VERSION") ?? "v23.0";

export interface MetaConnectionDetails {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  businessName: string | null;
  accessToken: string;
}

export class MetaApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new MetaApiError("meta_not_configured", `${name} is not configured`);
  return value;
}

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${graphVersion}/${path.replace(/^\//, "")}`;
}

async function graph<T>(path: string, init: RequestInit, token: string): Promise<T> {
  const response = await fetch(graphUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: { code?: number; message?: string; type?: string };
  };
  if (!response.ok) {
    const message = payload.error?.message ?? `Meta request failed (${response.status})`;
    const code = response.status === 401 || response.status === 403
      ? "meta_unauthorized"
      : response.status === 429 ? "meta_rate_limited" : "meta_request_failed";
    throw new MetaApiError(code, message);
  }
  return payload as T;
}

export async function exchangeEmbeddedSignupCode(code: string): Promise<string> {
  const appId = requiredSecret("META_APP_ID");
  const appSecret = requiredSecret("META_APP_SECRET");
  const url = new URL(graphUrl("oauth/access_token"));
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);
  const response = await fetch(url, { method: "GET" });
  const payload = await response.json().catch(() => ({})) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.access_token) {
    throw new MetaApiError("meta_code_exchange_failed", payload.error?.message ?? "Could not exchange Meta code");
  }
  return payload.access_token;
}

export async function resolveMetaConnection(
  accessToken: string,
  selectedWabaId: string | null,
  selectedPhoneNumberId: string | null,
): Promise<MetaConnectionDetails> {
  if (!selectedWabaId) throw new MetaApiError("meta_waba_not_found", "Embedded Signup did not return a WhatsApp Business Account");
  const wabaId = selectedWabaId;

  const [waba, phones] = await Promise.all([
    graph<{ name?: string }>(`${wabaId}?fields=name`, { method: "GET" }, accessToken),
    graph<{ data?: Array<{ id?: string; display_phone_number?: string; verified_name?: string }> }>(
      `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
      { method: "GET" },
      accessToken,
    ),
  ]);
  const phone = phones.data?.find((item) => item.id === selectedPhoneNumberId) ?? phones.data?.[0];
  if (!phone?.id) throw new MetaApiError("meta_phone_not_found", "No registered WhatsApp number was returned by Meta");
  return {
    wabaId,
    phoneNumberId: phone.id,
    displayPhoneNumber: phone.display_phone_number ?? null,
    verifiedName: phone.verified_name ?? null,
    businessName: waba.name ?? null,
    accessToken,
  };
}

/**
 * Assina o app nos webhooks usando o token de integração específico da WABA.
 * Um system user global pode receber MANAGE, mas nunca é persistido como token
 * operacional do escritório. Não há compartilhamento de linha de crédito.
 */
export async function provisionProviderAccess(wabaId: string, signupToken: string): Promise<string> {
  const systemToken = Deno.env.get("META_SYSTEM_USER_TOKEN")?.trim();
  if (systemToken) {
    const systemUser = await graph<{ id?: string }>("me?fields=id", { method: "GET" }, systemToken);
    if (!systemUser.id) throw new MetaApiError("meta_system_user_not_found", "Meta did not return the provider system user");
    const assigned = new URLSearchParams({ user: systemUser.id, tasks: "['MANAGE']" });
    await graph(`${wabaId}/assigned_users?${assigned}`, { method: "POST" }, systemToken);
  }
  await graph(`${wabaId}/subscribed_apps`, { method: "POST" }, signupToken);
  return signupToken;
}

export async function encryptWhatsAppToken(token: string): Promise<string> {
  return encryptWebhookSecret(token, requiredSecret("WHATSAPP_TOKEN_ENCRYPTION_KEY"));
}

export async function decryptWhatsAppToken(ciphertext: string): Promise<string> {
  return decryptWebhookSecret(ciphertext, requiredSecret("WHATSAPP_TOKEN_ENCRYPTION_KEY"));
}

export async function sendTextMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<string> {
  const response = await graph<{ messages?: Array<{ id?: string }> }>(
    `${input.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: input.to, type: "text", text: { body: input.body } }),
    },
    input.accessToken,
  );
  const id = response.messages?.[0]?.id;
  if (!id) throw new MetaApiError("meta_invalid_response", "Meta did not return a message id");
  return id;
}

export interface MetaMessageTemplate {
  name: string;
  language: string;
  category: string | null;
}

export async function listApprovedTemplates(input: {
  wabaId: string;
  accessToken: string;
}): Promise<MetaMessageTemplate[]> {
  const result = await graph<{ data?: Array<{ name?: string; language?: string; category?: string; status?: string }> }>(
    `${input.wabaId}/message_templates?fields=name,language,category,status&status=APPROVED&limit=100`,
    { method: "GET" },
    input.accessToken,
  );
  return (result.data ?? []).filter((item) => item.name && item.language && item.status === "APPROVED").map((item) => ({
    name: item.name!, language: item.language!, category: item.category ?? null,
  }));
}

export async function sendTemplateMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  name: string;
  language: string;
  components?: unknown[];
}): Promise<string> {
  const response = await graph<{ messages?: Array<{ id?: string }> }>(
    `${input.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: input.name,
          language: { code: input.language },
          ...(input.components?.length ? { components: input.components } : {}),
        },
      }),
    },
    input.accessToken,
  );
  const id = response.messages?.[0]?.id;
  if (!id) throw new MetaApiError("meta_invalid_response", "Meta did not return a message id");
  return id;
}

export async function verifyWebhookSignature(body: string, signatureHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get("META_APP_SECRET")?.trim();
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = await hmacSha256Hex(secret, body);
  const received = signatureHeader.slice("sha256=".length).toLowerCase();
  if (expected.length !== received.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  }
  return mismatch === 0;
}
