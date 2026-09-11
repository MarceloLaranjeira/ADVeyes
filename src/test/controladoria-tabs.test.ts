import { describe, expect, it } from "vitest";
import { normalizeTabQuery, type TabQuery } from "@/services/controladoria-tabs";

function query(overrides: Partial<TabQuery> = {}): TabQuery {
  return { tenantId: "tenant-1", page: 1, pageSize: 20, assigneeId: null, status: null, processId: null, from: null, to: null, ...overrides };
}

describe("normalizeTabQuery", () => {
  it("traduz a primeira página para o intervalo inclusivo", () => {
    expect(normalizeTabQuery(query()).range).toEqual([0, 19]);
  });

  it("traduz a terceira página para o intervalo correto", () => {
    expect(normalizeTabQuery(query({ page: 3 })).range).toEqual([40, 59]);
  });

  it("volta o tamanho inválido para vinte", () => {
    expect(normalizeTabQuery(query({ pageSize: 99 }))).toMatchObject({ pageSize: 20, range: [0, 19] });
  });

  it("preserva filtros explícitos", () => {
    expect(normalizeTabQuery(query({ assigneeId: "u1", status: "pendente", processId: "p1", from: "2026-08-01", to: "2026-08-31" }))).toMatchObject({ assigneeId: "u1", status: "pendente", processId: "p1", from: "2026-08-01", to: "2026-08-31" });
  });
});
