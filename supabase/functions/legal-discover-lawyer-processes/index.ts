import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";
import {
  discoverLawyerProcesses,
  EscavadorApiError,
  type EscavadorProcessItem,
} from "../_shared/escavador-client.ts";
import { normalizeDataJudAuthorization } from "../_shared/datajud-auth.ts";
import {
  DataJudApiError,
  type DiscoveredProcess,
  discoverProcessesByOab,
} from "../_shared/datajud-client.ts";
import { formatCnj } from "../_shared/legal-normalization.ts";

const OAB_TYPES = new Set([
  "ADVOGADO",
  "SUPLEMENTAR",
  "ESTAGIARIO",
  "CONSULTOR_ESTRANGEIRO",
]);
const CNJ_PATTERN = /^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$/;

interface DiscoveryRequest {
  tenantId?: string;
  professionalId?: string;
  oabNumber?: string;
  oabState?: string;
  oabType?: string;
}

function normalizeRequest(body: DiscoveryRequest) {
  const tenantId = body.tenantId?.trim();
  const professionalId = body.professionalId?.trim();
  const oabNumber = body.oabNumber?.replace(/\D/g, "");
  const oabState = body.oabState?.trim().toUpperCase();
  const oabType = (body.oabType ?? "ADVOGADO").trim().toUpperCase();

  if (
    !tenantId || !professionalId || !oabNumber ||
    !oabState?.match(/^[A-Z]{2}$/) || !OAB_TYPES.has(oabType)
  ) {
    return null;
  }
  return { tenantId, professionalId, oabNumber, oabState, oabType };
}

function discoveryRow(
  tenantId: string,
  registrationId: string,
  item: EscavadorProcessItem,
) {
  if (!CNJ_PATTERN.test(item.numero_cnj)) return null;
  return {
    tenant_id: tenantId,
    lawyer_registration_id: registrationId,
    numero_cnj: item.numero_cnj,
    provider: "escavador",
    state: "candidate",
    title_active_party: item.titulo_polo_ativo ?? null,
    title_passive_party: item.titulo_polo_passivo ?? null,
    tribunal: item.unidade_origem?.tribunal_sigla ?? null,
    court_unit: item.unidade_origem?.nome ?? null,
    process_status: item.fontes_tribunais_estao_arquivadas
      ? "INATIVO"
      : "ATIVO",
    last_movement_at: item.data_ultima_movimentacao ?? null,
    provider_fetched_at: new Date().toISOString(),
    provider_payload: item,
  };
}

/**
 * Candidato descoberto na base pública do DataJud. Continua sendo candidato:
 * o vínculo com o escritório exige confirmação humana.
 */
