import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";
import { isUuid } from "../_shared/tenant-invitations.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const BRAND_BUCKET = "marca-escritorio";
const COLOR_KEY = /^[a-z][a-z0-9_-]{0,63}$/i;
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([^)]{1,80}\)|[a-z]{1,32})$/i;
const UPLOAD_VARIANTS = new Set(["light", "dark", "icon"]);
const UPLOAD_EXTENSIONS = new Set(["png", "jpg", "webp", "svg"]);

interface BrandRequest {
  action?: "load" | "save" | "create_upload";
  tenantId?: string;
  settings?: Record<string, unknown>;
  variant?: string;
  extension?: string;
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized || null : undefined;
}

function normalizeColors(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value);
  if (entries.length > 32) return null;
  const result: Record<string, string> = {};
  for (const [key, color] of entries) {
    if (!COLOR_KEY.test(key) || typeof color !== "string" || !COLOR_VALUE.test(color)) {
      return null;
    }
    result[key] = color;
  }
  return result;
}

async function accessFor(
  admin: SupabaseClient,
  userId: string,
  tenantId: string,
) {
  const [{ data: membership, error: membershipError }, { data: platformAdmin, error: platformError }] =
    await Promise.all([
      admin.from("tenant_memberships").select("role").eq("tenant_id", tenantId)
        .eq("user_id", userId).eq("status", "active").maybeSingle(),
      admin.from("platform_admins").select("user_id").eq("user_id", userId)
        .eq("is_active", true).maybeSingle(),
    ]);

  if (membershipError || platformError) return { error: true } as const;
  if (membership && (membership.role === "owner" || membership.role === "admin")) {
    return {
      error: false,
      canRead: true,
      canManage: true,
    } as const;
  }
  if (!platformAdmin) {
    return { error: false, canRead: Boolean(membership), canManage: false } as const;
  }

  const { data: support, error: supportError } = await admin
    .from("platform_support_sessions")
    .select("id")
    .eq("platform_admin_user_id", userId)
    .eq("tenant_id", tenantId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (supportError) return { error: true } as const;
  return { error: false, canRead: true, canManage: Boolean(support) } as const;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: BrandRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  const action = body.action ?? "load";
  if (
    !isUuid(body.tenantId) ||
    (action !== "load" && action !== "save" && action !== "create_upload")
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  const access = await accessFor(auth.admin, auth.user.id, body.tenantId);
  if (access.error) return json({ error: "operation_failed" }, 500);
  if (!access.canRead) return json({ error: "permission_denied" }, 403);

  if (action === "load") {
    const { data, error } = await auth.admin.from("tenant_brand_settings")
      .select("public_name, short_name, logo_light_path, logo_dark_path, icon_path, color_tokens")
      .eq("tenant_id", body.tenantId)
      .maybeSingle();
    if (error) {
      console.error("tenant-brand-settings: load failed", error.code);
      return json({ error: "operation_failed" }, 500);
    }
    return json({ settings: data ?? null, canManage: access.canManage });
  }

  if (!access.canManage) return json({ error: "permission_denied" }, 403);

  if (action === "create_upload") {
    if (
      !UPLOAD_VARIANTS.has(body.variant ?? "") ||
      !UPLOAD_EXTENSIONS.has(body.extension ?? "")
    ) {
      return json({ error: "invalid_payload" }, 400);
    }
    const path =
      `${body.tenantId}/${body.variant}-${Date.now()}-${crypto.randomUUID()}.${body.extension}`;
    const { data, error } = await auth.admin.storage.from(BRAND_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) {
      console.error("tenant-brand-settings: signed upload failed", error?.message);
      return json({ error: "operation_failed" }, 500);
    }
    const { data: publicData } = auth.admin.storage.from(BRAND_BUCKET).getPublicUrl(path);
    return json({
      upload: {
        path,
        token: data.token,
        publicUrl: publicData.publicUrl,
      },
    });
  }

  if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
    return json({ error: "invalid_payload" }, 400);
  }

  const publicName = optionalText(body.settings.publicName, 160);
  const shortName = optionalText(body.settings.shortName, 80);
  const logoLightPath = optionalText(body.settings.logoLightPath, 2_000);
  const logoDarkPath = optionalText(body.settings.logoDarkPath, 2_000);
  const iconPath = optionalText(body.settings.iconPath, 2_000);
  const colorTokens = normalizeColors(body.settings.colorTokens);
  if (
    publicName === undefined || shortName === undefined || logoLightPath === undefined ||
    logoDarkPath === undefined || iconPath === undefined || colorTokens === null
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  const { error } = await auth.admin.from("tenant_brand_settings").upsert({
    tenant_id: body.tenantId,
    public_name: publicName,
    short_name: shortName,
    logo_light_path: logoLightPath,
    logo_dark_path: logoDarkPath,
    icon_path: iconPath,
    color_tokens: colorTokens,
  }, { onConflict: "tenant_id" });
  if (error) {
    console.error("tenant-brand-settings: save failed", error.code);
    return json({ error: "operation_failed" }, 500);
  }

  await auth.admin.from("tenant_audit_events").insert({
    tenant_id: body.tenantId,
    actor_user_id: auth.user.id,
    action: "brand.updated",
    target_type: "tenant_brand_settings",
    target_id: body.tenantId,
    metadata: { public_name: publicName, short_name: shortName },
  });
  return json({ saved: true });
});
