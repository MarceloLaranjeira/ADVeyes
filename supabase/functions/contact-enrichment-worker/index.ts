import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  ContactEnrichmentError,
  fetchPublicContactEnrichment,
} from "../_shared/contact-enrichment.ts";
import { corsHeaders, json } from "../_shared/tenant-auth.ts";

interface ClaimedJob {
  id: string;
  tenant_id: string;
  contact_id: string;
  cnpj: string;
  attempts: number;
}

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("server_configuration_error");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function authorized(request: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET");
  return Boolean(expected && request.headers.get("x-cron-secret") === expected);
}

function retryAt(attempts: number): string {
  const minutes = Math.min(24 * 60, 5 * 2 ** Math.min(attempts, 8));
  return new Date(Date.now() + minutes * 60_000 + Math.floor(Math.random() * 30_000)).toISOString();
}

function maskCnpj(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.***.***/****-${cnpj.slice(-2)}`;
}

async function recordContactStatus(
  admin: SupabaseClient,
  job: ClaimedJob,
  input: {
    status: "completed" | "not_found" | "retry" | "failed";
    provider?: "brasilapi" | "opencnpj" | "serpro" | null;
    checkedAt: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    corporateName?: string | null;
    tradeName?: string | null;
    errorCode?: string | null;
  },
): Promise<string[]> {
  const { data, error } = await admin.rpc("apply_contact_enrichment_result", {
    p_tenant_id: job.tenant_id,
    p_contact_id: job.contact_id,
    p_status: input.status,
    p_provider: input.provider ?? null,
    p_cnpj_masked: maskCnpj(job.cnpj),
    p_checked_at: input.checkedAt,
    p_phone: input.phone ?? null,
    p_email: input.email ?? null,
    p_address: input.address ?? null,
    p_corporate_name: input.corporateName ?? null,
    p_trade_name: input.tradeName ?? null,
    p_error_code: input.errorCode ?? null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data.filter((value): value is string => typeof value === "string") : [];
}

async function completeJob(
  admin: SupabaseClient,
  job: ClaimedJob,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("contact_enrichment_jobs").update({
    lease_owner: null,
    lease_expires_at: null,
    ...patch,
  }).eq("tenant_id", job.tenant_id).eq("id", job.id).eq("status", "processing");
  if (error) throw error;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  const admin = adminClient();
  const workerId = crypto.randomUUID();
  const { data, error } = await admin.rpc("claim_contact_enrichment_jobs", {
    p_worker_id: workerId,
    p_limit: 10,
  });
  if (error) return json({ error: "operation_failed" }, 500);

  const jobs = (data ?? []) as ClaimedJob[];
  const results = { processed: 0, completed: 0, notFound: 0, retry: 0, failed: 0 };

  for (const job of jobs) {
    results.processed += 1;
    const checkedAt = new Date().toISOString();
    try {
      const enrichment = await fetchPublicContactEnrichment(job.cnpj);
      const fields = await recordContactStatus(admin, job, {
        status: "completed",
        provider: enrichment.provider,
        checkedAt: enrichment.checkedAt,
        phone: enrichment.phone,
        email: enrichment.email,
        address: enrichment.address,
        corporateName: enrichment.corporateName,
        tradeName: enrichment.tradeName,
      });
      await completeJob(admin, job, {
        status: "completed",
        provider: enrichment.provider,
        result_fields: fields,
        last_error_code: null,
        last_checked_at: enrichment.checkedAt,
        finished_at: enrichment.checkedAt,
      });
      results.completed += 1;
    } catch (unknownError) {
      const enrichmentError = unknownError instanceof ContactEnrichmentError
        ? unknownError
        : new ContactEnrichmentError("provider_unavailable", true);

      if (enrichmentError.code === "not_found") {
        await recordContactStatus(admin, job, {
          status: "not_found",
          checkedAt,
          errorCode: "not_found",
        });
        await completeJob(admin, job, {
          status: "not_found",
          result_fields: [],
          last_error_code: "not_found",
          last_checked_at: checkedAt,
          finished_at: checkedAt,
        });
        results.notFound += 1;
        continue;
      }

      const retry = enrichmentError.retryable && job.attempts < 8;
      await recordContactStatus(admin, job, {
        status: retry ? "retry" : "failed",
        checkedAt,
        errorCode: enrichmentError.code,
      });
      await completeJob(admin, job, {
        status: retry ? "retry" : "failed",
        next_attempt_at: retry ? retryAt(job.attempts) : checkedAt,
        result_fields: [],
        last_error_code: enrichmentError.code,
        last_checked_at: checkedAt,
        finished_at: retry ? null : checkedAt,
      });
      if (retry) results.retry += 1;
      else results.failed += 1;
    }
  }

  return json(results);
});
