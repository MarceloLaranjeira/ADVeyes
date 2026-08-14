import { describe, expect, it } from "vitest";
import { EMPTY_INTELLIGENCE_FILTERS, filterProcessIntelligence, intelligenceMetrics, sortByAttention } from "@/lib/process-intelligence-workspace";
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
