import { describe, expect, it } from "vitest";
import { hearingFacts } from "@/lib/hearing-facts";

describe("hearingFacts", () => {
  it("monta etiquetas de sessão virtual criminal com apelação", () => {
    const facts = hearingFacts({
      tipo: "Sessão virtual de julgamento",
      vara: "Câmara Criminal em Composição Reduzida",
      modality: "remote",
      observacoes: [
        "Importada da agenda autenticada do Projudi/TJAM.",
        "Recurso: Apelação",
        "Classe: Apelação Criminal",
        "Matéria: Câmaras Criminais",
        "Assunto: Tráfico de Drogas e Condutas Afins",
      ].join("\n"),
    });
    expect(facts.badges).toEqual(["Sessão virtual de julgamento", "Criminal", "Apelação"]);
    expect(facts.details).toEqual([
      { label: "Recurso", value: "Apelação" },
      { label: "Classe", value: "Apelação Criminal" },
      { label: "Matéria", value: "Câmaras Criminais" },
      { label: "Assunto", value: "Tráfico de Drogas e Condutas Afins" },
    ]);
  });

  it("acrescenta Virtual quando só a modalidade indica", () => {
    expect(hearingFacts({ tipo: "Audiência", modality: "remote" }).badges).toEqual(["Audiência", "Virtual"]);
  });

  it("não inventa ramo nem recurso e ignora linhas sem rótulo conhecido", () => {
    const facts = hearingFacts({ tipo: "Una", observacoes: "Observação livre: algo\nOutra linha" });
    expect(facts.badges).toEqual(["Una"]);
    expect(facts.details).toEqual([]);
  });
});
