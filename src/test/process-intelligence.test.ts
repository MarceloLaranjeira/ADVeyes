import { describe, expect, it } from "vitest";
import {
  assessProcessIntelligence,
  inferProcessPhase,
  isRelevantProcessAdvance,
} from "@/lib/process-intelligence";
import type { ProcessIntelligenceEvent } from "@/types/process-intelligence";

const event = (id: string, date: string, title: string, content = title): ProcessIntelligenceEvent => ({
  id,
  kind: "movement",
  occurredAt: date,
  title,
  content,
});

describe("process intelligence", () => {
  it("classifica fases e etapas jurídicas pelas evidências mais recentes", () => {
    expect(inferProcessPhase([event("1", "2026-08-01", "Penhora online realizada")])).toMatchObject({
      phase: "cumprimento_execucao",
      stage: "penhora",
    });
    expect(inferProcessPhase([event("2", "2026-08-01", "Contrarrazões apresentadas")])).toMatchObject({
      phase: "recursal",
      stage: "contrarrazoes",
    });
    expect(inferProcessPhase([], "Arquivado definitivamente")).toMatchObject({
      phase: "arquivado_encerrado",
      stage: "arquivado",
    });
  });

  it("não considera movimentação meramente cadastral como avanço", () => {
    expect(isRelevantProcessAdvance(event("1", "2026-08-10", "Mero expediente"))).toBe(false);
    expect(isRelevantProcessAdvance(event("2", "2026-08-10", "Decisão proferida"))).toBe(true);
  });

  it("aplica limites diferentes conforme quem deve agir", () => {
    const now = new Date("2026-08-14T12:00:00Z");
    const office = assessProcessIntelligence({
      now,
      events: [event("1", "2026-08-10T12:00:00Z", "Intimado o advogado para se manifestar")],
    });
    const court = assessProcessIntelligence({
      now,
      events: [event("2", "2026-07-20T12:00:00Z", "Conclusos para decisão")],
    });
    expect(office).toMatchObject({ waitingOn: "escritorio", isStalled: true, risk: "alto" });
    expect(court).toMatchObject({ waitingOn: "juizo_tribunal", isStalled: false });
  });

  it("marca prazo vencido como risco crítico imediato", () => {
    const result = assessProcessIntelligence({
      now: new Date("2026-08-14T12:00:00Z"),
      dueAt: "2026-08-13T23:59:59Z",
      events: [event("1", "2026-08-14T10:00:00Z", "Petição inicial distribuída")],
    });
    expect(result.risk).toBe("critico");
  });

  it("não alerta por inatividade processo suspenso ou arquivado", () => {
    const result = assessProcessIntelligence({
      status: "Suspenso",
      now: new Date("2026-08-14T12:00:00Z"),
      events: [event("1", "2025-01-01T12:00:00Z", "Processo suspenso")],
    });
    expect(result).toMatchObject({ phase: "suspenso_sobrestado", isStalled: false, risk: "normal" });
  });

  it("rejeita sugestão sem evidência existente e explicita baixa confiança", () => {
    const result = assessProcessIntelligence({
      events: [],
      semantic: {
        phase: "recursal",
        stage: "julgamento",
        waitingOn: "juizo_tribunal",
        waitingReason: "Aguardando sessão",
        nextAction: "Monitorar pauta",
        confidence: 0.9,
        evidenceIds: ["inexistente"],
      },
    });
    expect(result).toMatchObject({ phase: "nao_identificada", confidence: "baixa" });
  });

  it("faz a correção humana prevalecer e a identifica como manual", () => {
    const result = assessProcessIntelligence({
      events: [event("1", "2026-08-01", "Sentença proferida")],
      manualOverride: {
        phase: "recursal",
        stage: "preparacao_recurso",
        waitingOn: "escritorio",
        waitingReason: "Preparar apelação",
      },
    });
    expect(result).toMatchObject({
      phase: "recursal",
      stage: "preparacao_recurso",
      origin: "manual",
      confidence: "alta",
    });
  });
});

