import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hmacSha256Hex } from "../../supabase/functions/_shared/public-api-crypto";

describe("integração WhatsApp Meta", () => {
  it("protege tokens, dados e webhooks por tenant", () => {
    const migration = readFileSync("supabase/migrations/20260831135207_whatsapp_meta_embedded_signup.sql", "utf8");
    expect(migration).toContain("access_token_ciphertext");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("private.has_tenant_permission(tenant_id, 'legal', 'read')");
    expect(migration).not.toMatch(/grant select \([^;]*access_token_ciphertext/i);
    expect(migration).toContain("unique (tenant_id, event_key)");
  });

  it("valida assinatura HMAC no corpo bruto antes de processar o webhook", async () => {
    expect(await hmacSha256Hex("segredo", "corpo")).toBe("e91230a484e9425f85f8375e6a21b2a67662dbb11fb323f4e6be17fd290e2b5f");
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(webhook.indexOf("request.text()"))
      .toBeLessThan(webhook.indexOf("JSON.parse(rawBody)"));
    expect(webhook).toContain("verifyWebhookSignature(rawBody");
  });

  it("usa Embedded Signup e não o atalho legado do WhatsApp Web", () => {
    const page = readFileSync("src/pages/WhatsApp.tsx", "utf8");
    expect(page).toContain("WA_EMBEDDED_SIGNUP");
    expect(page).toContain("completeEmbeddedSignup");
    expect(page).toContain("fbAsyncInit");
    expect(page).toContain("sessionInfoVersion: \"3\"");
    expect(page).toContain("meta_login_timeout");
    expect(page).not.toContain("window.FB?.login");
    expect(page).not.toContain("web.whatsapp.com");
    expect(page).not.toContain("whatsapp_history");
  });

  it("mantém falhas transitórias do DJEN ativas", () => {
    const reconcile = readFileSync("supabase/functions/legal-reconcile/index.ts", "utf8");
    expect(reconcile).not.toContain('paused_reason: exhausted ? "max_retries" : null');
    const repair = readFileSync("supabase/migrations/20260831135324_repair_transient_djen_sources.sql", "utf8");
    expect(repair).toContain("where paused_reason = 'max_retries'");
    expect(repair).toContain("set active = true");
  });
});
