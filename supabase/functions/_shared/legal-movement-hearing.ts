import { extractHearingSignal } from "./legal-hearing-extraction.ts";

export interface StoredMovementForHearing {
  id: string;
  external_id: string;
  provider: "datajud" | "escavador" | "manual";
  title: string | null;
  content: string | null;
  description: string | null;
  notes: string | null;
  occurred_at: string | null;
  source_name: string | null;
}

export interface ProcessForHearing {
  id: string;
  numero: string | null;
  cliente_nome: string | null;
  user_id: string;
  vara: string | null;
  tribunal?: string | null;
}

export function buildMovementHearingRecords(input: {
  tenantId: string;
  process: ProcessForHearing;
  movement: StoredMovementForHearing;
  timezone?: string;
  timezoneOffset?: string;
}) {
  const evidence = [
    input.movement.title,
    input.movement.content,
    input.movement.description,
    input.movement.notes,
  ].filter(Boolean).join("\n");
  const signal = extractHearingSignal(evidence, input.timezoneOffset ?? "-04:00");
  if (!signal) return null;

  const externalId = `movimento:${input.movement.id}`;
  const signalRow = {
    tenant_id: input.tenantId,
    process_id: input.process.id,
    movement_id: input.movement.id,
    source_provider: input.movement.provider,
    external_id: externalId,
    signal_kind: signal.kind,
    event_type: signal.type,
    event_status: "scheduled",
    starts_at: signal.startsAt,
    timezone: input.timezone ?? "America/Manaus",
    evidence: signal.evidence,
    confidence: signal.confidence,
    review_status: "pending",
    source_metadata: {
      source_name: input.movement.source_name,
      movement_external_id: input.movement.external_id,
      movement_occurred_at: input.movement.occurred_at,
    },
  };

  const hearingRow = signal.kind === "scheduled" && signal.startsAt
    ? {
      tenant_id: input.tenantId,
      user_id: input.process.user_id,
      processo_id: input.process.id,
      processo_numero: input.process.numero,
      cliente_nome: input.process.cliente_nome,
      tipo: signal.type,
      data_hora: signal.startsAt,
      vara: input.process.vara,
      observacoes: `${signal.evidence}\n\nEvento detectado em movimentação oficial. Confirme data, horário e local antes de utilizar.`,
      status: "A confirmar",
      source_provider: input.movement.provider,
      external_id: externalId,
      movement_id: input.movement.id,
      extraction_confidence: signal.confidence,
      source_evidence: signal.evidence,
      review_status: "pending",
      event_status: "scheduled",
      event_timezone: input.timezone ?? "America/Manaus",
    }
    : null;

  return { signalRow, hearingRow };
}
