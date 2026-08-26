/* Generated Supabase types predate the process-intelligence migrations. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { carteiraAtiva, estaArquivado } from "@/lib/carteira";
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

/**
 * Tamanho da página ao varrer uma tabela inteira.
 *
 * O PostgREST corta a resposta num teto de linhas configurado no servidor.
 * Como o corte é silencioso — vem uma resposta bem-sucedida, só que curta —
 * uma carteira grande devolveria apenas as primeiras linhas por
 * `updated_at`, e qualquer filtro aplicado depois disso descartaria parte
 * dessa página sem repor o que ficou de fora. O resultado seria processo
 * ativo sumindo da tela por causa de arquivado recém-movimentado.
 */
const PAGINA = 1000;

/**
 * Lê todas as linhas de uma consulta, página por página.
 *
 * `montar` recebe a faixa e devolve a consulta já filtrada, porque o
 * `range` precisa ser aplicado por último, depois dos demais predicados.
 */
async function lerTudo(
  montar: (de: number, ate: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
): Promise<Row[]> {
  const todas: Row[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await montar(de, de + PAGINA - 1);
    if (error) throw error;
    const pagina = data ?? [];
    todas.push(...pagina);
    if (pagina.length < PAGINA) return todas;
  }
}

export const processIntelligenceService = {
  /**
   * Carteira do escritório para a listagem e para a Controladoria.
   *
   * Arquivado sai por padrão. Quem quiser ver processo encerrado pede em
   * voz alta, com `incluirArquivados` — a exceção é explícita na chamada,
   * nunca um filtro que cada tela reinventa.
   *
   * O arquivamento tem duas fontes em tabelas diferentes, e cada uma é
   * aplicada onde consegue ser: a decisão do escritório e o status legado
   * vivem em `processos` e descem para o banco; a fase deduzida vive em
   * `process_intelligence_current` e só pode ser avaliada depois do join.
   */
  async list(
    tenantId: string,
    { incluirArquivados = false }: { incluirArquivados?: boolean } = {},
  ): Promise<ProcessIntelligenceItem[]> {
    const client = supabase as any;
    // A metade do arquivamento que mora em `processos` desce para o banco:
    // filtrar lá reduz o que precisa vir pela rede e, junto da paginação,
    // impede que arquivado recém-movimentado ocupe a primeira página e
    // empurre processo ativo para fora do resultado. A fase do tribunal
    // mora em outra tabela e continua sendo aplicada depois do join.
    const selecionarProcessos = (de: number, ate: number) => {
      const base = client
        .from("processos")
        .select("id, numero, cliente_nome, area, status, arquivado_manual, tribunal, vara, adjudicating_body, advogado, updated_at, created_at")
        .eq("tenant_id", tenantId);
      return (incluirArquivados ? base : carteiraAtiva(base))
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(de, ate);
    };

    const [linhasProcessos, linhasInteligencia] = await Promise.all([
      lerTudo(selecionarProcessos),
      lerTudo((de, ate) =>
        client
          .from("process_intelligence_current")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("process_id", { ascending: true })
          .range(de, ate)),
    ]);
    const processes = { data: linhasProcessos };
    const intelligence = { data: linhasInteligencia };
    const byProcess = new Map<string, ProcessIntelligenceRecord>((intelligence.data ?? []).map((row: Row) => [String(row.process_id), mapRecord(row)]));
    const itens = (processes.data ?? []).map((row: Row) => ({
      id: String(row.id), number: String(row.numero ?? ""), clientName: row.cliente_nome as string | null,
      clientDocument: null, area: row.area as string | null, status: row.status as string | null,
      court: row.tribunal as string | null, courtUnit: (row.adjudicating_body ?? row.vara) as string | null,
      lawyer: row.advogado as string | null, updatedAt: String(row.updated_at ?? row.created_at), intelligence: byProcess.get(String(row.id)) ?? null,
    }));

    // O override do advogado nao cabe em `ProcessIntelligenceItem`, que e o
    // contrato da tela. Fica ao lado, indexado por processo, so para a
    // decisao de carteira.
    const overridePorProcesso = new Map<string, boolean | null>(
      (processes.data ?? []).map((row: Row) => [
        String(row.id),
        typeof row.arquivado_manual === "boolean" ? row.arquivado_manual : null,
      ]),
    );

    return itens.filter((item: ProcessIntelligenceItem) =>
      incluirArquivados || !estaArquivado({
        status: item.status,
        arquivadoManual: overridePorProcesso.get(item.id) ?? null,
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
