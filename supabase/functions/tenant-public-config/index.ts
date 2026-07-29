import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  hostnameFromRequest,
  isAllowedTenantHostname,
} from "../_shared/tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      Vary: "Origin",
    },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(request.method)) {
    return json({ error: "method_not_allowed" }, 405);
  }

  const hostname = await hostnameFromRequest(request);
  if (!hostname || !isAllowedTenantHostname(hostname)) {
    return json(
      {
        hostname,
        mode: "invalid",
        available: false,
        slug: null,
        branding: null,
      },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "server_configuration_error" }, 500);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc(
    "resolve_tenant_public_config",
    { p_hostname: hostname },
  );

  if (error) {
    console.error("tenant-public-config", error.code);
    return json({ error: "tenant_resolution_failed" }, 500);
  }

  return json(data);
});
