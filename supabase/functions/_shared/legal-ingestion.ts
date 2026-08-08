// Ingestor idempotente. Deduplica por identificador externo do provedor e,
// na ausência dele, por impressão digital determinística do conteúdo.
// Toda gravação carrega o tenant_id da fonte monitorada.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  deliverLegalAlert,
  resolveRecipients,
} from "./legal-notifications.ts";
import {
  buildContentFingerprint,
  type NormalizedMovement,
  type NormalizedPublication,
  type PublicationProvider,
} from "./legal-normalization.ts";

export interface IngestionResult {
  received: number;
  created: number;
  ignored: number;
  createdIds: string[];
}

export interface ProcessReference {
  id: string;
  numero: string;
  cliente_nome: string | null;
  user_id: string | null;
}

const EMPTY: IngestionResult = {
  received: 0,
  created: 0,
  ignored: 0,
  createdIds: [],
};

/**
 * Persiste publicações já normalizadas. Um evento repetido atualiza o mesmo
 * registro em vez de criar duplicata.
 */
export async function ingestPublications(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    provider: PublicationProvider;
    fallbackUserId: string | null;
    publications: NormalizedPublication[];
    processByNumber?: Map<string, ProcessReference>;
    /** Processo já conhecido, usado quando o número não permite o vínculo. */
    defaultProcess?: ProcessReference | null;
  },
): Promise<IngestionResult> {
  if (!input.publications.length) return { ...EMPTY };

  let created = 0;
  let ignored = 0;
  const createdIds: string[] = [];

  for (const publication of input.publications) {
    const matched = publication.numeroProcesso
      ? input.processByNumber?.get(publication.numeroProcesso) ?? null
      : null;
    const process = matched ?? input.defaultProcess ?? null;

    const contentHash = await buildContentFingerprint([
      input.tenantId,
      input.provider,
      publication.numeroProcesso,
      publication.publishedAt,
      publication.sourceName,
      publication.content,
    ]);

    const { data, error } = await admin
      .from("publicacoes")
      .upsert({
        tenant_id: input.tenantId,
        user_id: process?.user_id ?? input.fallbackUserId,
        process_id: process?.id ?? null,
        tipo: publication.tipo,
        tribunal: publication.tribunal,
        numero_processo: publication.numeroProcesso ?? process?.numero ?? null,
        cliente_nome: process?.cliente_nome ?? null,
        data_publicacao: publication.publishedAt,
        conteudo: publication.content,
        conteudo_simplificado: publication.summary,
        status: publication.possibleDeadline ? "urgente" : "nova",
        provider: input.provider,
        external_id: publication.externalId,
        content_hash: contentHash,
        origin_system: publication.originSystem,
        source_name: publication.sourceName,
        source_url: publication.sourceUrl,
        provider_payload: publication.payload,
        review_status: "pending_review",
        possible_deadline: publication.possibleDeadline,
      }, {
        onConflict: publication.externalId
          ? "tenant_id,provider,external_id"
          : "tenant_id,content_hash",
        ignoreDuplicates: true,
      })
      .select("id")
      .maybeSingle();

    // 23505: o mesmo conteúdo já existe sob outro identificador externo.
    // Um evento repetido nunca deve interromper a ingestão da fonte.
    if (error && (error as { code?: string }).code !== "23505") throw error;
    if (!error && data) {
      created += 1;
      createdIds.push(data.id as string);
    }
    else ignored += 1;
  }

  return {
    received: input.publications.length,
    created,
    ignored,
    createdIds,
  };
}

/**
 * Persiste andamentos já normalizados de um processo específico.
 * Nenhum movimento processual pode alcançar a tabela de publicações.
 */
