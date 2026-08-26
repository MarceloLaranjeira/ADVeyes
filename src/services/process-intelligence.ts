/* Generated Supabase types predate the process-intelligence migrations. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { estaArquivado } from "@/lib/carteira";
import type { ProcessIntelligenceItem, ProcessIntelligenceManualOverride, ProcessIntelligenceRecord } from "@/types/process-intelligence";

type Row = Record<string, unknown>;

function mapRecord(row: Row): ProcessIntelligenceRecord {
  return {
    id: String(row.id), tenantId: String(row.tenant_id), processId: String(row.process_id),
    phase: row.phase as ProcessIntelligenceRecord["phase"], stage: row.stage as ProcessIntelligenceRecord["stage"],
    waitingOn: row.waiting_on as ProcessIntelligenceRecord["waitingOn"], waitingReason: row.waiting_reason as string | null,
    nextAction: row.next_action as string | null, lastEventAt: row.last_event_at as string | null,
    lastAdvanceAt: row.last_advance_at as string | null, stalledDays: Number(row.stalled_days ?? 0),
    isStalled: Boolean(row.is_stalled), risk: row.risk as ProcessIntelligenceRecord["risk"],
    confidence: row.confidence as ProcessIntelligenceRecord["confidence"], confidenceScore: Number(row.confidence_score ?? 0),
    evidence: (row.evidence ?? []) as ProcessIntelligenceRecord["evidence"], origin: row.origin as ProcessIntelligenceRecord["origin"],
    runStatus: row.run_status as ProcessIntelligenceRecord["runStatus"], classifierVersion: String(row.classifier_version ?? ""),
    analyzedAt: row.analyzed_at as string | null, manualOverride: row.manual_override as ProcessIntelligenceManualOverride | null,
    manualOverrideBy: row.manual_override_by as string | null, manualOverrideAt: row.manual_override_at as string | null,
    updatedAt: String(row.updated_at),
  };
}

export const processIntelligenceService = {
  /**
   * Carteira do escritório para a listagem e para a Controladoria.
   *
   * Arquivado sai por padrão. Quem quiser ver processo encerrado pede em
   * voz alta, com `incluirArquivados` — a exceção é explícita na chamada,
   * nunca um filtro que cada tela reinventa.
   *
   * O corte acontece depois do join porque as duas fontes de arquivamento
   * moram em tabelas diferentes: a marcação manual em `processos.status` e
   * a fase deduzida em `process_intelligence_current`.
   */
  async list(
    tenantId: string,
    { incluirArquivados = false }: { incluirArquivados?: boolean } = {},
  ): Promise<ProcessIntelligenceItem[]> {
    const client = supabase as any;
    const [processes, intelligence] = await Promise.all([
      client.from("processos").select("id, numero, cliente_nome, area, status, tribunal, vara, adjudicating_body, advogado, updated_at, created_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false }),
      client.from("process_intelligence_current").select("*").eq("tenant_id", tenantId),
    ]);
    if (processes.error) throw processes.error;
    if (intelligence.error) throw intelligence.error;
    const byProcess = new Map<string, ProcessIntelligenceRecord>((intelligence.data ?? []).map((row: Row) => [String(row.process_id), mapRecord(row)]));
    return (processes.data ?? []).map((row: Row) => ({
      id: String(row.id), number: String(row.numero ?? ""), clientName: row.cliente_nome as string | null,
      clientDocument: null, area: row.area as string | null, status: row.status as string | null,
      court: row.tribunal as string | null, courtUnit: (row.adjudicating_body ?? row.vara) as string | null,
      lawyer: row.advogado as string | null, updatedAt: String(row.updated_at ?? row.created_at), intelligence: byProcess.get(String(row.id)) ?? null,
    })).filter((item: ProcessIntelligenceItem) =>
      incluirArquivados || !estaArquivado({
        status: item.status,
        fase: item.intelligence?.phase ?? null,
      }));
  },

  async analyze(tenantId: string, processId: string) {
    const { data, error } = await supabase.functions.invoke("legal-process-intelligence", { body: { action: "analyze", tenantId, processId } });
    if (error) throw error;
    return data;
  },

  async backfill(tenantId: string) {
    const { data, error } = await supabase.functions.invoke("legal-process-intelligence", { body: { action: "backfill", tenantId, limit: 500 } });
    if (error) throw error;
    return data as { queued: number };
  },

  async correct(tenantId: string, processId: string, correction: ProcessIntelligenceManualOverride, justification: string) {
    const { data, error } = await supabase.functions.invoke("legal-process-intelligence", { body: { action: "correct", tenantId, processId, correction, justification } });
    if (error) throw error;
    return data;
  },
};
