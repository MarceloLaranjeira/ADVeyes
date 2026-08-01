import { describe, expect, it } from "vitest";
import {
  ADVEYES_PRESET,
  ADVEYES_PRIMARY,
  BRAND_PRESETS,
  contrastWithWhite,
  presetForTokens,
  tokensFromPrimary,
} from "@/lib/brand-presets";
import { buildBrandCssVariables } from "@/lib/brand";

describe("presets de marca", () => {
  it("mantém o padrão da plataforma sem gravar cor alguma", () => {
    expect(ADVEYES_PRESET.tokens).toEqual({});
    expect(buildBrandCssVariables(ADVEYES_PRESET.tokens)).toEqual({});
  });

  it("reconhece o padrão quando o escritório não personalizou", () => {
    expect(presetForTokens({})?.id).toBe("adveyes");
    expect(presetForTokens(null)?.id).toBe("adveyes");
  });

  it("reconhece um preset já escolhido", () => {
    const bordo = BRAND_PRESETS.find((preset) => preset.id === "bordo");
    expect(presetForTokens(bordo!.tokens)?.id).toBe("bordo");
  });

  it("não associa cor livre a nenhum preset", () => {
    expect(presetForTokens(tokensFromPrimary("#123456"))).toBeNull();
  });

  it("gera variáveis CSS válidas a partir de uma cor escolhida", () => {
    const variables = buildBrandCssVariables(tokensFromPrimary("#6b1f2e"));
    expect(variables["--primary"]).toMatch(/^\d+ \d+% \d+%$/);
    expect(variables["--ring"]).toBe(variables["--primary"]);
  });
});

describe("contrastWithWhite", () => {
  it("aponta contraste insuficiente em cores claras", () => {
    const contrast = contrastWithWhite("#ffe600");
    expect(contrast).not.toBeNull();
    expect(contrast!).toBeLessThan(3);
  });

  it("aprova cores escuras usadas em botões", () => {
    expect(contrastWithWhite("#1a2a5e")!).toBeGreaterThan(3);
    expect(contrastWithWhite("#6b1f2e")!).toBeGreaterThan(3);
  });

  it("mantém o azul padrão acima do mínimo de componentes", () => {
    expect(contrastWithWhite(ADVEYES_PRIMARY)!).toBeGreaterThanOrEqual(3);
  });

  it("ignora valores que não são cor", () => {
    expect(contrastWithWhite("azul")).toBeNull();
  });
});
