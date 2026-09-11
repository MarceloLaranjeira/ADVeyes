import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  authenticateTenantRequest,
  corsHeaders,
  failureResponse,
  json,
  resolveTenantLegalAccess,
  type TenantLegalAccess,
} from "../_shared/tenant-auth.ts";
import { LegalPortalError } from "../_shared/legal-portal-adapter.ts";
import {
  deletePortalCredentials,
  type PortalConnectionRow,
  recordPortalFailure,
  storePortalCredentials,
  syncPortalConnection,
} from "../_shared/legal-portal-sync.ts";
import { maskProjudiLogin, ProjudiTjamClient } from "../_shared/projudi-tjam-client.ts";

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function courtCode(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "TJAM";
  return /^TJ[A-Z]{2,3}$/.test(normalized) ? normalized : "";
}

function publicConnection(connection: Record<string, unknown> | null) {
  if (!connection) return null;
  return {
    id: connection.id,
    provider: connection.provider,
    courtCode: connection.court_code,
    loginMasked: connection.login_identifier_masked,
    status: connection.status,
    capabilities: connection.capabilities,
    lastValidatedAt: connection.last_validated_at,
    lastSuccessAt: connection.last_success_at,
    lastErrorCode: connection.last_error_code,
    lastErrorAt: connection.last_error_at,
    lastResult: connection.last_result,
    sessionExpiresAt: connection.session_expires_at,
    configured: Boolean(connection.vault_secret_id),
  };
}

async function loadCourtRegistry(admin: SupabaseClient) {
  const { data, error } = await admin.from("legal_court_registry")
    .select("court_code,display_name,timezone,authenticated_adapter,authenticated_status,capabilities")
    .like("court_code", "TJ%")
    .order("display_name");
  if (error) throw error;
  return (data ?? []).map(court => ({
    courtCode: court.court_code,
    displayName: court.display_name,
    timezone: court.timezone,
    authenticatedStatus: court.authenticated_status,
    authenticatedAvailable: Boolean(
      court.authenticated_adapter && ["pilot", "active"].includes(court.authenticated_status),
    ),
    capabilities: court.capabilities,
  }));
}

async function loadConnection(admin: SupabaseClient, tenantId: string, selectedCourt: string): Promise<PortalConnectionRow | null> {
  const { data, error } = await admin.from("legal_portal_connections")
    .select("id,tenant_id,provider,court_code,vault_secret_id,login_identifier_masked,status,created_by,session_expires_at")
    .eq("tenant_id", tenantId).eq("court_code", selectedCourt)
    .maybeSingle();
  if (error) throw error;
  return data as PortalConnectionRow | null;
}

async function statusPayload(admin: SupabaseClient, tenantId: string, access: TenantLegalAccess, selectedCourt: string) {
  const courts = await loadCourtRegistry(admin);
  const { data: connection, error } = await admin.from("legal_portal_connections")
    .select("id,provider,court_code,vault_secret_id,login_identifier_masked,status,capabilities,last_validated_at,last_success_at,last_error_code,last_error_at,last_result,session_expires_at")
    .eq("tenant_id", tenantId).eq("court_code", selectedCourt)
    .maybeSingle();
  if (error) throw error;
  return {
    access: {
      role: access.role,
      canManage: Boolean(access.canManageAll && access.canMutate),
    },
    selectedCourtCode: selectedCourt,
    courts,
    connection: publicConnection(connection),
  };
}

function mutationAllowed(access: { canManageAll: boolean; canMutate: boolean }): boolean {
  return access.canManageAll && access.canMutate;
}

async function audit(admin: SupabaseClient, actorId: string, action: string, tenantId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await admin.from("platform_audit_events").insert({
    actor_user_id: actorId,
    action,
    target_type: "legal_portal_connection",
    target_id: tenantId,
    metadata: { tenant_id: tenantId, provider: "projudi_tjam", ...metadata },
  });
  if (error) console.error("legal-portal-admin: audit failed", error.code ?? "");
}

