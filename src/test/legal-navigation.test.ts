import { describe, expect, it } from "vitest";
import { legalOriginPath, legacyProcessSearchTarget } from "@/lib/legal-navigation";

describe("destinos dos cards jurídicos", () => {
  it("abre cada registro no ambiente interno responsável", () => {
    expect(legalOriginPath({ kind: "processo", id: "p-1" })).toBe("/processos/p-1");
    expect(legalOriginPath({ kind: "prazo", id: "t-1" })).toBe("/controladoria?aba=prazos&focus=t-1");
    expect(legalOriginPath({ kind: "intimacao", id: "i-1" })).toBe("/intimacoes?focus=i-1");
    expect(legalOriginPath({ kind: "audiencia", id: "a-1" })).toBe("/audiencias?focus=a-1");
    expect(legalOriginPath({ kind: "andamento", id: "m-1", processId: "p-1" }))
      .toBe("/processos/p-1?tab=andamentos&focus=m-1");
  });

  it("usa a Central filtrada quando falta o identificador do detalhe", () => {
    expect(legalOriginPath({ kind: "processo", number: "0001234-56.2026.8.04.0001" }))
      .toBe("/processos?q=0001234-56.2026.8.04.0001");
    expect(legalOriginPath({ kind: "andamento", id: "m-1", processNumber: "0009" }))
      .toBe("/processos?q=0009");
  });

  it("migra links antigos da busca para a consulta oficial da Central", () => {
    expect(legacyProcessSearchTarget("?numero=0001234&tribunal=tjam"))
      .toBe("/processos?tribunal=tjam&q=0001234&tab=consulta");
    expect(legacyProcessSearchTarget("?q=Silva"))
      .toBe("/processos?q=Silva&tab=consulta");
  });
});
