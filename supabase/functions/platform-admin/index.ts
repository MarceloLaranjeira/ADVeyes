import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";
import {
  getEscavadorStatus,
  providerSecretNames,
} from "../_shared/provider-secrets.ts";

interface PlatformAdminRequest {
  action?:
    | "session"
    | "overview"
    | "integration_status"
    | "set_escavador_token"
    | "support_status"
    | "start_support"
    | "end_support";
  tenantId?: string;
  reason?: string;
  token?: string;
}

interface TenantRow {
  id: string;
  display_name: string;
  legal_name: string;
  slug: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
}

interface LegalOverviewCountRow {
  tenant_id: string;
  active_members: number;
  candidate_processes: number;
  monitored_processes: number;
  integration_failures: number;
  last_legal_success_at: string | null;
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

  let body: PlatformAdminRequest = {};
  try {
    body = await request.json();
  } catch {
    // Empty bodies are treated as a session check.
  }
  const action = body.action ?? "session";

  const { data: administrator, error: administratorError } = await auth.admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (administratorError) {
    console.error("platform-admin: administrator lookup failed");
    return json({ error: "operation_failed" }, 500);
  }
  if (!administrator) {
    if (action === "session") {
      return json({ isPlatformAdmin: false });
    }
    return json({ error: "permission_denied" }, 403);
  }

  if (action === "session") {
    return json({ isPlatformAdmin: true });
  }

  if (action === "integration_status") {
    const escavador = await getEscavadorStatus(auth.admin);
    return json({
      providers: {
        djen: { configured: true, mode: "official" },
        datajud: {
          configured: Boolean(Deno.env.get("DATAJUD_API_KEY")?.trim()),
          mode: "official",
        },
        escavador: {
          configured: escavador.configured,
          updatedAt: escavador.updatedAt,
          mode: "complementary",
        },
      },
    });
  }

