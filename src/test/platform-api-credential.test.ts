import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260907200000_platform_api_credentials.sql",
  "utf8",
);
const platformAdmin = readFileSync("supabase/functions/platform-admin/index.ts", "utf8");
const publicApi = readFileSync("supabase/functions/public-api/index.ts", "utf8");

describe("credencial de plataforma — invariante no banco", () => {
  it("amarra o alcance do token ao par (is_platform, tenant_id)", () => {
    expect(migration).toContain("check (is_platform = (tenant_id is null))");
  });

  it("preserva a unicidade do prefixo quando não há escritório", () => {
    expect(migration).toContain("api_tokens_platform_prefix_key");
    expect(migration).toContain("where tenant_id is null");
  });

  it("permite registrar a chamada de plataforma que não age sobre escritório", () => {
    expect(migration).toContain("alter table public.api_request_logs");
    expect(migration).toContain("alter column tenant_id drop not null");
  });
});

describe("credencial de plataforma — emissão", () => {
  it("só existe dentro da conta geral, atrás da checagem de platform_admins", () => {
    expect(platformAdmin).toContain('action === "create_platform_token"');
    expect(platformAdmin).toContain("is_platform: true");
    expect(platformAdmin).toContain("tenant_id: null");
  });

  it("registra quem emitiu e quem revogou uma credencial de alcance total", () => {
    expect(platformAdmin).toContain("platform.api_token_created");
    expect(platformAdmin).toContain("platform.api_token_revoked");
  });

  it("revoga apenas credenciais de plataforma", () => {
    const revokeBlock = platformAdmin.slice(
      platformAdmin.indexOf('action === "revoke_platform_token"'),
    );
    expect(revokeBlock).toContain('.is("tenant_id", null)');
  });
});

describe("credencial de plataforma — uso na API", () => {
  it("resolve o escritório por requisição em vez de confiar no token", () => {
    expect(publicApi).toContain("resolveRequestTenant");
    expect(publicApi).toContain('request.headers.get("X-Tenant-Id")');
  });

  it("confere se o escritório indicado ainda pode ser servido", () => {
    expect(publicApi).toContain("assertTenantServable");
    expect(publicApi).toContain('"tenant_not_found"');
  });

  it("audita a chamada com o escritório efetivo, não com o do token", () => {
    expect(publicApi).toContain("tenant_id: effectiveTenantId");
  });
});