function dataJudDiscoveryRow(
  tenantId: string,
  registrationId: string,
  item: DiscoveredProcess,
) {
  const numeroCnj = formatCnj(item.numeroProcesso);
  if (!CNJ_PATTERN.test(numeroCnj)) return null;
  return {
    tenant_id: tenantId,
    lawyer_registration_id: registrationId,
    numero_cnj: numeroCnj,
    provider: "datajud",
    state: "candidate",
    title_active_party: item.poloAtivo,
    title_passive_party: item.poloPassivo,
    tribunal: item.tribunal,
    court_unit: item.orgaoJulgador,
    process_status: null,
    last_movement_at: item.ultimaAtualizacao,
    provider_fetched_at: new Date().toISOString(),
    provider_payload: item as unknown as Record<string, unknown>,
  };
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

  let body: DiscoveryRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  const input = normalizeRequest(body);
  if (!input) return json({ error: "invalid_payload" }, 400);

  const { data: membership, error: membershipError } = await auth.admin
    .from("tenant_memberships")
    .select("id, role")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "operation_failed" }, 500);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return json({ error: "permission_denied" }, 403);
  }

  const { data: professional, error: professionalError } = await auth.admin
    .from("equipe")
    .select("id")
    .eq("id", input.professionalId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (professionalError) return json({ error: "operation_failed" }, 500);
  if (!professional) return json({ error: "professional_not_found" }, 404);

  const { data: registration, error: registrationError } = await auth.admin
    .from("lawyer_registrations")
    .upsert({
      tenant_id: input.tenantId,
      professional_id: input.professionalId,
      oab_number: input.oabNumber,
      oab_state: input.oabState,
      oab_type: input.oabType,
      created_by: auth.user.id,
    }, {
      onConflict: "tenant_id,oab_state,oab_number,oab_type",
    })
    .select("id")
    .single();
  if (registrationError || !registration) {
    return json({ error: "operation_failed" }, 500);
  }

  const token = Deno.env.get("ESCAVADOR_API_TOKEN");
  if (!token) {
    // Sem o Escavador ainda é possível descobrir processos na base pública do
    // DataJud. Publicações e intimações continuam dependendo do provedor.
    let authorization: string;
    try {
      authorization = normalizeDataJudAuthorization(
        Deno.env.get("DATAJUD_API_KEY"),
      );
    } catch {
      return json({
        error: "integration_not_configured",
        registrationId: registration.id,
        registrationSaved: true,
      }, 503);
    }

    try {
      const discovered = await discoverProcessesByOab({
        authorization,
        oabNumber: input.oabNumber,
        oabState: input.oabState,
      });
      const rows = discovered
        .map((item) =>
          dataJudDiscoveryRow(input.tenantId, registration.id, item)
        )
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (rows.length > 0) {
        const { error: discoveryError } = await auth.admin
          .from("process_discoveries")
          .upsert(rows, {
            onConflict: "tenant_id,lawyer_registration_id,numero_cnj,provider",
            ignoreDuplicates: false,
          });
        if (discoveryError) {
          console.error("legal-discovery: datajud candidate upsert failed");
          return json({ error: "operation_failed" }, 500);
        }
      }

      const discoveredAt = new Date().toISOString();
      await Promise.all([
        auth.admin.from("lawyer_registrations").update({
          last_discovery_at: discoveredAt,
        }).eq("id", registration.id).eq("tenant_id", input.tenantId),
        auth.admin.from("legal_usage_events").insert({
          tenant_id: input.tenantId,
          provider: "datajud",
          operation: "oab_discovery",
          quantity: 1,
          external_reference: registration.id,
          metadata: { candidates: rows.length },
        }),
        auth.admin.from("tenant_audit_events").insert({
          tenant_id: input.tenantId,
          actor_user_id: auth.user.id,
          action: "legal.oab_discovered",
          target_type: "lawyer_registration",
          target_id: registration.id,
          metadata: { candidates: rows.length, provider: "datajud" },
        }),
      ]);

      return json({
        registrationId: registration.id,
        registrationSaved: true,
        totalCandidates: rows.length,
        providerUsed: "datajud",
        pendingProvider: "escavador",
      });
    } catch (error) {
      if (error instanceof DataJudApiError) {
        return json({
          error: error.code,
          registrationId: registration.id,
          registrationSaved: true,
        }, error.status === 400 ? 422 : 502);
      }
      console.error("legal-discovery: datajud discovery failed");
      return json({ error: "datajud_request_failed" }, 502);
    }
  }

  try {
    const result = await discoverLawyerProcesses({
      token,
      oabState: input.oabState,
      oabNumber: input.oabNumber,
      oabType: input.oabType,
    });
    const rows = result.processes
      .map((item) => discoveryRow(
        input.tenantId,
        registration.id,
        item,
      ))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length > 0) {
      const { error: discoveryError } = await auth.admin
        .from("process_discoveries")
        .upsert(rows, {
          onConflict:
            "tenant_id,lawyer_registration_id,numero_cnj,provider",
          ignoreDuplicates: false,
        });
      if (discoveryError) {
        console.error("legal-discovery: candidate upsert failed");
        return json({ error: "operation_failed" }, 500);
      }
    }

    const now = new Date().toISOString();
    await Promise.all([
      auth.admin.from("lawyer_registrations").update({
        status: result.lawyer ? "verified" : "pending",
        verified_name: result.lawyer?.nome ?? null,
        verified_at: result.lawyer ? now : null,
        last_discovery_at: now,
      }).eq("id", registration.id).eq("tenant_id", input.tenantId),
      auth.admin.from("legal_usage_events").insert({
        tenant_id: input.tenantId,
        provider: "escavador",
        operation: "oab_discovery",
        quantity: 1,
        external_reference: registration.id,
        metadata: { pages: result.pages, candidates: rows.length },
      }),
      auth.admin.from("tenant_audit_events").insert({
        tenant_id: input.tenantId,
        actor_user_id: auth.user.id,
        action: "legal.oab_discovered",
        target_type: "lawyer_registration",
        target_id: registration.id,
        metadata: { candidates: rows.length, pages: result.pages },
      }),
    ]);

    return json({
      registrationId: registration.id,
      verifiedName: result.lawyer?.nome ?? null,
      totalCandidates: rows.length,
      pages: result.pages,
    });
  } catch (error) {
    if (error instanceof EscavadorApiError) {
      return json({ error: error.code }, error.status);
    }
    console.error("legal-discovery: unexpected provider failure");
    return json({ error: "escavador_request_failed" }, 502);
  }
});
