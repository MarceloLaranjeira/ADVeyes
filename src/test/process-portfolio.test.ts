import { describe, expect, it } from "vitest";
import { summarizePortfolio } from "@/lib/process-portfolio";

const NOW = new Date("2026-10-19T12:00:00Z");

describe("summarizePortfolio", () => {
  const processes = [
    { area: "Cível", status: "Em andamento", updatedAt: "2026-10-01T00:00:00Z" },
    { area: "Cível", status: "arquivado", updatedAt: "2026-10-05T00:00:00Z" },
    { area: "Trabalhista", status: "Arquivado", updatedAt: "2026-10-06T00:00:00Z" },
    { area: "Cível", status: "arquivado", updatedAt: "2026-09-20T00:00:00Z" },
  ];

  it("conta ativos e encerramentos do mês com a variação", () => {
    const summary = summarizePortfolio(processes, [], NOW);
    expect(summary).toMatchObject({ active: 1, closedThisMonth: 2, closedPreviousMonth: 1, closedChangePct: 100 });
  });

  it("não calcula variação sem encerramentos no mês anterior", () => {
    expect(summarizePortfolio(processes.slice(0, 3), [], NOW).closedChangePct).toBeNull();
  });

  it("compara encerramentos do mês com as metas por área, sem diferenciar caixa", () => {
    const summary = summarizePortfolio(processes, [
      { nome: "cível", valor: 10 },
      { nome: "Penal", valor: 5 },
      { nome: "Sem valor", valor: null },
    ], NOW);
    expect(summary.goals).toEqual([
      { name: "cível", target: 10, closed: 1 },
      { name: "Penal", target: 5, closed: 0 },
    ]);
  });
});
