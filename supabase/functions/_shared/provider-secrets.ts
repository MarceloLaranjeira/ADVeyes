import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const ESCAVADOR_SECRET_NAME = "escavador_api_token";

/**
 * Keeps the current environment secret compatible while allowing the platform
 * administrator to rotate the credential through Supabase Vault.
 */
export async function getEscavadorToken(
  admin: SupabaseClient,
): Promise<string | null> {
  const environmentValue = Deno.env.get("ESCAVADOR_API_TOKEN")?.trim();
  if (environmentValue) return environmentValue;

  const { data, error } = await admin.rpc("platform_get_integration_secret", {
    p_name: ESCAVADOR_SECRET_NAME,
  });
  if (error) {
    console.error("provider-secrets: failed to read Escavador credential");
    return null;
  }

  return typeof data === "string" && data.trim() ? data.trim() : null;
}

export async function getEscavadorStatus(
  admin: SupabaseClient,
): Promise<{ configured: boolean; updatedAt: string | null }> {
  if (Deno.env.get("ESCAVADOR_API_TOKEN")?.trim()) {
    return { configured: true, updatedAt: null };
  }

  const { data, error } = await admin.rpc("platform_integration_secret_status", {
    p_name: ESCAVADOR_SECRET_NAME,
  });
  if (error) {
    console.error("provider-secrets: failed to read Escavador status");
    return { configured: false, updatedAt: null };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    configured: Boolean(row?.configured),
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
  };
}

export const providerSecretNames = {
  escavador: ESCAVADOR_SECRET_NAME,
} as const;
