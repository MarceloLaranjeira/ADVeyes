import { describe, expect, it } from "vitest";
import { classifyDeadline, sortActionItems } from "@/lib/controladoria";
import type { ActionItem } from "@/types/controladoria";

const now = new Date(2026, 7, 25, 10, 0, 0);

describe("classifyDeadline", () => {
  it("marca o que já venceu com quantos dias de atraso", () => {
    expect(classifyDeadline("2026-08-23", now)).toEqual({
      urgency: "vencido",
      days: -2,
      label: "Venceu há 2 dias",
    });
  });

  it("distingue hoje, amanhã e os próximos", () => {
    expect(classifyDeadline("2026-08-25", now)).toMatchObject({ urgency: "hoje", days: 0, label: "Vence hoje" });
    expect(classifyDeadline("2026-08-26", now)).toMatchObject({ urgency: "amanha", days: 1, label: "Vence amanhã" });
    expect(classifyDeadline("2026-08-29", now)).toMatchObject({ urgency: "proximo", days: 4, label: "Faltam 4 dias" });
  });

  it("usa singular quando falta ou passou um dia só", () => {
    expect(classifyDeadline("2026-08-24", now).label).toBe("Venceu ontem");
  });

  it("ignora a hora: o dia é o que conta para prazo", () => {
    expect(classifyDeadline("2026-08-25T23:30:00", now).urgency).toBe("hoje");
  });

  it("aceita ausência de prazo sem inventar número", () => {
    expect(classifyDeadline(null, now)).toEqual({ urgency: "sem_prazo", days: null, label: "Vencimento não definido" });
    expect(classifyDeadline("data-inválida", now)).toEqual({ urgency: "sem_prazo", days: null, label: "Vencimento não definido" });
  });
});

describe("sortActionItems", () => {
  function action(id: string, dueDate: string | null, kind: ActionItem["kind"] = "prazo"): ActionItem {
    return { id, kind, title: id, dueDate, processNumber: null, clientName: null, assigneeName: null, assigneeId: null, status: null };
  }

  it("põe o vencido antes de hoje, e hoje antes dos próximos", () => {
    const sorted = sortActionItems([
      action("proximo", "2026-08-29"),
      action("vencido", "2026-08-20"),
      action("hoje", "2026-08-25"),
    ]);
    expect(sorted.map(item => item.id)).toEqual(["vencido", "hoje", "proximo"]);
  });

  it("deixa o que não tem prazo por último, sem descartar", () => {
    const sorted = sortActionItems([action("sem", null, "intimacao"), action("hoje", "2026-08-25")]);
    expect(sorted.map(item => item.id)).toEqual(["hoje", "sem"]);
  });
});
