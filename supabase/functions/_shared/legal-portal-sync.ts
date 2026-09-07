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
  session_expires_at?: string | null;
}

export interface PortalSyncResult {
  received: number;
  created: number;
  updated: number;
  ignored: number;
  fetchedAt: string;
  diagnostic?: Record<string, string | number | boolean>;
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
  if (!secretId) throw new LegalPortalError("credential_missing");
  const { data, error } = await admin.rpc("legal_portal_read_secret", {
    p_secret_id: secretId,
  });
  if (error || typeof data !== "string") throw new LegalPortalError("invalid_credentials");
  try {
    const parsed = JSON.parse(data) as Partial<LegalPortalCredentials>;
    if (!parsed.login?.trim() || !parsed.password) throw new Error("invalid");
    const session = parsed.session && typeof parsed.session === "object" &&
        typeof parsed.session.entryUrl === "string" &&
        typeof parsed.session.authenticatedAt === "string" &&
        typeof parsed.session.refreshAt === "string" &&
        typeof parsed.session.expiresAt === "string" &&
        parsed.session.cookies && typeof parsed.session.cookies === "object"
      ? parsed.session
      : undefined;
    return { login: parsed.login.trim(), password: parsed.password, session };
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

  const { data: memberships, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("user_id, role, created_at")
    .eq("tenant_id", connection.tenant_id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (membershipError) throw membershipError;
  const activeUserIds = new Set((memberships ?? []).map(membership => membership.user_id));
  const roleOrder: Record<string, number> = { owner: 0, admin: 1, lawyer: 2, assistant: 3, finance: 4 };
  const fallbackMembership = [...(memberships ?? [])]
    .sort((left, right) => (roleOrder[left.role] ?? 9) - (roleOrder[right.role] ?? 9))[0];

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

  const connectionCreator = connection.created_by && activeUserIds.has(connection.created_by)
    ? connection.created_by
    : null;
  const processOwner = (processes ?? []).find(process => activeUserIds.has(process.user_id))?.user_id ?? null;
  const fallbackUserId = connectionCreator ?? processOwner ?? fallbackMembership?.user_id ?? null;
  if (snapshot.hearings.length && !fallbackUserId) throw new Error("hearing_owner_unavailable");

  const rows = snapshot.hearings.filter(item => !lockedIds.has(item.externalId)).map(item => {
    const process = processMap.get(normalizedProcessNumber(item.processNumber)) ?? null;
    return {
      tenant_id: connection.tenant_id,
      user_id: process?.user_id && activeUserIds.has(process.user_id) ? process.user_id : fallbackUserId,
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
    ...(snapshot.diagnostic ? { diagnostic: snapshot.diagnostic } : {}),
  };
}

export async function syncPortalConnection(
  admin: SupabaseClient,
  connection: PortalConnectionRow,
): Promise<PortalSyncResult> {
  const credentials = await readPortalCredentials(admin, connection.vault_secret_id);
  const snapshot = await portalClient(connection.provider).fetchFutureHearings(credentials);
  const secretId = await storePortalCredentials(admin, connection.id, {
    ...credentials,
    session: snapshot.session,
  });
  const result = await persistPortalSnapshot(admin, connection, snapshot);
  const { error } = await admin.from("legal_portal_connections").update({
    status: "active",
    vault_secret_id: secretId,
    capabilities: snapshot.capabilities,
    last_validated_at: result.fetchedAt,
    session_expires_at: snapshot.session.expiresAt,
    last_success_at: result.fetchedAt,
    last_error_code: null,
    last_error_at: null,
    last_result: result,
  }).eq("tenant_id", connection.tenant_id).eq("id", connection.id);
  if (error) throw error;
  return result;
}

export function portalFailureStatus(code: string, hasStoredSecret = false): string {
  if (code === "credential_missing") return "pending";
  if (code === "invalid_credentials") return "invalid";
  if (code === "captcha_required" || code === "certificate_required" || code === "mfa_required") return "action_required";
  if ([
    "layout_changed",
    "login_page_changed",
    "agenda_navigation_changed",
    "agenda_page_changed",
  ].includes(code)) return "paused";
  // Falhas transitórias só preservam o estado ativo de uma conexão que já
  // possui credencial validada. Uma primeira tentativa incompleta fica pendente.
  return hasStoredSecret ? "active" : "pending";
}

export async function recordPortalFailure(
  admin: SupabaseClient,
  connection: PortalConnectionRow,
  code: string,
  diagnostic: Record<string, string | number | boolean> | null = null,
): Promise<void> {
  await admin.from("legal_portal_connections").update({
    status: portalFailureStatus(code, Boolean(connection.vault_secret_id)),
    last_error_code: code,
    last_error_at: new Date().toISOString(),
    last_result: diagnostic ? { code, diagnostic } : { code },
  }).eq("tenant_id", connection.tenant_id).eq("id", connection.id);
}
