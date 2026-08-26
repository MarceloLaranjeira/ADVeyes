import { describe, expect, it } from "vitest";
import {
  aplicarRegraAoMotor,
  resolverRegraContagem,
} from "../../supabase/functions/_shared/deadline-rules.ts";

describe("resolverRegraContagem", () => {
  it("conta prazo criminal em dias corridos pelo art. 798 do CPP", () => {
    const regra = resolverRegraContagem({ area: "Penal" });
    expect(regra.modo).toBe("corridos");
    expect(regra.fonte).toBe("cpp");
    expect(regra.fundamento).toContain("798");
  });

  it("reconhece o ramo criminal pela vara quando a área não ajuda", () => {
    const regra = resolverRegraContagem({
      area: "",
      vara: "2ª Vara Criminal da Comarca de Manaus",
    });
    expect(regra.modo).toBe("corridos");
    expect(regra.fonte).toBe("cpp");
  });

  it("trata execução penal como prazo contínuo", () => {
    expect(resolverRegraContagem({ area: "Execução Penal" }).modo)
      .toBe("corridos");
  });

  it("fundamenta o trabalhista na CLT, não no CPC", () => {
    const regra = resolverRegraContagem({ area: "Trabalhista" });
    expect(regra.modo).toBe("uteis");
    expect(regra.fonte).toBe("clt");
    expect(regra.fundamento).toContain("775");
    expect(regra.fundamento).not.toContain("219");
  });

  it("reconhece o trabalhista pela vara do trabalho", () => {
    const regra = resolverRegraContagem({
      area: "Cível",
      vara: "3ª Vara do Trabalho de Belém",
    });
    expect(regra.fonte).toBe("clt");
  });

  it("marca Juizado Especial com confiança baixa e aviso", () => {
    const regra = resolverRegraContagem({
      area: "Cível",
      vara: "1º Juizado Especial Cível",
    });
    expect(regra.fonte).toBe("jec");
    expect(regra.confianca).toBe("baixa");
    expect(regra.aviso).toBeTruthy();
  });

  it("o Juizado vence o cível comum, senão a controvérsia some", () => {
    // Um processo cível que corre no Juizado seria classificado como cível
    // comum por qualquer regra posterior — e sairia com confiança alta.
    const regra = resolverRegraContagem({
      area: "Cível",
      vara: "Turma Recursal dos Juizados Especiais",
    });
    expect(regra.fonte).toBe("jec");
    expect(regra.confianca).toBe("baixa");
  });

  it("aplica o CPC ao cível com confiança alta", () => {
    const regra = resolverRegraContagem({ area: "Cível" });
    expect(regra.modo).toBe("uteis");
    expect(regra.fonte).toBe("cpc");
    expect(regra.confianca).toBe("alta");
    expect(regra.aviso).toBeUndefined();
  });

  it("ignora acento e caixa da área digitada à mão", () => {
    expect(resolverRegraContagem({ area: "CÍVEL" }).fonte).toBe("cpc");
    expect(resolverRegraContagem({ area: "civel" }).fonte).toBe("cpc");
    expect(resolverRegraContagem({ area: "Execução Penal" }).fonte).toBe("cpp");
    expect(resolverRegraContagem({ area: "execucao penal" }).fonte).toBe("cpp");
  });

  it("sem ramo identificado, avisa que o padrão foi palpite", () => {
    const regra = resolverRegraContagem({});
    expect(regra.modo).toBe("uteis");
    expect(regra.fonte).toBe("padrao");
    expect(regra.confianca).toBe("baixa");
    expect(regra.aviso).toBeTruthy();
  });
});

describe("aplicarRegraAoMotor", () => {
  it("o texto da publicação vence a dedução por ramo", () => {
    const civel = resolverRegraContagem({ area: "Cível" });
    // A publicação disse "dias corridos" com todas as letras.
    expect(aplicarRegraAoMotor(civel, true)).toBe(true);
  });

  it("o ramo penal impõe dias corridos sem o texto pedir", () => {
    const penal = resolverRegraContagem({ area: "Penal" });
    expect(aplicarRegraAoMotor(penal, false)).toBe(true);
  });

  it("cível sem menção no texto segue em dias úteis", () => {
    const civel = resolverRegraContagem({ area: "Cível" });
    expect(aplicarRegraAoMotor(civel, false)).toBe(false);
  });
});
