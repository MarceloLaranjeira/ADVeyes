// Ingestor idempotente. Deduplica por identificador externo do provedor e,
// na ausência dele, por impressão digital determinística do conteúdo.
// Toda gravação carrega o tenant_id da fonte monitorada.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { extractHearingCandidate } from "./legal-hearing-extraction.ts";
import {
  deliverLegalAlert,
  resolveRecipients,
} from "./legal-notifications.ts";
import {
  buildContentFingerprint,
  buildPartyIdentityFingerprint,
  type NormalizedMovement,
  type NormalizedParty,
  type NormalizedProcessMetadata,
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

export async function ingestProcessMetadata(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    processId: string;
    metadata: NormalizedProcessMetadata;
  },
): Promise<void> {
  const metadata = input.metadata;
  const { data: current } = await admin
    .from("processos")
    .select("vara, area, data_ajuizamento")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.processId)
    .maybeSingle();

  const { error } = await admin.from("processos").update({
    tribunal: metadata.tribunal,
    class_code: metadata.classCode,
    class_name: metadata.className,
    area: current?.area || metadata.className || undefined,
    subjects: metadata.subjects,
    adjudicating_body: metadata.adjudicatingBody,
    vara: current?.vara || metadata.adjudicatingBody || undefined,
    data_ajuizamento: current?.data_ajuizamento || metadata.filedAt || undefined,
    procedural_system: metadata.proceduralSystem,
    court_level: metadata.courtLevel,
    public_secrecy_level: metadata.publicSecrecyLevel,
    legal_sync_status: "synced",
    last_legal_sync_at: new Date().toISOString(),
    legal_data_source: metadata.provider,
    legal_metadata: {
      provider: metadata.provider,
      source_updated_at: metadata.lastUpdatedAt,
      collected_at: new Date().toISOString(),
    },
  })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.processId);
  if (error) throw error;
}

export async function ingestProcessParties(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    processId: string;
    parties: NormalizedParty[];
  },
): Promise<IngestionResult> {
  if (!input.parties.length) return { ...EMPTY };

  const identified = await Promise.all(input.parties.map(async (party) => ({
    party,
    // O ID externo pertence ao provedor e fica só nas referências da fonte.
    identityHash: await buildPartyIdentityFingerprint({
      tenantId: input.tenantId,
      processId: input.processId,
      party,
    }),
  })));
  const hashes = identified.map((item) => item.identityHash);
  const { data: existing, error: existingError } = await admin
    .from("process_parties")
    .select("identity_hash, contact_id, internal_classification, classification_locked, source_references")
    .eq("tenant_id", input.tenantId)
    .eq("process_id", input.processId)
    .in("identity_hash", hashes);
  if (existingError) throw existingError;
  const existingByHash = new Map(
    (existing ?? []).map((row) => [row.identity_hash as string, row]),
  );

  const rows = identified.map(({ party, identityHash }) => {
    const current = existingByHash.get(identityHash);
    const locked = current?.classification_locked === true;
    const references = current?.source_references &&
        typeof current.source_references === "object"
      ? current.source_references as Record<string, unknown>
      : {};
    return {
      tenant_id: input.tenantId,
      process_id: input.processId,
      contact_id: current?.contact_id ?? null,
      display_name: party.displayName,
      normalized_name: party.normalizedName,
      person_type: party.personType,
      document_masked: party.documentMasked,
      document_hash: party.documentHash,
      side: party.side,
      procedural_role: party.proceduralRole,
      internal_classification: locked
        ? current.internal_classification
        : party.internalClassification,
      classification_locked: locked,
      related_lawyers: party.relatedLawyers,
      contact_data: party.contact,
      provider: party.provider,
      external_id: party.externalId,
      identity_hash: identityHash,
      source_references: {
        ...references,
        [party.provider]: party.externalId ?? true,
      },
      provider_payload: party.payload,
      last_seen_at: new Date().toISOString(),
    };
  });

  const { error } = await admin.from("process_parties").upsert(rows, {
    onConflict: "tenant_id,process_id,identity_hash",
    ignoreDuplicates: false,
  });
  if (error) throw error;

  const created = rows.filter((row) => !existingByHash.has(row.identity_hash)).length;
  return {
    received: rows.length,
    created,
    ignored: rows.length - created,
    createdIds: [],
  };
}

export interface ContactReconciliationResult {
  linked: number;
  created: number;
}

/**
 * Materializa todas as partes processuais como contatos do escritório. Dados
 * e classificações manuais nunca são sobrescritos pela sincronização.
 */
