import { describe, expect, it } from "vitest";
import { agendaRouteParams, agendaVisibleRange, filterOperationalCalendar, findCalendarConflicts, isCalendarItemUrgent, parseAgendaRoute } from "@/lib/agenda-calendar";
import type { OperationalCalendarItem } from "@/types/operational-calendar";

function item(overrides: Partial<OperationalCalendarItem> = {}): OperationalCalendarItem {
  return {
    id: "event:1",
    sourceType: "event",
    sourceId: "1",
    date: "2026-08-13T09:00:00",
    endDate: "2026-08-13T10:00:00",
    title: "Reunião com cliente",
    description: null,
    type: "reunião",
    assigneeId: "user-1",
    processId: "process-1",
    processNumber: "0001",
    clientName: "Maria",
    status: null,
    priority: null,
    location: "Escritório",
    googleEventId: null,
    ...overrides,
  };
}

describe("agenda calendar", () => {
  it("interpreta rota válida e aplica padrões seguros", () => {
    const parsed = parseAgendaRoute(new URLSearchParams("date=2026-08-13&view=week&scope=mine&source=task&q=peticao"), "office", new Date(2026, 0, 1));
    expect(parsed).toMatchObject({ view: "week", scope: "mine", filters: { sourceType: "task", query: "peticao" } });
    expect(parseAgendaRoute(new URLSearchParams("date=invalida&view=grade"), "office", new Date(2026, 0, 1))).toMatchObject({ view: "month", scope: "office" });
  });

  it("serializa filtros relevantes sem parâmetros vazios", () => {
    const params = agendaRouteParams({ date: new Date(2026, 7, 13, 12), view: "list", scope: "office", filters: { sourceType: "hearing", processId: "p1", clientName: "Maria", query: " teste " } });
    expect(params.get("date")).toBe("2026-08-13");
    expect(params.get("process")).toBe("p1");
    expect(params.get("client")).toBe("Maria");
    expect(params.get("q")).toBe("teste");
    expect(params.has("status")).toBe(false);
  });

  it("calcula intervalos fechados para mês, semana, dia e lista", () => {
    const date = new Date(2026, 7, 13, 12);
    expect(agendaVisibleRange(date, "month").from.getDay()).toBe(1);
    expect(agendaVisibleRange(date, "week").to.getDay()).toBe(0);
    expect(agendaVisibleRange(date, "day").from.getHours()).toBe(0);
    expect(agendaVisibleRange(date, "list").to.getDate()).toBe(12);
  });

  it("combina origem, responsável, processo, cliente, tipo, status e busca", () => {
    const items = [item(), item({ id: "task:2", sourceType: "task", type: "petição", status: "pendente", assigneeId: "user-2", clientName: "João", title: "Protocolar defesa" })];
    expect(filterOperationalCalendar(items, { assigneeId: "user-2", sourceType: "task", itemType: "petição", status: "pendente", clientName: "João", query: "defesa" })).toEqual([items[1]]);
    expect(filterOperationalCalendar(items, { processId: "process-1", query: "maria" })).toHaveLength(1);
  });

  it("detecta somente sobreposições do mesmo responsável", () => {
    const items = [item(), item({ id: "hearing:2", sourceType: "hearing", date: "2026-08-13T09:30:00", endDate: null }), item({ id: "event:3", sourceId: "3", assigneeId: "user-2", date: "2026-08-13T09:15:00" })];
    expect(findCalendarConflicts(items)).toHaveLength(1);
    expect(findCalendarConflicts(items)[0].items.map(value => value.id)).toEqual(["event:1", "hearing:2"]);
  });

  it("classifica tarefa vencida ou próxima como urgente", () => {
    expect(isCalendarItemUrgent(item({ sourceType: "task", date: "2026-08-12T12:00:00", status: "pendente" }), new Date(2026, 7, 13))).toBe(true);
    expect(isCalendarItemUrgent(item({ sourceType: "task", date: "2026-08-12T12:00:00", status: "concluída" }), new Date(2026, 7, 13))).toBe(false);
  });
});

