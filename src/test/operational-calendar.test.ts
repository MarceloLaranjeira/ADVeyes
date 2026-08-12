import { describe, expect, it } from "vitest";
import { normalizeOperationalCalendar } from "@/services/operational-calendar";
import type {
  CalendarEvent,
  CalendarHearing,
  CalendarTask,
} from "@/types/operational-calendar";

describe("normalizeOperationalCalendar", () => {
  it("une fontes sem perder identidade, responsável ou processo", () => {
    const items = normalizeOperationalCalendar(
      [{
        id: "event-1",
        titulo: "Reunião com cliente",
        descricao: null,
        data_inicio: "2026-08-10T09:00:00",
        local: "Escritório",
        user_id: "user-1",
      } as CalendarEvent],
      [{
        id: "task-1",
        titulo: "Protocolar manifestação",
        descricao: null,
        data_limite: "2026-08-09",
        created_at: "2026-08-08T12:00:00Z",
        responsavel_id: "user-2",
        processo_id: "process-1",
        status: "pendente",
        prioridade: "alta",
      } as CalendarTask],
      [{
        id: "hearing-1",
        tipo: "Audiência de instrução",
        data_hora: "2026-08-11T14:00:00",
        observacoes: null,
        user_id: "user-3",
        processo_id: "process-2",
        status: "agendada",
        local: null,
        vara: "2ª Vara",
        processos: { numero: "0000000-00.2026.8.04.0001", cliente_nome: "Cliente" },
      } as unknown as CalendarHearing],
    );

    expect(items.map(item => item.sourceType)).toEqual(["task", "event", "hearing"]);
    expect(items[0]).toMatchObject({
      id: "task:task-1",
      sourceId: "task-1",
      assigneeId: "user-2",
      processId: "process-1",
    });
    expect(items[2]).toMatchObject({
      assigneeId: "user-3",
      processNumber: "0000000-00.2026.8.04.0001",
      location: "2ª Vara",
    });
  });
});
