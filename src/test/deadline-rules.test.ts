import { describe, expect, it } from "vitest";
import {
  aplicarRegraAoMotor,
  resolverRegraContagem,
} from "../../supabase/functions/_shared/deadline-rules.ts";
import { extractDeadline } from "../../supabase/functions/_shared/deadline-extraction.ts";

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
  const civel = resolverRegraContagem({ area: "Cível" });
  const penal = resolverRegraContagem({ area: "Penal" });

  it('"dias corridos" no ato vence a dedução por ramo', () => {
    expect(aplicarRegraAoMotor(civel, "corridos")).toBe(true);
  });

  it('"dias úteis" no ato vence a regra do penal', () => {
    // O caso que o booleano sozinho não distinguia: num processo criminal
    // com "prazo de 5 dias úteis" determinado pelo juiz, o CPP diria
    // corridos, mas o que foi expressamente ordenado são dias úteis.
    expect(aplicarRegraAoMotor(penal, "uteis")).toBe(false);
  });

  it("o ramo penal impõe dias corridos quando o ato cala", () => {
    expect(aplicarRegraAoMotor(penal, null)).toBe(true);
  });

  it("cível sem qualificador no ato segue em dias úteis", () => {
    expect(aplicarRegraAoMotor(civel, null)).toBe(false);
  });
});

describe("qualificador da publicação ponta a ponta", () => {
  it('lê "dias úteis" do ato e impede que o penal vire dias corridos', () => {
    const leitura = extractDeadline(
      "Fica o réu intimado para manifestar-se no prazo de 5 dias úteis.",
    );
    expect(leitura.qualificadorExplicito).toBe("uteis");

    const penal = resolverRegraContagem({ area: "Penal" });
    expect(aplicarRegraAoMotor(penal, leitura.qualificadorExplicito))
      .toBe(false);
  });

  it('lê "dias corridos" do ato', () => {
    const leitura = extractDeadline("Manifeste-se no prazo de 10 dias corridos.");
    expect(leitura.qualificadorExplicito).toBe("corridos");
  });

  it("distingue ausência de qualificador de qualificador útil", () => {
    const leitura = extractDeadline("Manifeste-se no prazo de 15 dias.");
    expect(leitura.qualificadorExplicito).toBeNull();
    expect(leitura.diasCorridos).toBe(false);

    // Sem qualificador, o ramo decide — e no penal isso significa corridos.
    const penal = resolverRegraContagem({ area: "Penal" });
    expect(aplicarRegraAoMotor(penal, leitura.qualificadorExplicito)).toBe(true);
  });
});
