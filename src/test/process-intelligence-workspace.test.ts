import { describe, expect, it } from "vitest";
import { applySituation, EMPTY_INTELLIGENCE_FILTERS, filterProcessIntelligence, intelligenceMetrics, isArchivedProcess, sortByAttention } from "@/lib/process-intelligence-workspace";
import type { ProcessIntelligenceItem, ProcessIntelligenceRecord } from "@/types/process-intelligence";

function item(id: string, partial: Partial<ProcessIntelligenceRecord> = {}): ProcessIntelligenceItem {
  return { id, number: `000${id}`, clientName: `Cliente ${id}`, clientDocument: null, area: "Cível", status: "Em andamento", court: "TJAM", courtUnit: "1ª Vara", lawyer: "Ana", updatedAt: "2026-08-14T00:00:00Z", intelligence: {
    id: `i-${id}`, tenantId: "tenant", processId: id, phase: "conhecimento", stage: "instrucao", waitingOn: "juizo_tribunal", waitingReason: "Aguardando decisão", nextAction: "Monitorar", lastEventAt: "2026-08-01T00:00:00Z", lastAdvanceAt: "2026-07-01T00:00:00Z", stalledDays: 44, isStalled: true, risk: "atencao", confidence: "media", confidenceScore: .7, evidence: [], origin: "automatico", runStatus: "ready", classifierVersion: "rules-v1", analyzedAt: "2026-08-14T00:00:00Z", manualOverride: null, manualOverrideBy: null, manualOverrideAt: null, updatedAt: "2026-08-14T00:00:00Z", ...partial,
  } };
}

describe("process intelligence workspace", () => {
  it("searches across process and diagnostic fields", () => {
    const items = [item("1"), item("2", { waitingReason: "Cliente precisa assinar" })];
    expect(filterProcessIntelligence(items, { ...EMPTY_INTELLIGENCE_FILTERS, search: "assinar" }).map(value => value.id)).toEqual(["2"]);
  });

  it("combines phase, waiting party and stalled filters", () => {
    const items = [item("1"), item("2", { phase: "recursal", waitingOn: "escritorio", isStalled: false })];
    expect(filterProcessIntelligence(items, { ...EMPTY_INTELLIGENCE_FILTERS, phase: "conhecimento", waitingOn: "juizo_tribunal", stalledOnly: true })).toHaveLength(1);
  });

  it("calculates management metrics including pending analysis", () => {
    const pending = { ...item("3"), intelligence: null };
    expect(intelligenceMetrics([item("1", { risk: "critico", waitingOn: "escritorio" }), pending])).toEqual({ total: 2, stalled: 1, office: 1, critical: 1, pending: 1 });
  });

  it("orders critical and longest-stalled cases first", () => {
    const ordered = sortByAttention([item("1", { risk: "alto", stalledDays: 90 }), item("2", { risk: "critico", stalledDays: 2 })]);
    expect(ordered[0].id).toBe("2");
  });
});

function situationItem(id: string, status: string | null, stalled: boolean): ProcessIntelligenceItem {
  return {
    id,
    number: `000000${id}-00.2026.8.04.0001`,
    clientName: null,
    clientDocument: null,
    area: null,
    status,
    court: null,
    courtUnit: null,
    lawyer: null,
    updatedAt: "2026-08-01T12:00:00Z",
    intelligence: stalled
      ? ({ isStalled: true, phase: "conhecimento", waitingOn: "escritorio", risk: "normal" } as ProcessIntelligenceItem["intelligence"])
      : null,
  };
}

describe("situação do processo", () => {
  it("reconhece arquivado e encerrado, ignorando caixa e espaços", () => {
    expect(isArchivedProcess("Arquivado")).toBe(true);
    expect(isArchivedProcess(" arquivado ")).toBe(true);
    expect(isArchivedProcess("Encerrado")).toBe(true);
    expect(isArchivedProcess("Em andamento")).toBe(false);
    expect(isArchivedProcess(null)).toBe(false);
  });

  it("mostra só os ativos por padrão", () => {
    const items = [situationItem("1", "Em andamento", false), situationItem("2", "Arquivado", false)];
    expect(applySituation(items, "ativos").map(i => i.id)).toEqual(["1"]);
    expect(applySituation(items, "arquivados").map(i => i.id)).toEqual(["2"]);
    expect(applySituation(items, "todos").map(i => i.id)).toEqual(["1", "2"]);
  });

  it("não conta arquivado como parado", () => {
    const items = applySituation(
      [situationItem("1", "Em andamento", true), situationItem("2", "Arquivado", true)],
      "ativos",
    );
    expect(intelligenceMetrics(items)).toMatchObject({ total: 1, stalled: 1 });
  });
});
