// Captura manual de publicações e intimações do Escavador para um escritório.
// A normalização, a deduplicação e a gravação ficam nos módulos compartilhados,
// de modo que webhook, reconciliação e captura manual sigam as mesmas regras.

import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";
import { getEscavadorToken } from "../_shared/provider-secrets.ts";
import {
  EscavadorApiError,
  fetchLawyerPublications,
} from "../_shared/escavador-client.ts";
import {
  indexProcessesByNumber,
  ingestPublications,
  type ProcessReference,
} from "../_shared/legal-ingestion.ts";
import {
  formatCnj,
  normalizeEscavadorPublication,
} from "../_shared/legal-normalization.ts";

interface CaptureRequest {
  tenantId?: string;
}

interface LawyerRegistration {
  id: string;
  oab_number: string;
  oab_state: string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: CaptureRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  const tenantId = body.tenantId?.trim();
  if (!tenantId) return json({ error: "invalid_payload" }, 400);

  const { data: membership, error: membershipError } = await auth.admin
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "operation_failed" }, 500);
  if (!membership) return json({ error: "permission_denied" }, 403);

  const token = await getEscavadorToken(auth.admin);
  if (!token) {
    return json({
      error: "integration_not_configured",
      message: "O token do Escavador ainda não foi configurado.",
    }, 503);
  }

  const { data: registrations, error: registrationsError } = await auth.admin
    .from("lawyer_registrations")
    .select("id, oab_number, oab_state")
    .eq("tenant_id", tenantId)
    .neq("status", "disabled");
  if (registrationsError) return json({ error: "operation_failed" }, 500);
  if (!registrations?.length) {
    return json({
      captured: 0,
      ignored: 0,
      message: "Cadastre ao menos uma OAB para monitorar publicações.",
    });
  }

  const { data: run } = await auth.admin.from("legal_sync_runs").insert({
    tenant_id: tenantId,
    provider: "escavador",
    sync_kind: "publication",
    trigger_type: "manual",
    status: "running",
    created_by: auth.user.id,
    started_at: new Date().toISOString(),
  }).select("id").maybeSingle();

  const { data: processes, error: processesError } = await auth.admin
    .from("processos")
    .select("id, numero, cliente_nome, user_id")
    .eq("tenant_id", tenantId);
  if (processesError) return json({ error: "operation_failed" }, 500);

  const processByNumber = indexProcessesByNumber(
    (processes ?? []) as Array<ProcessReference & { numero: string }>,
    formatCnj,
  );

  let received = 0;
  let created = 0;
  let ignored = 0;
  const errors: string[] = [];

  for (const registration of registrations as LawyerRegistration[]) {
    try {
      const publications = await fetchLawyerPublications({
        token,
        oabNumber: registration.oab_number,
        oabState: registration.oab_state,
      });
      const receivedAt = new Date().toISOString();
      const result = await ingestPublications(auth.admin, {
        tenantId,
        provider: "escavador",
        fallbackUserId: auth.user.id,
        processByNumber,
        publications: publications.map((publication) =>
          normalizeEscavadorPublication(publication, { receivedAt })
        ),
      });
      received += result.received;
      created += result.created;
      ignored += result.ignored;
    } catch (error) {
      const code = error instanceof EscavadorApiError
        ? error.code
        : "operation_failed";
      errors.push(
        `${registration.oab_number}/${registration.oab_state}: ${code}`,
      );
    }
  }

  const status = errors.length === 0
    ? "succeeded"
    : created > 0
    ? "partial"
    : "failed";
  if (run?.id) {
    await auth.admin.from("legal_sync_runs").update({
      status,
      records_received: received,
      records_created: created,
      records_ignored: ignored,
      error_code: errors.length ? "provider_error" : null,
      error_message: errors.length ? errors.join("; ").slice(0, 1000) : null,
      finished_at: new Date().toISOString(),
    }).eq("id", run.id).eq("tenant_id", tenantId);
  }

  return json({
    captured: created,
    ignored,
    received,
    errors,
    message: created > 0
      ? `${created} publicação(ões) nova(s) capturada(s).`
      : "Nenhuma publicação nova foi localizada.",
  }, status === "failed" ? 502 : 200);
});
