import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  toPlatformTenantMembership,
  type PlatformTenantSummary,
} from "@/services/platform-admin";

const baseTenant: PlatformTenantSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Escritório de Teste",
  legalName: "Escritório de Teste Ltda.",
  slug: "escritorio-teste",
  status: "active",
  trialEndsAt: null,
  createdAt: "2026-09-04T00:00:00Z",
  activeMembers: 2,
  candidateProcesses: 0,
  monitoredProcesses: 10,
  integrationFailures: 0,
  subscription: null,
};

describe("seleção administrativa de escritório", () => {
  it("preserva a identidade publicada no contexto da Conta Geral", () => {
    const membership = toPlatformTenantMembership({
      ...baseTenant,
      branding: {
        publicName: "Marca Publicada",
        shortName: "Marca",
        logoLightPath: "tenant/logo-light.svg",
        logoDarkPath: "tenant/logo-dark.svg",
        faviconPath: "tenant/favicon.svg",
        iconPath: "tenant/icon.svg",
        colorTokens: { primary: "210 60% 30%" },
        privacyUrl: "https://example.com/privacidade",
        termsUrl: "https://example.com/termos",
      },
    });

    expect(membership.accessMode).toBe("platform");
    expect(membership.platformContextVersion).toBe(1);
    expect(membership.branding.publicName).toBe("Marca Publicada");
    expect(membership.branding.logoLightPath).toBe("tenant/logo-light.svg");
    expect(membership.branding.colorTokens).toEqual({ primary: "210 60% 30%" });
  });

  it("usa nome e marca padrão quando não existe identidade publicada", () => {
    const membership = toPlatformTenantMembership(baseTenant);

    expect(membership.branding).toEqual({
      publicName: "Escritório de Teste",
      shortName: "Escritório de Teste",
      logoLightPath: null,
      logoDarkPath: null,
      faviconPath: null,
      iconPath: null,
      colorTokens: {},
    });
  });

  it("carrega somente a identidade publicada no overview administrativo", () => {
    const source = readFileSync(
      "supabase/functions/platform-admin/index.ts",
      "utf8",
    );

    expect(source).toContain('from("tenant_brand_settings")');
    expect(source).toContain('.not("published_at", "is", null)');
    expect(source).toContain("branding: {");
  });
});
