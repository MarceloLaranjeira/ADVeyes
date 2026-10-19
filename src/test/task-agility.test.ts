import { describe, expect, it } from "vitest";
import {
  managementRows,
  summarizeAgility,
  type AgilityTask,
} from "@/lib/task-agility";

const NOW = Date.parse("2026-10-20T00:00:00Z");

const task = (over: Partial<AgilityTask>): AgilityTask => ({
  titulo: "Petição", status: "pendente", data_limite: null, concluida_em: null,
  created_at: "2026-10-10T00:00:00Z", pontos: 2, assignee: "Ana", responsavel_id: "u1", ...over,
});

describe("summarizeAgility", () => {
  it("separa em dia, em atraso e pendentes", () => {
    const summary = summarizeAgility([
      task({ status: "concluída", data_limite: "2026-10-15T00:00:00Z", concluida_em: "2026-10-14T00:00:00Z" }),
      task({ status: "concluída", data_limite: "2026-10-12T00:00:00Z", concluida_em: "2026-10-14T00:00:00Z" }),
      task({ data_limite: "2026-10-18T00:00:00Z" }),
      task({ data_limite: "2026-10-25T00:00:00Z" }),
    ], NOW);
    expect(summary).toMatchObject({ onTime: 1, late: 2, pending: 2 });
    expect(summary.avgDaysOnTime).toBe(4);
  });

  it("calcula a média de atraso e ranqueia por tarefa e pessoa", () => {
    const summary = summarizeAgility([
      task({ titulo: "Recurso", assignee: "Bia", data_limite: "2026-10-18T00:00:00Z" }),
      task({ titulo: "Recurso", assignee: "Bia", data_limite: "2026-10-16T00:00:00Z" }),
      task({ titulo: "Contato", assignee: null, responsavel_id: null, data_limite: "2026-10-19T00:00:00Z" }),
    ], NOW);
    expect(summary.avgDaysLate).toBe(2.3);
    expect(summary.topLateTasks[0]).toEqual({ name: "Recurso", count: 2 });
    expect(summary.topLatePeople.map((p) => p.name)).toEqual(["Bia", "Sem responsável"]);
  });

  it("ignora tarefas sem prazo e lista vazia", () => {
    expect(summarizeAgility([task({})], NOW).late).toBe(0);
    expect(summarizeAgility([], NOW)).toMatchObject({ onTime: 0, late: 0, pending: 0, avgDaysLate: null });
  });
});

describe("managementRows", () => {
  it("lista só concluídas, filtra por pessoa e ordena pela conclusão", () => {
    const rows = managementRows([
      task({ status: "concluída", concluida_em: "2026-10-12T00:00:00Z", assignee: "Ana" }),
      task({ status: "concluída", concluida_em: "2026-10-14T00:00:00Z", assignee: "Ana", titulo: "B" }),
      task({ status: "concluída", concluida_em: "2026-10-13T00:00:00Z", assignee: "Bia" }),
      task({ status: "pendente" }),
    ], "Ana");
    expect(rows.map((r) => r.task)).toEqual(["B", "Petição"]);
  });
});
