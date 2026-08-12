import {
  authenticateTenantRequest,
  corsHeaders,
  json,
  resolveTenantLegalAccess,
} from "../_shared/tenant-auth.ts";
import {
  createProcessMonitor,
  EscavadorApiError,
} from "../_shared/escavador-client.ts";
import { getEscavadorToken } from "../_shared/provider-secrets.ts";

interface ConfirmRequest {
  action?: "overview" | "confirm";
  tenantId?: string;
  candidateIds?: string[];
  frequency?: "DIARIA" | "SEMANAL";
  includePublicDocuments?: boolean;
}

interface ConfirmationRow {
  process_id: string;
  process_number: string;
  tribunal: string | null;
  monitor_id: string;
  external_id: string | null;
  monitor_status: string;
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

  let access;
  try {
    access = await resolveTenantLegalAccess(auth.admin, auth.user.id, tenantId);
  } catch {
    return json({ error: "operation_failed" }, 500);
  }
  if (!access) {
    return json({ error: "permission_denied" }, 403);
  }

  if (body.action === "overview") {
    const [professionals, registrations, discoveries, monitors, sources] =
      await Promise.all([
        auth.admin.from("equipe").select("id, user_id, nome, email, oab, cargo, ativo")
          .eq("tenant_id", tenantId).order("nome"),
        auth.admin.from("lawyer_registrations")
          .select("id, professional_id, oab_number, oab_state, oab_type, status, verified_name, last_discovery_at")
          .eq("tenant_id", tenantId)
          .not("status", "in", "(disabled,invalid)")
          .order("created_at"),
        auth.admin.from("process_discoveries")
          .select("id, lawyer_registration_id, numero_cnj, state, title_active_party, title_passive_party, tribunal, court_unit, process_status, last_movement_at")
          .eq("tenant_id", tenantId).order("provider_fetched_at", {
            ascending: false,
          }),
        auth.admin.from("legal_provider_monitors")
          .select("id, process_id, external_id, frequency, status, last_error_code, updated_at")
          .eq("tenant_id", tenantId).order("updated_at", { ascending: false }),
        auth.admin.from("legal_sync_sources")
          .select("id, source_kind, provider, lawyer_registration_id, process_id, reference, active, last_attempt_at, last_success_at, next_sync_at, failure_count, last_error_code, paused_reason")
          .eq("tenant_id", tenantId).order("created_at"),
      ]);
    if (
      professionals.error || registrations.error || discoveries.error ||
      monitors.error || sources.error
    ) {
      return json({ error: "operation_failed" }, 500);
    }
    const token = await getEscavadorToken(auth.admin);
    const { data: usage } = await auth.admin.rpc(
      "provider_usage_summary_server",
      { p_tenant_id: tenantId },
    );

    let visibleProfessionals = professionals.data ?? [];
    let visibleRegistrations = registrations.data ?? [];
    let visibleDiscoveries = discoveries.data ?? [];
    let visibleMonitors = monitors.data ?? [];
    let visibleSources = sources.data ?? [];
    if (!access.canManageAll) {
      visibleProfessionals = visibleProfessionals.filter((professional) =>
        professional.user_id === auth.user.id
      );
      const professionalIds = new Set(visibleProfessionals.map((item) => item.id));
      visibleRegistrations = visibleRegistrations.filter((registration) =>
        professionalIds.has(registration.professional_id)
      );
      const registrationIds = new Set(visibleRegistrations.map((item) => item.id));
      visibleDiscoveries = visibleDiscoveries.filter((discovery) =>
        registrationIds.has(discovery.lawyer_registration_id)
      );
      const { data: links, error: linksError } = registrationIds.size
        ? await auth.admin.from("process_lawyers").select("process_id")
          .eq("tenant_id", tenantId)
          .in("lawyer_registration_id", [...registrationIds])
        : { data: [], error: null };
      if (linksError) return json({ error: "operation_failed" }, 500);
      const processIds = new Set((links ?? []).map((link) => link.process_id));
      visibleMonitors = visibleMonitors.filter((monitor) =>
        processIds.has(monitor.process_id)
      );
      visibleSources = visibleSources.filter((source) =>
        (source.lawyer_registration_id && registrationIds.has(source.lawyer_registration_id)) ||
        (source.process_id && processIds.has(source.process_id))
      );
    }

    return json({
      providerConfigured: Boolean(token),
      access: {
        role: access.role,
        canManageAll: access.canManageAll,
        canMutate: access.canMutate,
      },
      professionals: visibleProfessionals.map(({ user_id: _userId, ...item }) => item),
      registrations: visibleRegistrations,
      discoveries: visibleDiscoveries,
      monitors: visibleMonitors,
      sources: visibleSources,
      usage: usage ?? null,
    });
  }

  if (!access.canMutate) {
    return json({ error: "permission_denied" }, 403);
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
  if (!access.canManageAll) {
    const registrationIds = [...new Set(
      (candidates ?? []).map((candidate) => candidate.lawyer_registration_id),
    )];
    const { data: registrations, error: registrationsError } = await auth.admin
      .from("lawyer_registrations")
      .select("id, professional_id")
      .eq("tenant_id", tenantId)
      .in("id", registrationIds);
    if (registrationsError) return json({ error: "operation_failed" }, 500);
    const professionalIds = [...new Set(
      (registrations ?? []).map((registration) => registration.professional_id),
    )];
    const { data: owned, error: ownedError } = await auth.admin.from("equipe")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", auth.user.id)
      .in("id", professionalIds);
    if (ownedError) return json({ error: "operation_failed" }, 500);
    if ((owned ?? []).length !== professionalIds.length) {
      return json({ error: "permission_denied" }, 403);
    }
  }

  const token = await getEscavadorToken(auth.admin);
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
    const confirmed = confirmation as ConfirmationRow;

    let activation = token
      ? confirmed.monitor_status
      : "awaiting_token";
    if (token && !confirmed.external_id) {
      try {
        const external = await createProcessMonitor({
          token,
          processNumber: confirmed.process_number,
          tribunal: confirmed.tribunal,
          frequency,
          includePublicDocuments,
        });
        const externalId = String(external.id || (external as Record<string, unknown>).monitoramento_id || "").trim();
        activation = externalId ? "pending" : "failed";
        await auth.admin.from("legal_provider_monitors").update({
          ...(externalId ? { external_id: externalId } : {}),
          status: externalId ? "pending" : "failed",
          last_error_code: externalId ? null : "missing_external_id",
          last_error_message: externalId ? null : "O provedor não retornou um ID de monitoramento válido.",
        }).eq("id", confirmed.monitor_id).eq("tenant_id", tenantId);
        if (externalId) {
          await auth.admin.from("legal_usage_events").insert({
            tenant_id: tenantId,
            provider: "escavador",
            operation: "monitor_created",
            external_reference: externalId,
            metadata: { processId: confirmed.process_id },
          });
        }
      } catch (error) {
        const code = error instanceof EscavadorApiError
          ? error.code
          : "escavador_request_failed";
        activation = "failed";
        await auth.admin.from("legal_provider_monitors").update({
          status: "failed",
          last_error_code: code,
          last_error_message: "Falha ao ativar monitoramento no provedor.",
        }).eq("id", confirmed.monitor_id).eq("tenant_id", tenantId);
      }
    }

    results.push({
      candidateId: candidate.id,
      processId: confirmed.process_id,
      processNumber: confirmed.process_number,
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
