import { describe, expect, it } from "vitest";
import { extractDeadline } from "../../supabase/functions/_shared/deadline-extraction.ts";

describe("extractDeadline — prazo explícito", () => {
  it("lê o prazo escrito em algarismo", () => {
    const result = extractDeadline(
      "Fica a parte intimada para, no prazo de 15 dias, apresentar manifestação.",
    );
    expect(result.dias).toBe(15);
    expect(result.confianca).toBe("explicito");
    expect(result.diasCorridos).toBe(false);
  });

  it("lê o prazo com o extenso entre parênteses", () => {
    const result = extractDeadline(
      "Intime-se para, no prazo de 5 (cinco) dias, sanar o vício.",
    );
    expect(result.dias).toBe(5);
    expect(result.confianca).toBe("explicito");
    expect(result.alertas).toHaveLength(0);
  });

  it("acusa divergência entre algarismo e extenso", () => {
    const result = extractDeadline(
      "Manifeste-se no prazo de 15 (cinco) dias.",
    );
    expect(result.dias).toBe(15);
    expect(result.alertas.join(" ")).toContain("por extenso");
  });

  it("reconhece prazo em dias corridos", () => {
    const result = extractDeadline(
      "Recolha as custas no prazo de 30 dias corridos.",
    );
    expect(result.dias).toBe(30);
    expect(result.diasCorridos).toBe(true);
  });

  it("lê o número escrito somente por extenso", () => {
    const result = extractDeadline(
      "Apresente contrarrazões no prazo de quinze dias.",
    );
    expect(result.dias).toBe(15);
    expect(result.confianca).toBe("explicito");
  });

  it("funciona com o texto acentuado e em caixa alta", () => {
    const result = extractDeadline(
      "PRAZO DE 10 DIAS ÚTEIS PARA MANIFESTAÇÃO DA PARTE AUTORA.",
    );
    expect(result.dias).toBe(10);
    expect(result.confianca).toBe("explicito");
  });
});

describe("extractDeadline — prazo inferido do ato", () => {
  it("aplica cinco dias aos embargos de declaração", () => {
    const result = extractDeadline(
      "Intimada a parte da oposição de embargos de declaração pela ré.",
    );
    expect(result.dias).toBe(5);
    expect(result.confianca).toBe("inferido");
    expect(result.ato).toBe("Embargos de declaração");
    expect(result.fundamento).toContain("art. 1.023");
  });

  it("aplica quinze dias à contestação", () => {
    const result = extractDeadline("Citada a parte ré para contestação.");
    expect(result.dias).toBe(15);
    expect(result.ato).toBe("Contestação");
    expect(result.fundamento).toContain("art. 335");
  });

  it("avisa que o prazo não veio do texto", () => {
    const result = extractDeadline("Apresente apelação da sentença.");
    expect(result.confianca).toBe("inferido");
    expect(result.alertas.join(" ")).toContain("não estava escrito");
  });

  it("dá precedência ao prazo explícito sobre o prazo legal do ato", () => {
    const result = extractDeadline(
      "Apresente contestação no prazo de 30 dias, na forma do acordo.",
    );
    expect(result.dias).toBe(30);
    expect(result.confianca).toBe("explicito");
    expect(result.ato).toBe("Contestação");
  });
});

describe("extractDeadline — regra residual", () => {
  it("cai no art. 218, §3 quando nada é reconhecido", () => {
    const result = extractDeadline("Publique-se. Cumpra-se. Intimem-se.");
    expect(result.dias).toBe(5);
    expect(result.confianca).toBe("residual");
    expect(result.fundamento).toContain("art. 218");
    expect(result.alertas.join(" ")).toContain("ponto de partida");
  });

  it("nunca devolve prazo zero ou negativo", () => {
    for (const texto of ["", "   ", "Nada aqui.", "prazo de 0 dias"]) {
      expect(extractDeadline(texto).dias).toBeGreaterThan(0);
    }
  });
});

describe("extractDeadline — alertas de conferência", () => {
  it("avisa sobre prazo em dobro da Fazenda Pública", () => {
    const result = extractDeadline(
      "Intimada a Fazenda Pública para manifestação no prazo de 15 dias.",
    );
    expect(result.alertas.join(" ")).toContain("art. 183");
  });

  it("avisa sobre o Ministério Público", () => {
    const result = extractDeadline(
      "Vista ao Ministério Público no prazo de 10 dias.",
    );
    expect(result.alertas.join(" ")).toContain("art. 180");
  });

  it("avisa sobre litisconsórcio", () => {
    const result = extractDeadline(
      "Intimados os litisconsortes no prazo de 15 dias.",
    );
    expect(result.alertas.join(" ")).toContain("art. 229");
  });

  it("avisa sobre intimação pessoal", () => {
    const result = extractDeadline(
      "Determino a intimação pessoal da parte no prazo de 5 dias.",
    );
    expect(result.alertas.join(" ")).toContain("termo inicial");
  });

  it("não inventa alerta quando o texto é limpo", () => {
    const result = extractDeadline(
      "Manifeste-se a parte autora no prazo de 15 dias.",
    );
    expect(result.alertas).toHaveLength(0);
  });
});
