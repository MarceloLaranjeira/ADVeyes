import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";
import {
  createProcessMonitor,
  EscavadorApiError,
} from "../_shared/escavador-client.ts";

interface ConfirmRequest {
  action?: "overview" | "confirm";
  tenantId?: string;
  candidateIds?: string[];
  frequency?: "DIARIA" | "SEMANAL";
  includePublicDocuments?: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: ConfirmRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  const tenantId = body.tenantId?.trim();
  if (!tenantId || !UUID_PATTERN.test(tenantId)) {
    return json({ error: "invalid_payload" }, 400);
  }

  const { data: membership, error: membershipError } = await auth.admin
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "operation_failed" }, 500);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return json({ error: "permission_denied" }, 403);
  }

  if (body.action === "overview") {
    const [professionals, registrations, discoveries, monitors] =
      await Promise.all([
        auth.admin.from("equipe").select("id, nome, email, oab, cargo, ativo")
          .eq("tenant_id", tenantId).order("nome"),
        auth.admin.from("lawyer_registrations")
          .select("id, professional_id, oab_number, oab_state, oab_type, status, verified_name, last_discovery_at")
          .eq("tenant_id", tenantId).order("created_at"),
        auth.admin.from("process_discoveries")
          .select("id, lawyer_registration_id, numero_cnj, state, title_active_party, title_passive_party, tribunal, court_unit, process_status, last_movement_at")
          .eq("tenant_id", tenantId).order("provider_fetched_at", {
            ascending: false,
          }),
        auth.admin.from("legal_provider_monitors")
          .select("id, process_id, external_id, frequency, status, last_error_code, updated_at")
          .eq("tenant_id", tenantId).order("updated_at", { ascending: false }),
      ]);
    if (
      professionals.error || registrations.error || discoveries.error ||
      monitors.error
    ) {
      return json({ error: "operation_failed" }, 500);
    }
    return json({
      providerConfigured: Boolean(Deno.env.get("ESCAVADOR_API_TOKEN")),
      professionals: professionals.data ?? [],
      registrations: registrations.data ?? [],
      discoveries: discoveries.data ?? [],
      monitors: monitors.data ?? [],
    });
  }

  const candidateIds = Array.from(new Set(body.candidateIds ?? []));
  const frequency = body.frequency ?? "DIARIA";
  const includePublicDocuments = body.includePublicDocuments ?? true;
  if (
    candidateIds.length === 0 || candidateIds.length > 20 ||
    candidateIds.some((id) => !UUID_PATTERN.test(id)) ||
    !["DIARIA", "SEMANAL"].includes(frequency)
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  const { data: candidates, error: candidatesError } = await auth.admin
    .from("process_discoveries")
    .select(
      "id, lawyer_registration_id, numero_cnj, state, title_active_party, title_passive_party, tribunal, court_unit, process_status",
    )
    .eq("tenant_id", tenantId)
    .in("id", candidateIds);
  if (candidatesError) return json({ error: "operation_failed" }, 500);
  if ((candidates ?? []).length !== candidateIds.length) {
    return json({ error: "candidate_not_found" }, 404);
  }

  const token = Deno.env.get("ESCAVADOR_API_TOKEN");
  const results: Array<Record<string, unknown>> = [];

  for (const candidate of candidates ?? []) {
    const { data: confirmation, error: confirmationError } = await auth.admin
      .rpc("confirm_discovered_process", {
        p_tenant_id: tenantId,
        p_candidate_id: candidate.id,
        p_actor_user_id: auth.user.id,
        p_frequency: frequency,
        p_include_public_documents: includePublicDocuments,
      })
      .single();
    if (confirmationError || !confirmation) {
      console.error("legal-confirmation: transactional confirmation failed");
      return json({ error: "operation_failed" }, 500);
    }

    let activation = token
      ? confirmation.monitor_status
      : "awaiting_token";
    if (token && !confirmation.external_id) {
      try {
        const external = await createProcessMonitor({
          token,
          processNumber: confirmation.process_number,
          tribunal: confirmation.tribunal,
          frequency,
          includePublicDocuments,
        });
        activation = "pending";
        await auth.admin.from("legal_provider_monitors").update({
          external_id: String(external.id),
          status: "pending",
          last_error_code: null,
          last_error_message: null,
        }).eq("id", confirmation.monitor_id).eq("tenant_id", tenantId);
        await auth.admin.from("legal_usage_events").insert({
          tenant_id: tenantId,
          provider: "escavador",
          operation: "monitor_created",
          external_reference: String(external.id),
          metadata: { processId: confirmation.process_id },
        });
      } catch (error) {
        const code = error instanceof EscavadorApiError
          ? error.code
          : "escavador_request_failed";
        activation = "failed";
        await auth.admin.from("legal_provider_monitors").update({
          status: "failed",
          last_error_code: code,
          last_error_message: "Falha ao ativar monitoramento no provedor.",
        }).eq("id", confirmation.monitor_id).eq("tenant_id", tenantId);
      }
    }

    results.push({
      candidateId: candidate.id,
      processId: confirmation.process_id,
      processNumber: confirmation.process_number,
      activation,
    });
  }

  await auth.admin.from("tenant_audit_events").insert({
    tenant_id: tenantId,
    actor_user_id: auth.user.id,
    action: "legal.processes_confirmed",
    target_type: "process_discovery",
    metadata: { quantity: results.length, providerConfigured: Boolean(token) },
  });

  return json({
    confirmed: results.length,
    providerConfigured: Boolean(token),
    results,
  });
});
