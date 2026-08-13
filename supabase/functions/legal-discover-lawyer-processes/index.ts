import {
  authenticateTenantRequest,
  corsHeaders,
  json,
  postgresErrorCode,
  resolveTenantLegalAccess,
  statusForError,
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
import { getEscavadorToken } from "../_shared/provider-secrets.ts";
import { formatCnj } from "../_shared/legal-normalization.ts";
import {
  assertProviderBudget,
  ProviderBudgetError,
  recordProviderUsage,
} from "../_shared/provider-quota.ts";
import { autoImportDiscoveries } from "../_shared/legal-auto-import.ts";

const OAB_TYPES = new Set([
  "ADVOGADO",
  "SUPLEMENTAR",
  "ESTAGIARIO",
  "CONSULTOR_ESTRANGEIRO",
]);
const CNJ_PATTERN = /^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$/;

interface DiscoveryRequest {
  action?: "register" | "update" | "disable";
  tenantId?: string;
  registrationId?: string;
  professionalId?: string;
  oabNumber?: string;
  oabState?: string;
  oabType?: string;
  deferDiscovery?: boolean;
}

async function manageRegistration(
  auth: Awaited<ReturnType<typeof authenticateTenantRequest>>,
  body: DiscoveryRequest,
): Promise<Response> {
  if (auth instanceof Response) return auth;
  const tenantId = body.tenantId?.trim();
  const registrationId = body.registrationId?.trim();
  const action = body.action;
  if (!tenantId || !registrationId || !action || action === "register") {
    return json({ error: "invalid_payload" }, 400);
  }

  let access;
  try {
    access = await resolveTenantLegalAccess(auth.admin, auth.user.id, tenantId);
  } catch {
    return json({ error: "operation_failed" }, 500);
  }
  if (!access || !access.canMutate) {
    return json({ error: "permission_denied" }, 403);
  }

  const { data: registration, error: registrationError } = await auth.admin
    .from("lawyer_registrations")
    .select("id, professional_id")
    .eq("tenant_id", tenantId)
    .eq("id", registrationId)
    .maybeSingle();
  if (registrationError) return json({ error: "operation_failed" }, 500);
  if (!registration) return json({ error: "registration_not_found" }, 404);

  const { data: currentProfessional, error: currentProfessionalError } =
    await auth.admin.from("equipe").select("id, user_id, ativo")
      .eq("tenant_id", tenantId)
      .eq("id", registration.professional_id)
      .maybeSingle();
  if (currentProfessionalError) return json({ error: "operation_failed" }, 500);
  if (!currentProfessional) return json({ error: "professional_not_found" }, 404);
  if (!access.canManageAll && currentProfessional.user_id !== auth.user.id) {
    return json({ error: "permission_denied" }, 403);
  }

  let professionalId = registration.professional_id;
  let oabNumber: string | null = null;
  let oabState: string | null = null;
  if (action === "update") {
    professionalId = body.professionalId?.trim() || registration.professional_id;
    oabNumber = body.oabNumber?.replace(/\D/g, "") ?? "";
    oabState = body.oabState?.trim().toUpperCase() ?? "";
    if (!oabNumber || !oabState.match(/^[A-Z]{2}$/)) {
      return json({ error: "invalid_payload" }, 400);
    }

    const { data: targetProfessional, error: targetProfessionalError } =
      await auth.admin.from("equipe").select("id, user_id, ativo")
        .eq("tenant_id", tenantId)
        .eq("id", professionalId)
        .maybeSingle();
    if (targetProfessionalError) return json({ error: "operation_failed" }, 500);
    if (!targetProfessional?.ativo) {
      return json({ error: "professional_not_found" }, 404);
    }
    if (!access.canManageAll && targetProfessional.id !== currentProfessional.id) {
      return json({ error: "permission_denied" }, 403);
    }
  }

  const { data, error } = await auth.admin.rpc(
    "manage_lawyer_registration_server",
    {
      p_tenant_id: tenantId,
      p_registration_id: registrationId,
      p_action: action,
      p_actor_user_id: auth.user.id,
      p_professional_id: action === "update" ? professionalId : null,
      p_oab_number: oabNumber,
      p_oab_state: oabState,
      p_support_session_id: access.supportSessionId,
    },
  );
  if (error) {
    const code = postgresErrorCode(error);
    return json({ error: code }, statusForError(code));
  }
  return json(data);
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

/** Descoberta oficial preparada para a importação automática idempotente. */
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

async function persistAndImport(
  admin: Parameters<typeof autoImportDiscoveries>[0],
  input: {
    tenantId: string;
    registrationId: string;
    provider: "datajud" | "escavador";
    rows: Array<Record<string, unknown> & { numero_cnj: string }>;
  },
) {
  if (!input.rows.length) {
    return { imported: 0, alreadyImported: 0, failed: 0, processes: [] };
  }

  // Não atualiza duplicatas: uma nova descoberta jamais pode devolver um
  // processo já confirmado ao estado de candidato.
  const { error: discoveryError } = await admin
    .from("process_discoveries")
    .upsert(input.rows, {
      onConflict: "tenant_id,lawyer_registration_id,numero_cnj,provider",
      ignoreDuplicates: true,
    });
  if (discoveryError) throw discoveryError;

  const { data: pending, error: pendingError } = await admin
    .from("process_discoveries")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("lawyer_registration_id", input.registrationId)
    .eq("provider", input.provider)
    .eq("state", "candidate")
    .in("numero_cnj", input.rows.map((row) => row.numero_cnj));
  if (pendingError) throw pendingError;

  return autoImportDiscoveries(admin, {
    tenantId: input.tenantId,
    candidateIds: (pending ?? []).map((row) => row.id),
  });
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
  if (body.action === "update" || body.action === "disable") {
    return manageRegistration(auth, body);
  }
  const input = normalizeRequest(body);
  if (!input) return json({ error: "invalid_payload" }, 400);

  let access;
  try {
    access = await resolveTenantLegalAccess(
      auth.admin,
      auth.user.id,
      input.tenantId,
    );
  } catch {
    return json({ error: "operation_failed" }, 500);
  }
  if (!access || !access.canMutate) {
    return json({ error: "permission_denied" }, 403);
  }

  const { data: professional, error: professionalError } = await auth.admin
    .from("equipe")
    .select("id, user_id, ativo")
    .eq("id", input.professionalId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (professionalError) return json({ error: "operation_failed" }, 500);
  if (!professional || !professional.ativo) {
    return json({ error: "professional_not_found" }, 404);
  }
  if (!access.canManageAll && professional.user_id !== auth.user.id) {
    return json({ error: "permission_denied" }, 403);
  }

  const { data: existingRegistration, error: existingError } = await auth.admin
    .from("lawyer_registrations")
    .select("id, professional_id, status")
    .eq("tenant_id", input.tenantId)
    .eq("oab_number", input.oabNumber)
    .eq("oab_state", input.oabState)
    .eq("oab_type", input.oabType)
    .maybeSingle();
  if (existingError) return json({ error: "operation_failed" }, 500);
  if (
    existingRegistration &&
    existingRegistration.professional_id !== input.professionalId &&
    !access.canManageAll
  ) {
    return json({ error: "registration_owned_by_other_professional" }, 409);
  }

  const { data: registration, error: registrationError } = await auth.admin
    .from("lawyer_registrations")
    .upsert({
      tenant_id: input.tenantId,
      professional_id: input.professionalId,
      oab_number: input.oabNumber,
      oab_state: input.oabState,
      oab_type: input.oabType,
      created_by: auth.user.id,
      status: existingRegistration &&
          ["disabled", "invalid"].includes(existingRegistration.status)
        ? "pending"
        : existingRegistration?.status ?? "pending",
    }, {
      onConflict: "tenant_id,oab_state,oab_number,oab_type",
    })
    .select("id")
    .single();
  if (registrationError || !registration) {
    return json({ error: "operation_failed" }, 500);
  }

  // O perfil profissional e a inscrição precisam ficar consistentes mesmo
  // quando a consulta externa demora ou falha depois desta etapa.
  await auth.admin.from("equipe").update({
    oab: `${input.oabNumber}/${input.oabState}`,
  }).eq("id", input.professionalId).eq("tenant_id", input.tenantId);

  if (body.deferDiscovery === true) {
    // O upsert acima dispara a criação das fontes DJEN/Escavador. O
    // reconciliador agendado fará a busca pesada sem prender o celular por
    // vários minutos. A inscrição já está persistida neste ponto.
    await auth.admin.from("tenant_audit_events").insert({
      tenant_id: input.tenantId,
      actor_user_id: auth.user.id,
      action: "legal.oab_registered",
      target_type: "lawyer_registration",
      target_id: registration.id,
      metadata: {
        discovery: "scheduled",
        oab_state: input.oabState,
        support_session_id: access.supportSessionId,
      },
    });
    return json({
      registrationId: registration.id,
      registrationSaved: true,
      discoveryPending: true,
      totalCandidates: 0,
    });
  }

  const token = await getEscavadorToken(auth.admin);
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

      const imported = await persistAndImport(auth.admin, {
        tenantId: input.tenantId,
        registrationId: registration.id,
        provider: "datajud",
        rows,
      });

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
        importedProcesses: imported.imported,
        providerUsed: "datajud",
        pendingProvider: "escavador",
      });
    } catch (error) {
      // A OAB já foi salva; falhar a busca não pode desfazer o cadastro nem
      // ser apresentado como erro total. A causa volta para a tela.
      const code = error instanceof DataJudApiError
        ? error.code
        : "datajud_request_failed";
      console.error("legal-discovery: datajud discovery failed", code);

      return json({
        registrationId: registration.id,
        registrationSaved: true,
        totalCandidates: 0,
        providerUsed: "datajud",
        pendingProvider: "escavador",
        discoveryError: code,
      });
    }
  }

  try {
    // A cota é verificada antes de sair a requisição: estourado o limite,
    // o provedor não chega a ser chamado e nada é cobrado.
    await assertProviderBudget(auth.admin, {
      tenantId: input.tenantId,
      provider: "escavador",
      service: "oab_processes",
    });

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

    const imported = await persistAndImport(auth.admin, {
      tenantId: input.tenantId,
      registrationId: registration.id,
      provider: "escavador",
      rows,
    });

    const now = new Date().toISOString();
    await Promise.all([
      auth.admin.from("lawyer_registrations").update({
        status: result.lawyer ? "verified" : "pending",
        verified_name: result.lawyer?.nome ?? null,
        verified_at: result.lawyer ? now : null,
        last_discovery_at: now,
      }).eq("id", registration.id).eq("tenant_id", input.tenantId),
      recordProviderUsage(auth.admin, {
        tenantId: input.tenantId,
        provider: "escavador",
        operation: "oab_discovery",
        service: "oab_processes",
        itemCount: result.processes.length,
        externalReference: registration.id,
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
      importedProcesses: imported.imported,
      pages: result.pages,
    });
  } catch (error) {
    console.warn("legal-discovery: Escavador failed or unconfigured, running DataJud fallback...", error);
    try {
      const authorization = normalizeDataJudAuthorization(
        Deno.env.get("DATAJUD_API_KEY"),
      );
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

      const imported = await persistAndImport(auth.admin, {
        tenantId: input.tenantId,
        registrationId: registration.id,
        provider: "datajud",
        rows,
      });

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
          metadata: { candidates: rows.length, fallback: true },
        }),
      ]);

      return json({
        registrationId: registration.id,
        registrationSaved: true,
        totalCandidates: rows.length,
        importedProcesses: imported.imported,
        providerUsed: "datajud_fallback",
        escavadorError: error instanceof EscavadorApiError ? error.code : "escavador_unavailable",
      });
    } catch (fallbackError) {
      console.error("legal-discovery: DataJud fallback also failed", fallbackError);
      return json({
        registrationId: registration.id,
        registrationSaved: true,
        totalCandidates: 0,
        providerUsed: "none",
        discoveryError: error instanceof EscavadorApiError ? error.code : "discovery_failed",
      });
    }
  }
});