async function enqueueInitialSync(admin: SupabaseClient, connection: PortalConnectionRow, actorId: string) {
  const { data: activeJob, error: activeJobError } = await admin
    .from("legal_portal_sync_jobs")
    .select("id")
    .eq("tenant_id", connection.tenant_id)
    .eq("connection_id", connection.id)
    .in("state", ["pending", "retry", "leased", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeJobError) throw activeJobError;
  if (activeJob) return;

  const { error } = await admin.from("legal_portal_sync_jobs").insert({
    tenant_id: connection.tenant_id,
    connection_id: connection.id,
    scope: "future",
    state: "pending",
    priority: 200,
    idempotency_key: `manual:${connection.id}:${crypto.randomUUID()}`,
    next_attempt_at: new Date().toISOString(),
    created_by: actorId,
  });
  if (error) throw error;
}

function dispatchPortalWorker(): void {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!supabaseUrl || !cronSecret) return;
  const task = fetch(`${supabaseUrl}/functions/v1/legal-portal-worker`, {
    method: "POST",
    headers: { "x-cron-secret": cronSecret, "Content-Type": "application/json" },
    body: "{}",
  }).then(response => {
    if (!response.ok) console.error("legal-portal-admin: worker dispatch failed", response.status);
  }).catch(() => console.error("legal-portal-admin: worker dispatch unavailable"));
  const runtime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
  }).EdgeRuntime;
  runtime?.waitUntil(task);
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  if (!validUuid(body.tenantId) || typeof body.action !== "string") {
    return json({ error: "invalid_payload" }, 400);
  }

  try {
    const access = await resolveTenantLegalAccess(auth.admin, auth.user.id, body.tenantId);
    if (!access) return json({ error: "permission_denied" }, 403);
    const selectedCourt = courtCode(body.courtCode);
    if (!selectedCourt) return json({ error: "invalid_court" }, 400);

    if (body.action === "status") {
      return json(await statusPayload(auth.admin, body.tenantId, access, selectedCourt));
    }
    if (!mutationAllowed(access)) return json({ error: "permission_denied" }, 403);

    if (body.action === "connect") {
      const { data: registry, error: registryError } = await auth.admin.from("legal_court_registry")
        .select("authenticated_adapter,authenticated_status")
        .eq("court_code", selectedCourt)
        .maybeSingle();
      if (registryError) throw registryError;
      if (!registry || registry.authenticated_adapter !== "projudi_tjam" ||
          !["pilot", "active"].includes(registry.authenticated_status)) {
        return json({ error: "court_not_available" }, 409);
      }
      const login = typeof body.login === "string" ? body.login.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (login.length < 3 || login.length > 80 || password.length < 4 || password.length > 256) {
        return json({ error: "invalid_payload" }, 400);
      }
      let connection = await loadConnection(auth.admin, body.tenantId, selectedCourt);
      const connectionId = connection?.id ?? crypto.randomUUID();
      const masked = maskProjudiLogin(login);
      const { data: savedConnection, error: connectionError } = await auth.admin
        .from("legal_portal_connections").upsert({
          id: connectionId,
          tenant_id: body.tenantId,
          provider: "projudi_tjam",
          court_code: selectedCourt,
          login_identifier_masked: masked,
          status: "validating",
          last_error_code: null,
          last_error_at: null,
          created_by: connection?.created_by ?? auth.user.id,
          updated_by: auth.user.id,
        }, { onConflict: "tenant_id,provider,court_code" })
        .select("id,tenant_id,provider,court_code,vault_secret_id,login_identifier_masked,status,created_by,session_expires_at")
        .single();
      if (connectionError) throw connectionError;
      connection = savedConnection as PortalConnectionRow;

      try {
        const credentials = { login, password };
        const validation = await new ProjudiTjamClient().validateConnection(credentials);
        const secretId = await storePortalCredentials(auth.admin, connection.id, {
          ...credentials,
          session: validation.session,
        });
        connection = { ...connection, vault_secret_id: secretId, status: "active" };
        const { error: activeError } = await auth.admin.from("legal_portal_connections").update({
          vault_secret_id: secretId,
          status: "active",
          capabilities: validation.capabilities,
          last_validated_at: validation.validatedAt,
          session_expires_at: validation.session.expiresAt,
          last_error_code: null,
          last_error_at: null,
          last_result: null,
          updated_by: auth.user.id,
        }).eq("tenant_id", body.tenantId).eq("id", connection.id);
        if (activeError) throw activeError;
        await enqueueInitialSync(auth.admin, connection, auth.user.id);
        dispatchPortalWorker();
        await audit(auth.admin, auth.user.id, "legal_portal_connected", body.tenantId, { sync_queued: true });
        return json({ ...(await statusPayload(auth.admin, body.tenantId, access, selectedCourt)), queued: true });
      } catch (error) {
        const code = error instanceof LegalPortalError ? error.code : "operation_failed";
        await recordPortalFailure(
          auth.admin,
          connection,
          code,
          error instanceof LegalPortalError ? error.diagnostic : null,
        );
        await audit(auth.admin, auth.user.id, "legal_portal_connection_failed", body.tenantId, { code });
        if (error instanceof LegalPortalError) return json({ error: code }, 422);
        throw error;
      }
    }

    const connection = await loadConnection(auth.admin, body.tenantId, selectedCourt);
    if (!connection) return json({ error: "portal_not_configured" }, 404);

    if (body.action === "sync") {
      await enqueueInitialSync(auth.admin, connection, auth.user.id);
      dispatchPortalWorker();
      await audit(auth.admin, auth.user.id, "legal_portal_sync", body.tenantId, { sync_queued: true });
      return json({ ...(await statusPayload(auth.admin, body.tenantId, access, selectedCourt)), queued: true });
    }

    if (body.action === "test") {
      try {
        const result = await syncPortalConnection(auth.admin, connection);
        await audit(auth.admin, auth.user.id, `legal_portal_${body.action}`, body.tenantId, {
          received: result.received, created: result.created, updated: result.updated,
        });
        return json({ ...(await statusPayload(auth.admin, body.tenantId, access, selectedCourt)), sync: result });
      } catch (error) {
        const code = error instanceof LegalPortalError ? error.code : "operation_failed";
        await recordPortalFailure(
          auth.admin,
          connection,
          code,
          error instanceof LegalPortalError ? error.diagnostic : null,
        );
        if (error instanceof LegalPortalError) return json({ error: code }, 422);
        throw error;
      }
    }

    if (body.action === "disconnect") {
      await deletePortalCredentials(auth.admin, connection.vault_secret_id);
      const now = new Date().toISOString();
      const { error } = await auth.admin.from("legal_portal_connections").update({
        vault_secret_id: null,
        status: "revoked",
        session_expires_at: null,
        last_error_code: null,
        last_error_at: null,
        updated_by: auth.user.id,
      }).eq("tenant_id", body.tenantId).eq("id", connection.id);
      if (error) throw error;
      await auth.admin.from("legal_portal_sync_jobs").update({
        state: "cancelled", finished_at: now,
      }).eq("tenant_id", body.tenantId).eq("connection_id", connection.id)
        .in("state", ["pending", "retry", "leased", "running"]);
      await audit(auth.admin, auth.user.id, "legal_portal_disconnected", body.tenantId);
      return json(await statusPayload(auth.admin, body.tenantId, access, selectedCourt));
    }

    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    return failureResponse("legal-portal-admin", error);
  }
});
