import { describe, expect, it } from "vitest";
import { defaultHearingFilters, filterHearings, paginateHearings } from "@/lib/hearing-filters";

const hearings = [
  { id: "past", tipo: "Conciliação", data_hora: "2026-09-04T12:00:00.000Z", status: "Realizada", processo_numero: "0001", court_code: "TJAM" },
  { id: "future", tipo: "Instrução", data_hora: "2026-09-06T12:00:00.000Z", status: "Agendada", cliente_nome: "Maria", court_code: "TJAM" },
  { id: "session", tipo: "Sessão de julgamento", data_hora: "2026-10-06T12:00:00.000Z", status: "Agendada", cliente_nome: "João", court_code: "TJGO" },
];

describe("filtros de audiências", () => {
  it("mostra por padrão todas as audiências e sessões futuras", () => {
    expect(filterHearings(hearings, defaultHearingFilters, new Date("2026-09-05T00:00:00.000Z")).map(item => item.id))
      .toEqual(["future", "session"]);
  });

  it("combina texto, tribunal e período sem misturar indícios", () => {
    expect(filterHearings(hearings, {
      ...defaultHearingFilters,
      query: "maria",
      court: "TJAM",
      period: "30",
    }, new Date("2026-09-05T00:00:00.000Z")).map(item => item.id)).toEqual(["future"]);
  });

  it("pagina 25 itens e corrige páginas fora do limite", () => {
    const result = paginateHearings(Array.from({ length: 51 }, (_, id) => id), 9, 25);
    expect(result).toMatchObject({ page: 3, totalPages: 3, total: 51 });
    expect(result.items).toHaveLength(1);
  });
});
