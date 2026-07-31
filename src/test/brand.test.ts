import { beforeEach, describe, expect, it } from "vitest";
import {
  applyBrandToDocument,
  buildBrandCssVariables,
  hexToHslTriplet,
  resolveBrandAssetUrl,
  resolveBranding,
} from "@/lib/brand";

describe("brand", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <title>ADVeyes</title>
      <meta name="application-name" content="ADVeyes" />
      <meta name="apple-mobile-web-app-title" content="ADVeyes" />
      <meta name="theme-color" content="#288fe0" />
      <link rel="icon" href="/logo.svg" data-brand-favicon />
    `;
    document.documentElement.removeAttribute("style");
    delete document.documentElement.dataset.tenantBrand;
    delete document.documentElement.dataset.brandReady;
  });

  it("converte cores hexadecimais para o formato usado pelos tokens CSS", () => {
    expect(hexToHslTriplet("#288fe0")).toBe("206 75% 52%");
    expect(hexToHslTriplet("#fff")).toBe("0 0% 100%");
  });

  it("aceita somente tokens de marca permitidos e cores seguras", () => {
    expect(
      buildBrandCssVariables({
        primary: "#123456",
        accentForeground: "0 0% 100%",
        background: "#000000",
        ring: "url(https://evil.example/x)",
      }),
    ).toEqual({
      "--primary": "210 65% 20%",
      "--accent-foreground": "0 0% 100%",
    });
  });

  it("rejeita protocolos inseguros e caminhos relativos ambíguos", () => {
    expect(resolveBrandAssetUrl("javascript:alert(1)")).toBeNull();
    expect(resolveBrandAssetUrl("//evil.example/logo.svg")).toBeNull();
    expect(resolveBrandAssetUrl("branding/logo.svg")).toBeNull();
    expect(resolveBrandAssetUrl("/branding/logo.svg")).toBe(
      "/branding/logo.svg",
    );
    expect(resolveBrandAssetUrl("https://cdn.example/logo.svg")).toBe(
      "https://cdn.example/logo.svg",
    );
  });

  it("normaliza campos vazios e mantém o fallback ADVeyes", () => {
    const brand = resolveBranding({
      publicName: "   ",
      shortName: "",
      logoLightPath: "javascript:alert(1)",
      logoDarkPath: null,
      faviconPath: null,
      iconPath: null,
      colorTokens: {},
    });

    expect(brand.publicName).toBe("ADVeyes");
    expect(brand.shortName).toBe("ADVeyes");
    expect(brand.logoLightPath).toBeNull();
    expect(brand.faviconPath).toBe("/logo.svg");
  });

  it("aplica e limpa a marca sem deixar tokens de outro tenant", () => {
    const brand = resolveBranding({
      publicName: "Escritório Exemplo",
      shortName: "Exemplo",
      logoLightPath: null,
      logoDarkPath: null,
      faviconPath: "/exemplo.svg",
      iconPath: null,
      colorTokens: { primary: "#123456" },
    });

    const cleanup = applyBrandToDocument(document, brand);

    expect(document.title).toBe("Escritório Exemplo — Gestão Jurídica");
    expect(
      document.documentElement.style.getPropertyValue("--primary"),
    ).toBe("210 65% 20%");
    expect(document.documentElement.dataset.tenantBrand).toBe("Exemplo");
    expect(document.documentElement.dataset.brandReady).toBe("true");

    cleanup();

    expect(document.title).toBe("ADVeyes");
    expect(
      document.documentElement.style.getPropertyValue("--primary"),
    ).toBe("");
    expect(document.documentElement.dataset.tenantBrand).toBeUndefined();
  });
});
