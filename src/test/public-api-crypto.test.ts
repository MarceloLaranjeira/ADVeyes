import { describe, expect, it } from "vitest";
import {
  createApiToken,
  createWebhookSecret,
  decryptWebhookSecret,
  encryptWebhookSecret,
  hmacSha256Hex,
  sha256Hex,
} from "../../supabase/functions/_shared/public-api-crypto";

describe("public API cryptography", () => {
  const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  it("creates parseable high-entropy API tokens without storing the secret", () => {
    const first = createApiToken("test");
    const second = createApiToken("test");
    expect(first.prefix).toMatch(/^adv_test_[A-Za-z0-9_-]{12}$/);
    expect(first.token).toMatch(/^adv_test_[A-Za-z0-9_-]{12}_[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
  });

  it("hashes deterministically", async () => {
    expect(await sha256Hex("ADVeyes")).toMatch(/^[a-f0-9]{64}$/);
    expect(await sha256Hex("ADVeyes")).toBe(await sha256Hex("ADVeyes"));
  });

  it("encrypts webhook secrets with a random IV and decrypts them", async () => {
    const secret = createWebhookSecret();
    const encryptedA = await encryptWebhookSecret(secret, key);
    const encryptedB = await encryptWebhookSecret(secret, key);
    expect(encryptedA).not.toBe(encryptedB);
    expect(await decryptWebhookSecret(encryptedA, key)).toBe(secret);
  });

  it("signs raw webhook bodies", async () => {
    const signature = await hmacSha256Hex("secret", '{"id":"evt"}');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(signature).not.toBe(await hmacSha256Hex("secret", '{"id":"other"}'));
  });
});
