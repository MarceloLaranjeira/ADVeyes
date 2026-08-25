import { describe, expect, it } from "vitest";
import { buildControladoria } from "@/services/controladoria";

const now = new Date(2026, 7, 25, 10, 0, 0);

function source(overrides: Record<string, unknown> = {}) {
  return {
    overdueCount: 1,
    todayCount: 3,
    nextSevenDaysCount: 8,
    withoutAcknowledgementCount: 5,
    withoutAssigneeCount: 2,
    deadlines: [
      { id: "d1", titulo: "Apelação", data_limite: "2026-08-24", status: "pendente", responsavel_id: "u1", processo_id: "p1" },
      { id: "d2", titulo: "Contestação", data_limite: "2026-08-25", status: "pendente", responsavel_id: null, processo_id: null },
    ],
    publications: [
      { id: "pub1", numero_processo: "0000777-88", cliente_nome: "Cliente", data_publicacao: "2026-08-23", tipo: "intimacao" },
    ],
    hearings: [
      { id: "h1", tipo: "Instrução", data_hora: "2026-08-25T14:30:00Z", processo_id: "p1", processo_numero: "0000555-11", cliente_nome: null, local: "2ª Vara" },
    ],
    protocolCount: 4,
    completedDeadlineCount: 7,
    members: [{ userId: "u1", name: "Dra. Ana" }],
    warnings: [],
    ...overrides,
  };
}

describe("buildControladoria", () => {
  it("repassa os contadores sem recontar", () => {
    expect(buildControladoria(source(), now).counters).toEqual({
      overdue: 1,
      today: 3,
      nextSevenDays: 8,
      withoutAcknowledgement: 5,
      withoutAssignee: 2,
    });
  });

  it("mistura prazos e intimações em uma lista ordenada por urgência", () => {
    const action = buildControladoria(source(), now).action;
    expect(action.map(item => item.id)).toEqual(["pub1", "d1", "d2"]);
    expect(action[0].kind).toBe("intimacao");
  });

  it("mostra o nome do responsável, não o identificador", () => {
    const action = buildControladoria(source(), now).action;
    expect(action.find(item => item.id === "d1")?.assigneeName).toBe("Dra. Ana");
    expect(action.find(item => item.id === "d2")?.assigneeName).toBeNull();
  });

  it("preserva os avisos de bloco que falhou", () => {
    const data = buildControladoria(source({ warnings: ["Movimentações: timeout"] }), now);
    expect(data.warnings).toEqual(["Movimentações: timeout"]);
  });
});
