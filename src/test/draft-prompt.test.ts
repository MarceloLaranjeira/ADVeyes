import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  nomeDaPeca,
  type ContextoMinuta,
} from "../../supabase/functions/_shared/draft-prompt.ts";

function contexto(over: Partial<ContextoMinuta> = {}): ContextoMinuta {
  return {
    tipo: "contestacao",
    numeroProcesso: "0186472-26.2026.8.04.1000",
    tribunal: "TJAM",
    vara: "9ª Vara Cível",
    parteAtiva: "Maria Arlete Viana de Oliveira",
    partePassiva: "Manaus Ambiental S.A",
    clienteRepresentado: "Manaus Ambiental S.A",
    atoOrigem: "Citada a parte ré para contestar no prazo de 15 dias.",
    andamentos: ["Juntada de AR positivo", "Distribuição por sorteio"],
    prazoFatal: "24/03/2026",
    orientacao: null,
    ...over,
  };
}

describe("instrução de sistema", () => {
  const system = buildSystemPrompt();

  // A invenção de precedente é o risco que já rendeu sanção a advogado.
  it("proíbe citar jurisprudência não fornecida", () => {
    expect(system).toMatch(/não cite jurisprudência/i);
    expect(system).toContain("[BUSCAR PRECEDENTE");
  });

  it("proíbe inventar fato, data, valor ou documento", () => {
    expect(system).toMatch(/não invente fato, data, valor/i);
    expect(system).toContain("[PREENCHER");
  });

  it("deixa claro que o texto é rascunho de responsabilidade humana", () => {
    expect(system).toMatch(/rascunho/i);
    expect(system).toMatch(/assinad[oa]|responde profissionalmente/i);
  });

  it("exige a seção de pontos de atenção", () => {
    expect(system).toContain("## Pontos de atenção");
  });
});

describe("pedido da minuta", () => {
  it("nomeia a peça pedida", () => {
    expect(buildUserPrompt(contexto())).toContain("Redija uma contestação.");
  });

  it("inclui identificação e ato de origem", () => {
    const prompt = buildUserPrompt(contexto());
    expect(prompt).toContain("0186472-26.2026.8.04.1000");
    expect(prompt).toContain("Manaus Ambiental S.A");
    expect(prompt).toContain("Citada a parte ré");
    expect(prompt).toContain("Juntada de AR positivo");
  });

  it("traz a estrutura própria do tipo de peça", () => {
    expect(buildUserPrompt(contexto({ tipo: "contestacao" })))
      .toContain("art. 341");
    expect(buildUserPrompt(contexto({ tipo: "embargos_declaracao" })))
      .toContain("art. 1.022");
  });

  // Campo vazio anunciado convida o modelo a preencher; ausência não.
  it("omite campos sem valor em vez de anunciá-los", () => {
    const prompt = buildUserPrompt(
      contexto({ vara: null, prazoFatal: null, tribunal: "   " }),
    );
    expect(prompt).not.toMatch(/Vara:/);
    expect(prompt).not.toMatch(/Prazo fatal:/);
    expect(prompt).not.toMatch(/Tribunal:/);
    expect(prompt).toContain("Processo:");
  });

  it("inclui a orientação do advogado quando existe", () => {
    const prompt = buildUserPrompt(
      contexto({ orientacao: "Sustentar prescrição trienal." }),
    );
    expect(prompt).toContain("## Orientação do advogado");
    expect(prompt).toContain("prescrição trienal");
  });

  it("omite a seção de orientação quando não há", () => {
    expect(buildUserPrompt(contexto())).not.toContain("Orientação do advogado");
  });

  // Sem material dos autos o risco de invenção é máximo.
  it("avisa explicitamente quando não há documento nenhum", () => {
    const prompt = buildUserPrompt(
      contexto({ atoOrigem: null, andamentos: [] }),
    );
    expect(prompt).toContain("Nenhum documento do processo foi fornecido");
    expect(prompt).toContain("[PREENCHER");
  });

  it("não emite o aviso quando há material", () => {
    expect(buildUserPrompt(contexto()))
      .not.toContain("Nenhum documento do processo foi fornecido");
  });

  it("descarta andamentos em branco", () => {
    const prompt = buildUserPrompt(
      contexto({ andamentos: ["  ", "", "Sentença publicada"] }),
    );
    expect(prompt).toContain("- Sentença publicada");
    expect(prompt.match(/^- /gm)).toHaveLength(1);
  });
});

describe("nomeDaPeca", () => {
  it("traduz todos os tipos", () => {
    const tipos = [
      "contestacao",
      "embargos_declaracao",
      "apelacao",
      "replica",
      "manifestacao",
      "peticao_simples",
    ] as const;
    for (const tipo of tipos) {
      expect(nomeDaPeca(tipo).length).toBeGreaterThan(0);
    }
  });
});
