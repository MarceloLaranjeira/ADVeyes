import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { LegalPortalCredentials, LegalPortalSnapshot } from "./legal-portal-adapter.ts";
import { LegalPortalError } from "./legal-portal-adapter.ts";
import { ProjudiTjamClient } from "./projudi-tjam-client.ts";

export interface PortalConnectionRow {
  id: string;
  tenant_id: string;
  provider: "projudi_tjam";
  court_code: string;
  vault_secret_id: string | null;
  login_identifier_masked: string | null;
  status: string;
  created_by: string | null;
}

export interface PortalSyncResult {
  received: number;
  created: number;
  updated: number;
  ignored: number;
  fetchedAt: string;
}

function normalizedProcessNumber(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function statusLabel(value: string): string {
  if (value === "cancelled") return "Cancelada";
  if (value === "completed") return "Realizada";
  if (value === "rescheduled") return "Adiada";
  return "Confirmada";
}

function portalClient(provider: string): ProjudiTjamClient {
  if (provider === "projudi_tjam") return new ProjudiTjamClient();
  throw new LegalPortalError("layout_changed");
}

export async function readPortalCredentials(
  admin: SupabaseClient,
  secretId: string | null,
): Promise<LegalPortalCredentials> {
  if (!secretId) throw new LegalPortalError("invalid_credentials");
  const { data, error } = await admin.rpc("legal_portal_read_secret", {
    p_secret_id: secretId,
  });
  if (error || typeof data !== "string") throw new LegalPortalError("invalid_credentials");
  try {
    const parsed = JSON.parse(data) as Partial<LegalPortalCredentials>;
    if (!parsed.login?.trim() || !parsed.password) throw new Error("invalid");
    return { login: parsed.login.trim(), password: parsed.password };
  } catch {
    throw new LegalPortalError("invalid_credentials");
  }
}

export async function storePortalCredentials(
  admin: SupabaseClient,
  connectionId: string,
  credentials: LegalPortalCredentials,
): Promise<string> {
  const { data, error } = await admin.rpc("legal_portal_store_secret", {
    p_connection_id: connectionId,
    p_secret: JSON.stringify(credentials),
  });
  if (error || typeof data !== "string") throw error ?? new Error("credential_store_failed");
  return data;
}

export async function deletePortalCredentials(
  admin: SupabaseClient,
  secretId: string | null,
): Promise<void> {
  if (!secretId) return;
  const { error } = await admin.rpc("legal_portal_delete_secret", {
    p_secret_id: secretId,
  });
  if (error) throw error;
}

export async function persistPortalSnapshot(
  admin: SupabaseClient,
  connection: PortalConnectionRow,
  snapshot: LegalPortalSnapshot,
): Promise<PortalSyncResult> {
  const { data: processes, error: processError } = await admin.from("processos")
    .select("id, numero, cliente_nome, user_id, vara")
    .eq("tenant_id", connection.tenant_id);
  if (processError) throw processError;
  const processMap = new Map((processes ?? []).map(process => [
    normalizedProcessNumber(process.numero), process,
  ]));

  const externalIds = snapshot.hearings.map(item => item.externalId);
  const { data: existing, error: existingError } = externalIds.length
    ? await admin.from("audiencias")
      .select("external_id, manual_locked")
      .eq("tenant_id", connection.tenant_id)
      .eq("source_provider", snapshot.provider)
      .in("external_id", externalIds)
    : { data: [], error: null };
  if (existingError) throw existingError;
  const existingIds = new Set((existing ?? []).map(row => row.external_id));
  const lockedIds = new Set((existing ?? []).filter(row => row.manual_locked).map(row => row.external_id));

  const fallbackUserId = connection.created_by ?? (processes ?? [])[0]?.user_id ?? null;
  if (snapshot.hearings.length && !fallbackUserId) throw new Error("hearing_owner_unavailable");

  const rows = snapshot.hearings.filter(item => !lockedIds.has(item.externalId)).map(item => {
    const process = processMap.get(normalizedProcessNumber(item.processNumber)) ?? null;
    return {
      tenant_id: connection.tenant_id,
      user_id: process?.user_id ?? fallbackUserId,
      processo_id: process?.id ?? null,
      processo_numero: item.processNumber,
      cliente_nome: process?.cliente_nome ?? null,
      tipo: item.type,
      data_hora: item.startsAt,
      ends_at: item.endsAt,
      vara: item.courtBody ?? process?.vara ?? null,
      local: item.location,
      observacoes: "Audiência importada da agenda autenticada do Projudi/TJAM.",
      status: statusLabel(item.status),
      source_provider: snapshot.provider,
      external_id: item.externalId,
      extraction_confidence: 1,
      source_evidence: item.evidence,
      review_status: "confirmed",
      detected_at: snapshot.fetchedAt,
      source_updated_at: snapshot.fetchedAt,
      event_timezone: item.timezone,
      modality: item.modality,
      remote_url: item.remoteUrl,
      event_status: item.status,
      court_code: connection.court_code,
      source_references: {
        provider: snapshot.provider,
        connection_id: connection.id,
        source_url: item.sourceUrl,
      },
      manual_locked: false,
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) {
    const { error } = await admin.from("audiencias").upsert(rows, {
      onConflict: "tenant_id,source_provider,external_id",
    });
    if (error) throw error;
  }

  return {
    received: snapshot.hearings.length,
    created: rows.filter(row => !existingIds.has(row.external_id)).length,
    updated: rows.filter(row => existingIds.has(row.external_id)).length,
    ignored: lockedIds.size,
    fetchedAt: snapshot.fetchedAt,
  };
}

export async function syncPortalConnection(
  admin: SupabaseClient,
  connection: PortalConnectionRow,
): Promise<PortalSyncResult> {
  const credentials = await readPortalCredentials(admin, connection.vault_secret_id);
  const snapshot = await portalClient(connection.provider).fetchFutureHearings(credentials);
  const result = await persistPortalSnapshot(admin, connection, snapshot);
  const { error } = await admin.from("legal_portal_connections").update({
    status: "active",
    capabilities: snapshot.capabilities,
    last_validated_at: result.fetchedAt,
    last_success_at: result.fetchedAt,
    last_error_code: null,
    last_error_at: null,
    last_result: result,
  }).eq("tenant_id", connection.tenant_id).eq("id", connection.id);
  if (error) throw error;
  return result;
}

export function portalFailureStatus(code: string): string {
  if (code === "invalid_credentials") return "invalid";
  if (code === "captcha_required" || code === "certificate_required") return "action_required";
  if (code === "layout_changed") return "paused";
  return "active";
}

export async function recordPortalFailure(
  admin: SupabaseClient,
  connection: PortalConnectionRow,
  code: string,
): Promise<void> {
  await admin.from("legal_portal_connections").update({
    status: portalFailureStatus(code),
    last_error_code: code,
    last_error_at: new Date().toISOString(),
  }).eq("tenant_id", connection.tenant_id).eq("id", connection.id);
}
