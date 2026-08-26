import { describe, expect, it } from "vitest";
import {
  aplicarRegraAoMotor,
  regraEfetiva,
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

  it("o Juizado Especial Criminal conta em dias corridos, não úteis", () => {
    // O JECrim casa com "juizado especial" e era classificado como Juizado
    // cível por um teste genérico posto antes do criminal. O resultado era
    // dias úteis num processo criminal — a data fatal esticada que o
    // resolver existe para evitar.
    const regra = resolverRegraContagem({
      area: "Penal",
      vara: "Juizado Especial Criminal da Comarca de Manaus",
    });
    expect(regra.modo).toBe("corridos");
    expect(regra.fonte).toBe("cpp");
    // Duas incertezas somadas: rito da Lei 9.099 e contagem criminal.
    expect(regra.confianca).toBe("baixa");
    expect(regra.aviso).toContain("Juizado");
  });

  it("Turma Recursal Criminal também conta em dias corridos", () => {
    const regra = resolverRegraContagem({
      vara: "Turma Recursal Criminal",
    });
    expect(regra.modo).toBe("corridos");
    expect(regra.fonte).toBe("cpp");
  });

  it("o Juizado cível segue em dias úteis, com confiança alta no criminal", () => {
    // Guarda contra a correção ter ido longe demais: Juizado sem qualquer
    // indício criminal continua sendo Juizado cível.
    const regra = resolverRegraContagem({
      area: "Cível",
      vara: "2º Juizado Especial Cível",
    });
    expect(regra.modo).toBe("uteis");
    expect(regra.fonte).toBe("jec");
  });

  it("penal fora do Juizado mantém confiança alta", () => {
    const regra = resolverRegraContagem({ area: "Penal", vara: "1ª Vara Criminal" });
    expect(regra.confianca).toBe("alta");
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

  it("trata 'A definir' como ramo não identificado", () => {
    // `confirm_legal_process_candidate` grava esse valor ao importar
    // processo automaticamente. Tratá-lo como ramo identificado devolvia
    // CPC com confiança alta e sem aviso — um processo criminal cuja vara
    // não diga "criminal" sairia em dias úteis sem nada sinalizando.
    const regra = resolverRegraContagem({ area: "A definir" });
    expect(regra.fonte).toBe("padrao");
    expect(regra.confianca).toBe("baixa");
    expect(regra.aviso).toBeTruthy();
  });

  it("outros preenchimentos vazios também caem no padrão avisado", () => {
    for (const area of ["a identificar", "Não informado", "Outro", "-"]) {
      const regra = resolverRegraContagem({ area });
      expect(regra.confianca).toBe("baixa");
    }
  });

  it("o placeholder não impede a detecção pelo juízo", () => {
    // Área vazia mas vara criminal: o ramo ainda é identificável.
    const regra = resolverRegraContagem({
      area: "A definir",
      vara: "2ª Vara Criminal",
    });
    expect(regra.fonte).toBe("cpp");
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

describe("siglas compactas de tribunal", () => {
  it("reconhece TRT com número colado", () => {
    // O dígito é caractere de palavra, então `\btrt\b` não casa com
    // "TRT11" — e é esse o formato que a tela de configurações oferece.
    for (const tribunal of ["TRT11", "TRT2", "TRT 15"]) {
      const regra = resolverRegraContagem({ area: "A definir", tribunal });
      expect(regra.fonte).toBe("clt");
    }
  });

  it("não confunde outra sigla que comece com as mesmas letras", () => {
    const regra = resolverRegraContagem({ area: "Cível", tribunal: "TJAM" });
    expect(regra.fonte).toBe("cpc");
  });
});

describe("regraEfetiva", () => {
  const penal = resolverRegraContagem({ area: "Penal" });

  it("o ato vence o ramo na trilha exibida", () => {
    // Publicação criminal dizendo "5 dias úteis": a contagem sai em dias
    // úteis, então mostrar "CPP, prazos contínuos" seria contraditório.
    const efetiva = regraEfetiva(penal, "uteis", undefined);
    expect(efetiva.modo).toBe("uteis");
    expect(efetiva.fonte).toBe("ato");
    expect(efetiva.fundamento).not.toContain("798");
  });

  it("o advogado vence o ato e o ramo", () => {
    const efetiva = regraEfetiva(penal, "uteis", true);
    expect(efetiva.modo).toBe("corridos");
    expect(efetiva.fonte).toBe("manual");
  });

  it("sem ato nem override, devolve a própria regra do ramo", () => {
    expect(regraEfetiva(penal, null, undefined)).toBe(penal);
  });
});
