import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";

interface PlatformAdminRequest {
  action?: "session" | "overview";
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

function countByTenant(rows: Array<{ tenant_id: string }> | null) {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    counts.set(row.tenant_id, (counts.get(row.tenant_id) ?? 0) + 1);
  }
  return counts;
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
  if (action !== "overview") {
    return json({ error: "invalid_action" }, 400);
  }

  const [
    tenantsResult,
    membershipsResult,
    subscriptionsResult,
    discoveriesResult,
    monitorsResult,
    failedEventsResult,
  ] = await Promise.all([
    auth.admin
      .from("tenants")
      .select(
        "id, display_name, legal_name, slug, status, trial_ends_at, created_at",
      )
      .order("created_at", { ascending: false }),
    auth.admin
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("status", "active"),
    auth.admin
      .from("tenant_subscriptions")
      .select(
        "tenant_id, status, next_due_date, trial_ends_at, billing_plans(code)",
      ),
    auth.admin
      .from("process_discoveries")
      .select("tenant_id")
      .eq("state", "candidate"),
    auth.admin
      .from("legal_provider_monitors")
      .select("tenant_id")
      .in("status", ["queued", "pending", "found"]),
    auth.admin
      .from("legal_provider_events")
      .select("tenant_id")
      .in("status", ["failed", "quarantined"])
      .not("tenant_id", "is", null),
  ]);

  const firstError = [
    tenantsResult.error,
    membershipsResult.error,
    subscriptionsResult.error,
    discoveriesResult.error,
    monitorsResult.error,
    failedEventsResult.error,
  ].find(Boolean);
  if (firstError) {
    console.error("platform-admin: overview query failed");
    return json({ error: "operation_failed" }, 500);
  }

  const memberships = countByTenant(membershipsResult.data);
  const discoveries = countByTenant(discoveriesResult.data);
  const monitors = countByTenant(monitorsResult.data);
  const failedEvents = countByTenant(
    failedEventsResult.data as Array<{ tenant_id: string }> | null,
  );
  const subscriptions = new Map(
    (subscriptionsResult.data ?? []).map((subscription) => [
      subscription.tenant_id,
      subscription,
    ]),
  );

  const tenants = (tenantsResult.data as TenantRow[] ?? []).map((tenant) => {
    const subscription = subscriptions.get(tenant.id);
    return {
      id: tenant.id,
      displayName: tenant.display_name,
      legalName: tenant.legal_name,
      slug: tenant.slug,
      status: tenant.status,
      trialEndsAt: tenant.trial_ends_at,
      createdAt: tenant.created_at,
      activeMembers: memberships.get(tenant.id) ?? 0,
      candidateProcesses: discoveries.get(tenant.id) ?? 0,
      monitoredProcesses: monitors.get(tenant.id) ?? 0,
      integrationFailures: failedEvents.get(tenant.id) ?? 0,
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
      activeMembers: membershipsResult.data?.length ?? 0,
      monitoredProcesses: monitorsResult.data?.length ?? 0,
      integrationFailures: failedEventsResult.data?.length ?? 0,
    },
    tenants,
  });
});
