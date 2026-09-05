import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/tenant-auth.ts";
import { LegalPortalError } from "../_shared/legal-portal-adapter.ts";
import {
  type PortalConnectionRow,
  recordPortalFailure,
  syncPortalConnection,
} from "../_shared/legal-portal-sync.ts";

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("server_configuration_error");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function authorized(request: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET");
  return Boolean(expected && request.headers.get("x-cron-secret") === expected);
}

function retryAt(attempts: number): string {
  const minutes = Math.min(360, 5 * 2 ** Math.min(attempts, 6));
  return new Date(Date.now() + minutes * 60_000 + Math.floor(Math.random() * 30_000)).toISOString();
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  const admin = adminClient();
  const now = new Date().toISOString();
  await admin.from("legal_portal_sync_jobs").update({
    state: "retry",
    lease_owner: null,
    lease_expires_at: null,
    next_attempt_at: now,
    last_error_code: "worker_interrupted",
  }).in("state", ["leased", "running"]).lt("lease_expires_at", now);

  const { data: connections, error: connectionError } = await admin
    .from("legal_portal_connections")
    .select("id,tenant_id,provider,court_code,vault_secret_id,login_identifier_masked,status,created_by,last_success_at")
    .eq("status", "active")
    .not("vault_secret_id", "is", null)
    .or(`last_success_at.is.null,last_success_at.lt.${new Date(Date.now() - 30 * 60_000).toISOString()}`)
    .limit(20);
  if (connectionError) return json({ error: "operation_failed" }, 500);

  const bucket = Math.floor(Date.now() / (30 * 60_000));
  for (const connection of connections ?? []) {
    await admin.from("legal_portal_sync_jobs").upsert({
      tenant_id: connection.tenant_id,
      connection_id: connection.id,
      scope: "future",
      state: "pending",
      priority: 100,
      idempotency_key: `future:${connection.id}:${bucket}`,
      next_attempt_at: now,
      created_by: connection.created_by,
    }, { onConflict: "tenant_id,idempotency_key", ignoreDuplicates: true });
  }

  const { data: jobs, error: jobError } = await admin.from("legal_portal_sync_jobs")
    .select("id,tenant_id,connection_id,attempts")
    .in("state", ["pending", "retry"])
    .lte("next_attempt_at", now)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(3);
  if (jobError) return json({ error: "operation_failed" }, 500);

  const workerId = crypto.randomUUID();
  const results = { processed: 0, completed: 0, failed: 0, retry: 0 };
  for (const job of jobs ?? []) {
    const leaseExpiresAt = new Date(Date.now() + 8 * 60_000).toISOString();
    const { data: leased } = await admin.from("legal_portal_sync_jobs").update({
      state: "running",
      lease_owner: workerId,
      lease_expires_at: leaseExpiresAt,
      attempts: job.attempts + 1,
      started_at: now,
    }).eq("tenant_id", job.tenant_id).eq("id", job.id)
      .in("state", ["pending", "retry"]).select("id").maybeSingle();
    if (!leased) continue;
    results.processed += 1;

    const { data: connection, error } = await admin.from("legal_portal_connections")
      .select("id,tenant_id,provider,court_code,vault_secret_id,login_identifier_masked,status,created_by")
      .eq("tenant_id", job.tenant_id).eq("id", job.connection_id).maybeSingle();
    if (error || !connection) {
      await admin.from("legal_portal_sync_jobs").update({
        state: "failed", last_error_code: "connection_not_found", finished_at: new Date().toISOString(),
      }).eq("tenant_id", job.tenant_id).eq("id", job.id);
      results.failed += 1;
      continue;
    }

    try {
      const sync = await syncPortalConnection(admin, connection as PortalConnectionRow);
      await admin.from("legal_portal_sync_jobs").update({
        state: "completed",
        received_count: sync.received,
        created_count: sync.created,
        updated_count: sync.updated,
        ignored_count: sync.ignored,
        lease_owner: null,
        lease_expires_at: null,
        finished_at: new Date().toISOString(),
        last_error_code: null,
      }).eq("tenant_id", job.tenant_id).eq("id", job.id);
      results.completed += 1;
    } catch (syncError) {
      const code = syncError instanceof LegalPortalError ? syncError.code : "operation_failed";
      await recordPortalFailure(admin, connection as PortalConnectionRow, code);
      const permanent = [
        "invalid_credentials",
        "captcha_required",
        "certificate_required",
        "layout_changed",
        "login_page_changed",
        "post_login_navigation_changed",
        "agenda_navigation_changed",
        "agenda_page_changed",
      ].includes(code);
      await admin.from("legal_portal_sync_jobs").update({
        state: permanent ? "failed" : "retry",
        next_attempt_at: permanent ? now : retryAt(job.attempts + 1),
        last_error_code: code,
        lease_owner: null,
        lease_expires_at: null,
        finished_at: permanent ? new Date().toISOString() : null,
      }).eq("tenant_id", job.tenant_id).eq("id", job.id);
      if (permanent) results.failed += 1;
      else results.retry += 1;
    }
  }
  return json(results);
});