export async function reconcileProcessContacts(
  admin: SupabaseClient,
  input: { tenantId: string; processId: string },
): Promise<ContactReconciliationResult> {
  const { data: process, error: processError } = await admin
    .from("processos")
    .select("user_id")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.processId)
    .maybeSingle();
  if (processError) throw processError;
  if (!process?.user_id) return { linked: 0, created: 0 };

  const { data: parties, error: partiesError } = await admin
    .from("process_parties")
    .select("id, contact_id, display_name, normalized_name, person_type, document_hash, internal_classification, provider, external_id, source_references, contact_data")
    .eq("tenant_id", input.tenantId)
    .eq("process_id", input.processId);
  if (partiesError) throw partiesError;
  const processParties = parties ?? [];
  if (!processParties.length) return { linked: 0, created: 0 };

  const names = [...new Set(processParties.map((party) => String(party.normalized_name)))];
  const { data: contacts, error: contactsError } = await admin
    .from("clientes")
    .select("id, normalized_name, person_type, document_hash, telefone, email, endereco, relationship_type, classification_locked, source_metadata")
    .eq("tenant_id", input.tenantId)
    .in("normalized_name", names);
  if (contactsError) throw contactsError;

  interface ContactRow {
    id: string;
    document_hash: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
    relationship_type: string;
    classification_locked: boolean;
    source_metadata: Record<string, unknown> | null;
  }
  const byCanonicalKey = new Map<string, ContactRow>();
  const byId = new Map<string, ContactRow>();
  for (const contact of contacts ?? []) {
    const typed = contact as ContactRow;
    byCanonicalKey.set(
      `${contact.normalized_name}|${contact.person_type ?? "desconhecido"}`,
      typed,
    );
    byId.set(contact.id, typed);
  }

  let linked = 0;
  let created = 0;
  for (const party of processParties) {
    const key = `${party.normalized_name}|${party.person_type}`;
    let contact = party.contact_id
      ? byId.get(party.contact_id)
      : byCanonicalKey.get(key);
    if (contact?.document_hash && party.document_hash &&
      contact.document_hash !== party.document_hash) {
      contact = undefined;
    }

    if (!contact) {
      const { data: inserted, error: insertError } = await admin
        .from("clientes")
        .insert({
          tenant_id: input.tenantId,
          user_id: process.user_id,
          nome: party.display_name,
          normalized_name: party.normalized_name,
          person_type: party.person_type,
          relationship_type: party.internal_classification,
          source_provider: party.provider,
          external_id: null,
          document_hash: party.document_hash,
          telefone: party.contact_data?.phone ?? null,
          email: party.contact_data?.email ?? null,
          endereco: party.contact_data?.address ?? null,
          classification_locked: false,
          source_metadata: {
            process_ids: [input.processId],
            source_references: party.source_references ?? {},
          },
        })
        .select("id, document_hash, telefone, email, endereco, relationship_type, classification_locked, source_metadata")
        .single();
      if (insertError) throw insertError;
      contact = inserted as ContactRow;
      byCanonicalKey.set(key, contact);
      byId.set(contact.id, contact);
      created += 1;
    }

    const metadata = contact.source_metadata &&
        typeof contact.source_metadata === "object"
      ? contact.source_metadata
      : {};
    const currentProcessIds = Array.isArray(metadata.process_ids)
      ? metadata.process_ids.filter((value): value is string => typeof value === "string")
      : [];
    const contactData = party.contact_data && typeof party.contact_data === "object"
      ? party.contact_data as { phone?: string | null; email?: string | null; address?: string | null }
      : {};
    const patch = {
      telefone: contact.telefone || contactData.phone || null,
      email: contact.email || contactData.email || null,
      endereco: contact.endereco || contactData.address || null,
      relationship_type: contact.classification_locked
        ? contact.relationship_type
        : party.internal_classification,
      source_metadata: {
        ...metadata,
        process_ids: [...new Set([...currentProcessIds, input.processId])],
        source_references: {
          ...(metadata.source_references && typeof metadata.source_references === "object"
            ? metadata.source_references as Record<string, unknown>
            : {}),
          ...(party.source_references ?? {}),
        },
      },
    };
    const { error: enrichmentError } = await admin.from("clientes")
      .update(patch)
      .eq("tenant_id", input.tenantId)
      .eq("id", contact.id);
    if (enrichmentError) throw enrichmentError;
    contact = { ...contact, ...patch };
    byCanonicalKey.set(key, contact);
    byId.set(contact.id, contact);

    if (!party.contact_id) {
      const { error: linkError } = await admin.from("process_parties")
        .update({ contact_id: contact.id })
        .eq("tenant_id", input.tenantId)
        .eq("id", party.id);
      if (linkError) throw linkError;
      linked += 1;
    }
  }

  return { linked, created };
}

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
        communication_type: publication.communicationType,
        recipients: publication.recipients,
        recipient_lawyers: publication.recipientLawyers,
        court_body: publication.courtBody,
        hearing_evidence: publication.hearingEvidence,
        provenance: {
          provider: input.provider,
          source_name: publication.sourceName,
          source_url: publication.sourceUrl,
          collected_at: new Date().toISOString(),
        },
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

  const normalizedRows = await Promise.all(input.movements
    .filter((movement) => movement.externalId)
    .map(async (movement) => ({
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
      tpu_code: movement.tpuCode,
      description: movement.description,
      complements: movement.complements,
      notes: movement.notes,
      origin_system: movement.originSystem,
      document_type: movement.documentType,
      full_text_available: movement.fullTextAvailable,
      document_url: movement.documentUrl,
      content_hash: await buildContentFingerprint([
        input.tenantId,
        input.processId,
        input.provider,
        movement.externalId,
        movement.occurredAt,
        movement.content,
      ]),
      provenance: {
        provider: input.provider,
        source_name: movement.sourceName,
        source_url: movement.sourceUrl,
        collected_at: new Date().toISOString(),
      },
      provider_payload: movement.payload,
    })));

  // O DataJud pode repetir o mesmo movimento dentro da própria resposta.
  // O Postgres rejeita duas linhas com a mesma chave em um único UPSERT
  // (SQLSTATE 21000), então consolidamos o lote antes de persistir. A última
  // ocorrência é mantida por normalmente carregar os complementos mais ricos.
  const rows = [...new Map(
    normalizedRows.map((row) => [row.external_id, row]),
  ).values()];

  if (!rows.length) {
    return {
      received: input.movements.length,
      created: 0,
      ignored: input.movements.length,
      createdIds: [],
    };
  }

  // Um processo volumoso pode trazer centenas de IDs. Enviar todos em um
  // único filtro `in` excede o limite de URL do PostgREST e fazia a fonte
  // entrar em retentativa. Consultas curtas mantêm a ingestão idempotente.
  const existingRows: Array<{ external_id: string }> = [];
  const externalIds = rows.map((row) => row.external_id);
  for (let offset = 0; offset < externalIds.length; offset += 100) {
    const { data: batch, error: existingError } = await admin
      .from("process_movements")
      .select("external_id")
      .eq("tenant_id", input.tenantId)
      .eq("process_id", input.processId)
      .eq("provider", input.provider)
      .in("external_id", externalIds.slice(offset, offset + 100));
    if (existingError) throw existingError;
    existingRows.push(...((batch ?? []) as Array<{ external_id: string }>));
  }
  const existingIds = new Set(
    (existingRows ?? []).map((row) => row.external_id as string),
  );

  const { data, error } = await admin
    .from("process_movements")
    .upsert(rows, {
      onConflict: "tenant_id,process_id,provider,external_id",
      ignoreDuplicates: false,
    })
    .select("id, external_id, movement_type, title, content, content_hash, occurred_at, document_type, document_url, full_text_available, source_name, source_url, provider_payload");

  if (error) throw error;

  const documentRows = (data ?? [])
    .filter((movement) => movement.movement_type === "DOCUMENTO")
    .map((movement) => ({
      tenant_id: input.tenantId,
      process_id: input.processId,
      movement_id: movement.id,
      document_type: movement.document_type,
      title: movement.title || movement.document_type || "Documento processual",
      text_content: movement.full_text_available ? movement.content : null,
      official_url: input.provider === "datajud" ? movement.document_url : null,
      complementary_url: input.provider === "escavador" ? movement.document_url : null,
      provider: input.provider,
      external_id: movement.external_id,
      content_hash: movement.content_hash,
      occurred_at: movement.occurred_at,
      availability_status: movement.full_text_available
        ? "available"
        : movement.document_url
        ? "link_only"
        : "unavailable",
      is_public: true,
      source_type: "movement",
      source_id: movement.id,
      source_references: {
        [input.provider]: movement.external_id,
      },
      provenance: {
        provider: input.provider,
        source_name: movement.source_name,
        source_url: movement.source_url,
      },
      provider_payload: movement.provider_payload,
    }));

  if (documentRows.length) {
    const { error: documentError } = await admin
      .from("process_documents")
      .upsert(documentRows, {
        onConflict: "tenant_id,process_id,content_hash",
        ignoreDuplicates: false,
      });
    if (documentError) throw documentError;
  }

  const created = rows.filter((row) => !existingIds.has(row.external_id)).length;
  return {
    received: input.movements.length,
    created,
    ignored: input.movements.length - created,
    createdIds: [],
  };
}