export async function ingestMovements(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    processId: string;
    provider: "escavador" | "datajud" | "manual";
    movements: NormalizedMovement[];
  },
): Promise<IngestionResult> {
  if (!input.movements.length) return { ...EMPTY };

  const { data: process, error: processError } = await admin
    .from("processos")
    .select("numero, cliente_nome")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.processId)
    .maybeSingle();
  if (processError) throw processError;

  const rows = input.movements
    .filter((movement) => movement.externalId)
    .map((movement) => ({
      tenant_id: input.tenantId,
      process_id: input.processId,
      process_number: process?.numero ?? null,
      client_name: process?.cliente_nome ?? null,
      provider: input.provider,
      external_id: movement.externalId,
      movement_type: movement.movementType,
      occurred_at: movement.occurredAt,
      title: movement.title,
      content: movement.content,
      source_name: movement.sourceName,
      source_url: movement.sourceUrl,
      provider_payload: movement.payload,
    }));

  if (!rows.length) {
    return {
      received: input.movements.length,
      created: 0,
      ignored: input.movements.length,
      createdIds: [],
    };
  }

  const { data, error } = await admin
    .from("process_movements")
    .upsert(rows, {
      onConflict: "tenant_id,process_id,provider,external_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) throw error;

  const created = data?.length ?? 0;
  return {
    received: input.movements.length,
    created,
    ignored: input.movements.length - created,
    createdIds: [],
  };
}

/**
 * Notifica os membros jurídicos ativos sobre publicações recém-criadas.
 * A função recebe apenas IDs retornados pelo `insert`, então uma reconciliação
 * idempotente nunca repete o alerta.
 */
/**
 * Avisa sobre publicações novas. O alerta vai para o profissional dono da OAB
 * vinculada ao processo, não para a equipe inteira, e respeita as preferências
 * de cada pessoa.
 */
export async function notifyNewPublications(
  admin: SupabaseClient,
  input: { tenantId: string; publicationIds: string[] },
): Promise<number> {
  if (!input.publicationIds.length) return 0;

  const { data: publications, error } = await admin
    .from("publicacoes")
    .select("id, process_id, tribunal, numero_processo, tipo, conteudo")
    .eq("tenant_id", input.tenantId)
    .in("id", input.publicationIds);

  if (error) throw error;
  if (!publications?.length) return 0;

  let delivered = 0;
  for (const publication of publications) {
    const summary = [
      publication.tipo,
      publication.tribunal,
      publication.numero_processo,
    ].filter(Boolean).join(" · ");

    const result = await deliverLegalAlert(admin, {
      tenantId: input.tenantId,
      processId: publication.process_id as string | null,
      content: {
        event: "publication_new",
        title: "Nova publicação oficial",
        summary: summary ||
          String(publication.conteudo ?? "").slice(0, 240),
        processNumber: publication.numero_processo as string | null,
        detailUrl: publication.process_id
          ? `https://adveyes.automatikus.com.br/processos/${publication.process_id}`
          : "https://adveyes.automatikus.com.br/publicacoes",
        idempotencyKey: `publication:${publication.id}`,
      },
    });
    delivered += result.inApp;

    const recipients = await resolveRecipients(admin, {
      tenantId: input.tenantId,
      processId: publication.process_id as string | null,
    });
    const responsible = recipients[0];
    if (responsible) {
      const { error: taskError } = await admin.from("tarefas").upsert({
        tenant_id: input.tenantId,
        user_id: responsible.userId,
        responsavel_id: responsible.userId,
        processo_id: publication.process_id as string | null,
        titulo: "Revisar intimação",
        descricao: [
          summary || "Nova publicação oficial recebida.",
          "Revise o conteúdo e confirme qualquer prazo sugerido antes de usá-lo.",
        ].join("\n\n"),
        prioridade: "alta",
        status: "pendente",
        categoria: "Intimação",
        pontos: 1,
        tags: ["intimação", "publicação-oficial"],
        source_type: "publicacao",
        source_id: publication.id,
      }, {
        onConflict: "tenant_id,source_type,source_id",
        ignoreDuplicates: true,
      });
      if (taskError) {
        console.error("legal-ingestion: publication review task failed");
      }
    }
  }

  return delivered;
}

/** Índice de processos do escritório por número CNJ formatado. */
export function indexProcessesByNumber(
  processes: Array<ProcessReference & { numero: string }>,
  format: (value: string) => string,
): Map<string, ProcessReference> {
  const index = new Map<string, ProcessReference>();
  for (const process of processes) {
    const key = format(process.numero);
    if (key) index.set(key, process);
  }
  return index;
}
