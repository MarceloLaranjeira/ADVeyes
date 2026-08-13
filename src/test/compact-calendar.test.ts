import { describe, expect, it } from "vitest";
import {
  buildAgendaUrl,
  groupOperationalItemsByDay,
  parseAgendaDate,
} from "@/lib/compact-calendar";
import type { OperationalCalendarItem } from "@/types/operational-calendar";

function item(
  id: string,
  date: string,
  sourceType: OperationalCalendarItem["sourceType"] = "event",
): OperationalCalendarItem {
  return {
    id,
    sourceId: id,
    sourceType,
    date,
    title: id,
    description: null,
    assigneeId: null,
    processId: null,
    processNumber: null,
    status: null,
    priority: null,
    location: null,
  };
}

describe("compact calendar", () => {
  it("agrupa por dia e ordena os itens por horário", () => {
    const grouped = groupOperationalItemsByDay([
      item("tarde", "2026-08-08T16:00:00"),
      item("manha", "2026-08-08T08:30:00"),
      item("outro-dia", "2026-08-09T09:00:00", "hearing"),
    ]);

    expect(grouped["2026-08-08"].map(entry => entry.id)).toEqual(["manha", "tarde"]);
    expect(grouped["2026-08-09"][0].sourceType).toBe("hearing");
  });

  it("aceita somente datas completas e válidas na Agenda", () => {
    expect(parseAgendaDate("2026-08-08")).toBeInstanceOf(Date);
    expect(parseAgendaDate("2026-02-30")).toBeNull();
    expect(parseAgendaDate("08/08/2026")).toBeNull();
    expect(parseAgendaDate(null)).toBeNull();
  });

  it("monta uma URL estável com a data selecionada", () => {
    expect(buildAgendaUrl(new Date(2026, 7, 8, 12))).toBe("/agenda?date=2026-08-08");
  });
});