export interface PublicationTaskResult {
  linked: number;
  failed: number;
}

/** Cria candidatos de audiência a partir de publicações, sempre pendentes. */
export async function createPublicationHearingCandidates(
  admin: SupabaseClient,
  input: { tenantId: string; publicationIds: string[] },
): Promise<{ created: number }> {
  if (!input.publicationIds.length) return { created: 0 };
  const { data: publications, error } = await admin.from("publicacoes")
    .select("id, user_id, process_id, numero_processo, cliente_nome, provider, external_id, court_body, hearing_evidence, conteudo")
    .eq("tenant_id", input.tenantId)
    .in("id", input.publicationIds);
  if (error) throw error;

  const rows = (publications ?? []).flatMap((publication) => {
    if (!publication.user_id) return [];
    const candidate = extractHearingCandidate(
      publication.hearing_evidence || publication.conteudo,
    );
    if (!candidate) return [];
    return [{
      tenant_id: input.tenantId,
      user_id: publication.user_id,
      processo_id: publication.process_id,
      processo_numero: publication.numero_processo,
      cliente_nome: publication.cliente_nome,
      tipo: candidate.type,
      data_hora: candidate.startsAt,
      vara: publication.court_body,
      observacoes: `${candidate.evidence}\n\nEvento detectado automaticamente. Confirme data, horário e local antes de utilizar.`,
      status: "A confirmar",
      source_provider: publication.provider,
      external_id: `publicacao:${publication.id}`,
      publication_id: publication.id,
      extraction_confidence: candidate.confidence,
      source_evidence: candidate.evidence,
      review_status: "pending",
      detected_at: new Date().toISOString(),
    }];
  });
  if (!rows.length) return { created: 0 };

  const { data, error: insertError } = await admin.from("audiencias")
    .upsert(rows, {
      onConflict: "tenant_id,source_provider,external_id",
      ignoreDuplicates: true,
    })
    .select("id");
  if (insertError) throw insertError;
  return { created: data?.length ?? 0 };
}

