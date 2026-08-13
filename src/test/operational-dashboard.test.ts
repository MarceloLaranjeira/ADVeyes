import { describe, expect, it } from "vitest";
import { buildOperationalDashboard } from "@/services/operational-dashboard";

function source(overrides: Record<string, unknown> = {}) {
  return {
    activeProcessCount: 12,
    processAreas: [{ area: "Cível" }, { area: "Cível" }, { area: "Trabalhista" }],
    recentProcesses: [],
    contactCount: 8,
    documentCount: 5,
    newLeadCount: 2,
    pendingActivityCount: 4,
    overdueActivityCount: 1,
    todayActivityCount: 1,
    completedActivities: [
      { pontos: 5, concluida_em: "2026-08-05T10:00:00Z" },
      { pontos: 8, concluida_em: "2026-08-12T10:00:00Z" },
    ],
    dueActivities: [
      { id: "late", titulo: "Prazo vencido", data_limite: "2026-08-11", prioridade: "alta", processo_id: "process-1" },
      { id: "today", titulo: "Prazo de hoje", data_limite: "2026-08-13", prioridade: "média", processo_id: null },
    ],
    upcomingHearings: [],
    notifications: [],
    finances: [
      { id: "paid", descricao: "Honorários", tipo: "honorario", status: "pago", valor: 3000, data_pagamento: "2026-08-04", data_vencimento: "2026-08-04", created_at: "2026-07-20T10:00:00Z" },
      { id: "old-paid", descricao: "Honorários antigos", tipo: "honorario", status: "pago", valor: 9000, data_pagamento: "2026-07-04", data_vencimento: "2026-07-04", created_at: "2026-07-01T10:00:00Z" },
      { id: "expense", descricao: "Despesa", tipo: "despesa", status: "pago", valor: 750, data_pagamento: "2026-08-05", data_vencimento: "2026-08-05", created_at: "2026-08-01T10:00:00Z" },
      { id: "overdue", descricao: "Parcela", tipo: "honorario", status: "atrasado", valor: 500, data_pagamento: null, data_vencimento: "2026-08-01", created_at: "2026-07-01T10:00:00Z" },
    ],
    hours: [{ horas: 2.5 }, { horas: 1.5 }],
    goal: { meta_receita: 6000 },
    monitoring: [
      { tribunal: "TJAM", ultima_verificacao: "2026-08-13T10:00:00Z" },
      { tribunal: "TJAM", ultima_verificacao: "2026-08-12T10:00:00Z" },
      { tribunal: "TRF1", ultima_verificacao: null },
    ],
    pendingPublicationCount: 3,
    warnings: [],
    ...overrides,
  };
}

describe("buildOperationalDashboard", () => {
  it("calcula período mensal sem misturar recebimentos antigos", () => {
    const dashboard = buildOperationalDashboard(source(), new Date(2026, 7, 13, 12));

    expect(dashboard.financial).toMatchObject({
      receivedThisMonth: 3000,
      expensesThisMonth: 750,
      netThisMonth: 2250,
      overdue: 500,
      monthlyGoal: 6000,
      goalProgress: 50,
    });
    expect(dashboard.metrics.pointsThisMonth).toBe(13);
    expect(dashboard.metrics.hoursThisMonth).toBe(4);
  });

  it("prioriza atrasos, tarefas de hoje e intimações", () => {
    const dashboard = buildOperationalDashboard(source(), new Date(2026, 7, 13, 12));

    expect(dashboard.attention.map(item => item.kind)).toEqual([
      "overdue",
      "today",
      "publication",
      "finance",
    ]);
    expect(dashboard.attention[0]).toMatchObject({
      title: "Prazo vencido",
      href: "/processos/process-1",
      days: -2,
    });
  });

  it("consolida áreas e saúde do monitoramento", () => {
    const dashboard = buildOperationalDashboard(source({ warnings: ["Financeiro: acesso negado"] }), new Date(2026, 7, 13, 12));

    expect(dashboard.processAreas).toEqual([
      { name: "Cível", count: 2 },
      { name: "Trabalhista", count: 1 },
    ]);
    expect(dashboard.monitoring).toEqual({
      monitoredProcesses: 3,
      activeCourts: 2,
      lastVerification: "2026-08-13T10:00:00Z",
    });
    expect(dashboard.warnings).toEqual(["Financeiro: acesso negado"]);
  });
});

