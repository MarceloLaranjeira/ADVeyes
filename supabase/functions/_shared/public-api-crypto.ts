const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function randomBase64Url(byteLength: number): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function createApiToken(environment: "live" | "test" = "live"): {
  token: string;
  prefix: string;
} {
  const identifier = randomBase64Url(9);
  const prefix = `adv_${environment}_${identifier}`;
  return { token: `${prefix}_${randomBase64Url(32)}`, prefix };
}

export function createWebhookSecret(): string {
  return `whsec_${randomBase64Url(32)}`;
}

function encryptionKeyBytes(value: string): Uint8Array {
  const trimmed = value.trim();
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return Uint8Array.from(trimmed.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
  }
  const decoded = base64UrlToBytes(trimmed);
  if (decoded.length !== 32) throw new Error("invalid_webhook_encryption_key");
  return decoded;
}

async function importEncryptionKey(value: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes(value),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptWebhookSecret(
  plaintext: string,
  encryptionKey: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importEncryptionKey(encryptionKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptWebhookSecret(
  encrypted: string,
  encryptionKey: string,
): Promise<string> {
  const [version, ivValue, ciphertextValue, extra] = encrypted.split(".");
  if (version !== "v1" || !ivValue || !ciphertextValue || extra) {
    throw new Error("invalid_webhook_ciphertext");
  }
  const key = await importEncryptionKey(encryptionKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(ivValue) },
    key,
    base64UrlToBytes(ciphertextValue),
  );
  return decoder.decode(plaintext);
}

export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return bytesToHex(new Uint8Array(signature));
}