/**
 * Cria uma tarefa humana de revisão para cada publicação nova e persiste o
 * vínculo explícito entre as duas entidades. A atribuição só é automática
 * quando existe exatamente um destinatário responsável pelo processo.
 */
export async function createPublicationReviewTasks(
  admin: SupabaseClient,
  input: { tenantId: string; publicationIds: string[] },
): Promise<PublicationTaskResult> {
  if (!input.publicationIds.length) return { linked: 0, failed: 0 };

  const { data: publications, error } = await admin
    .from("publicacoes")
    .select(
      "id, user_id, process_id, tribunal, numero_processo, tipo, conteudo",
    )
    .eq("tenant_id", input.tenantId)
    .in("id", input.publicationIds);
  if (error) throw error;

  let linked = 0;
  let failed = 0;
  for (const publication of publications ?? []) {
    try {
      const recipients = await resolveRecipients(admin, {
        tenantId: input.tenantId,
        processId: publication.process_id as string | null,
      });
      const responsibleId = recipients.length === 1
        ? recipients[0].userId
        : null;
      const reference = [
        publication.numero_processo,
        publication.tribunal,
        publication.tipo,
      ].filter(Boolean).join(" · ");

      const { error: insertError } = await admin.from("tarefas").upsert({
        tenant_id: input.tenantId,
        user_id: publication.user_id,
        responsavel_id: responsibleId,
        processo_id: publication.process_id as string | null,
        titulo: "Revisar intimação",
        descricao: [
          reference || "Nova publicação oficial recebida.",
          String(publication.conteudo ?? "").slice(0, 280),
          "Revise o conteúdo e confirme qualquer prazo sugerido antes de usá-lo.",
        ].filter(Boolean).join("\n\n"),
        prioridade: "alta",
        status: "pendente",
        categoria: "Publicação",
        pontos: 1,
        tags: ["intimação", "publicação-oficial"],
        source_type: "publicacao",
        source_id: publication.id,
      }, {
        onConflict: "tenant_id,source_type,source_id",
        ignoreDuplicates: true,
      });
      if (insertError) throw insertError;

      const { data: task, error: taskError } = await admin
        .from("tarefas")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("source_type", "publicacao")
        .eq("source_id", publication.id)
        .maybeSingle();
      if (taskError || !task) throw taskError ?? new Error("task_not_found");

      const { error: linkError } = await admin
        .from("publication_task_links")
        .upsert({
          tenant_id: input.tenantId,
          publication_id: publication.id,
          task_id: task.id,
        }, { onConflict: "tenant_id,publication_id" });
      if (linkError) throw linkError;
      linked += 1;
    } catch {
      failed += 1;
      console.error("legal-ingestion: publication review task failed", {
        tenantId: input.tenantId,
        publicationId: publication.id,
      });
    }
  }

  return { linked, failed };
}

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