  if (action === "set_escavador_token") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 16 || token.length > 4096) {
      return json({ error: "invalid_secret_value" }, 400);
    }

    let validation: Response;
    try {
      validation = await fetch("https://api.escavador.com/api/v2/callbacks", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      return json({ error: "escavador_validation_unavailable" }, 503);
    }

    if (validation.status === 401 || validation.status === 403) {
      return json({ error: "escavador_unauthorized" }, 400);
    }
    if (!validation.ok) {
      return json({ error: "escavador_validation_unavailable" }, 503);
    }

    const { data: saved, error: saveError } = await auth.admin.rpc(
      "platform_upsert_integration_secret",
      {
        p_name: providerSecretNames.escavador,
        p_secret: token,
        p_description: "Token global da API Escavador do ADVeyes",
      },
    );
    if (saveError) {
      console.error("platform-admin: failed to persist integration secret");
      return json({ error: "operation_failed" }, 500);
    }

    await auth.admin.from("platform_audit_events").insert({
      actor_user_id: auth.user.id,
      action: "platform.integration_secret_rotated",
      target_type: "integration_provider",
      target_id: "escavador",
      metadata: { validated: true },
    });

    const row = Array.isArray(saved) ? saved[0] : saved;
    return json({
      configured: true,
      updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
    });
  }

  if (["support_status", "start_support", "end_support"].includes(action)) {
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      return json({ error: "invalid_payload" }, 400);
    }

    if (action === "start_support") {
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 10 || reason.length > 500) {
        return json({ error: "invalid_support_reason" }, 400);
      }

      await auth.admin.from("platform_support_sessions").update({
        ended_at: new Date().toISOString(),
      }).eq("platform_admin_user_id", auth.user.id).eq("tenant_id", tenantId)
        .is("ended_at", null);

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data: support, error: supportError } = await auth.admin
        .from("platform_support_sessions")
        .insert({
          platform_admin_user_id: auth.user.id,
          tenant_id: tenantId,
          reason,
          expires_at: expiresAt,
        })
        .select("id, reason, started_at, expires_at")
        .single();

      if (supportError) return json({ error: "operation_failed" }, 500);
      await auth.admin.from("tenant_audit_events").insert({
        tenant_id: tenantId,
        actor_user_id: auth.user.id,
        action: "platform_support.started",
        target_type: "platform_support_session",
        target_id: support.id,
        metadata: { reason, expires_at: expiresAt },
      });
      return json({ active: true, session: support });
    }

    const { data: active } = await auth.admin
      .from("platform_support_sessions")
      .select("id, reason, started_at, expires_at")
      .eq("platform_admin_user_id", auth.user.id)
      .eq("tenant_id", tenantId)
      .is("ended_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (action === "support_status") {
      return json({ active: Boolean(active), session: active ?? null });
    }
    if (active) {
      const endedAt = new Date().toISOString();
      const { error: endError } = await auth.admin
        .from("platform_support_sessions")
        .update({ ended_at: endedAt })
        .eq("id", active.id);
      if (endError) return json({ error: "operation_failed" }, 500);
      await auth.admin.from("tenant_audit_events").insert({
        tenant_id: tenantId,
        actor_user_id: auth.user.id,
        action: "platform_support.ended",
        target_type: "platform_support_session",
        target_id: active.id,
        metadata: { ended_at: endedAt },
      });
    }
    return json({ active: false, session: null });
  }

  if (action !== "overview") {
    return json({ error: "invalid_action" }, 400);
  }

  const [tenantsResult, subscriptionsResult, legalCountsResult] = await Promise.all([
    auth.admin
      .from("tenants")
      .select(
        "id, display_name, legal_name, slug, status, trial_ends_at, created_at",
      )
      .order("created_at", { ascending: false }),
    auth.admin
      .from("tenant_subscriptions")
      .select(
        "tenant_id, status, next_due_date, trial_ends_at, billing_plans(code)",
      ),
    auth.admin.rpc("platform_legal_overview_counts", {
      p_actor_user_id: auth.user.id,
    }),
  ]);

  const coreError = [tenantsResult.error, legalCountsResult.error].find(Boolean);
  if (coreError) {
    console.error("platform-admin: overview core query failed");
    return json({ error: "operation_failed" }, 500);
  }

  [
    ["subscriptions", subscriptionsResult.error],
  ].forEach(([query, error]) => {
    if (error) {
      console.error(`platform-admin: optional ${query} query failed`);
    }
  });

  const legalCounts = new Map(
    ((legalCountsResult.data ?? []) as LegalOverviewCountRow[]).map((row) => [
      row.tenant_id,
      row,
    ]),
  );
  const subscriptions = new Map(
    (subscriptionsResult.error ? [] : subscriptionsResult.data ?? []).map(
      (subscription) => [
        subscription.tenant_id,
        subscription,
      ],
    ),
  );

  const tenants = (tenantsResult.data as TenantRow[] ?? []).map((tenant) => {
    const subscription = subscriptions.get(tenant.id);
    const counts = legalCounts.get(tenant.id);
    return {
      id: tenant.id,
      displayName: tenant.display_name,
      legalName: tenant.legal_name,
      slug: tenant.slug,
      status: tenant.status,
      trialEndsAt: tenant.trial_ends_at,
      createdAt: tenant.created_at,
      activeMembers: counts?.active_members ?? 0,
      candidateProcesses: counts?.candidate_processes ?? 0,
      monitoredProcesses: counts?.monitored_processes ?? 0,
      integrationFailures: counts?.integration_failures ?? 0,
      lastLegalSuccessAt: counts?.last_legal_success_at ?? null,
      subscription: subscription
        ? {
          planCode: Array.isArray(subscription.billing_plans)
            ? subscription.billing_plans[0]?.code ?? null
            : subscription.billing_plans?.code ?? null,
          status: subscription.status,
          nextDueDate: subscription.next_due_date,
          trialEndsAt: subscription.trial_ends_at,
        }
        : null,
    };
  });

  return json({
    totals: {
      tenants: tenants.length,
      activeTenants: tenants.filter((tenant) => tenant.status === "active")
        .length,
      activeMembers: tenants.reduce((sum, tenant) => sum + tenant.activeMembers, 0),
      monitoredProcesses: tenants.reduce((sum, tenant) => sum + tenant.monitoredProcesses, 0),
      integrationFailures: tenants.reduce((sum, tenant) => sum + tenant.integrationFailures, 0),
    },
    tenants,
  });
});
