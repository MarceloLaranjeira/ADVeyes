import { describe, expect, it } from "vitest";
import {
  calculateActivityMetrics,
  canTransitionActivityStatus,
  classifyActivityDueDate,
  isActivityStatus,
} from "@/lib/activity-status";
import type { Activity } from "@/types/activities";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    categoria: null,
    concluida_em: null,
    created_at: "2026-08-01T12:00:00Z",
    data_limite: null,
    descricao: null,
    google_event_id: null,
    id: crypto.randomUUID(),
    pontos: 0,
    prioridade: "média",
    processo_id: null,
    responsavel_id: null,
    status: "pendente",
    tenant_id: "83100000-0000-0000-0000-000000000001",
    titulo: "Tarefa",
    updated_at: "2026-08-01T12:00:00Z",
    user_id: "83000000-0000-0000-0000-000000000001",
    ...overrides,
  };
}

describe("activity status", () => {
  it("reconhece apenas os status operacionais", () => {
    expect(isActivityStatus("pendente")).toBe(true);
    expect(isActivityStatus("em_andamento")).toBe(true);
    expect(isActivityStatus("concluída")).toBe(true);
    expect(isActivityStatus("arquivada")).toBe(false);
  });

  it("permite mover e reabrir tarefas", () => {
    expect(canTransitionActivityStatus("pendente", "em_andamento")).toBe(true);
    expect(canTransitionActivityStatus("concluída", "pendente")).toBe(true);
    expect(canTransitionActivityStatus("em_andamento", "em_andamento")).toBe(true);
  });
});

describe("activity deadlines", () => {
  const now = new Date(2026, 7, 8, 18, 30);

  it("classifica datas sem sofrer deslocamento de fuso", () => {
    expect(classifyActivityDueDate("2026-08-07", now)).toMatchObject({
      kind: "overdue",
      days: -1,
      urgent: true,
    });
    expect(classifyActivityDueDate("2026-08-08", now).kind).toBe("today");
    expect(classifyActivityDueDate("2026-08-09", now).kind).toBe("tomorrow");
    expect(classifyActivityDueDate("2026-08-14", now).kind).toBe("upcoming");
    expect(classifyActivityDueDate("2026-08-20", now).kind).toBe("future");
  });

  it("trata ausência e data inválida como sem prazo", () => {
    expect(classifyActivityDueDate(null, now).kind).toBe("none");
    expect(classifyActivityDueDate("2026-02-31", now).kind).toBe("none");
  });
});

describe("activity metrics", () => {
  it("conta filas, atrasos e apenas pontos de conclusões persistidas", () => {
    const metrics = calculateActivityMetrics(
      [
        activity({ status: "pendente", data_limite: "2026-08-07" }),
        activity({ status: "em_andamento", data_limite: "2026-08-20" }),
        activity({
          status: "concluída",
          concluida_em: "2026-08-08T15:00:00Z",
          pontos: 8,
        }),
        activity({ status: "concluída", concluida_em: null, pontos: 13 }),
      ],
      new Date(2026, 7, 8, 18, 30),
    );

    expect(metrics).toEqual({
      total: 4,
      pending: 1,
      inProgress: 1,
      completed: 2,
      overdue: 1,
      completedPoints: 8,
    });
  });
});
