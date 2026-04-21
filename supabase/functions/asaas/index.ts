// Edge Function — Proxy seguro para a API Asaas
// A chave ASAAS_API_KEY fica no servidor (Supabase Secrets), nunca exposta no frontend.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const BASE_URL = "https://api.asaas.com/v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

// Whitelist of allowed Asaas API path prefixes
const ALLOWED_PATHS = [
  "customers",
  "subscriptions",
  "payments",
];

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATHS.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth: require a valid user JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Parse and validate request ---
    const { path, method = "GET", body } = await req.json() as {
      path: string;
      method?: string;
      body?: Record<string, unknown>;
    };

    if (!path) {
      return new Response(JSON.stringify({ error: "path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAllowedPath(path)) {
      return new Response(JSON.stringify({ error: "Path not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ASAAS_API_KEY) {
      console.error("ASAAS_API_KEY not configured");
      return new Response(JSON.stringify({ error: "ASAAS_API_KEY not configured on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[asaas] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 500) : "");

    const asaasRes = await fetch(`${BASE_URL}/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
        "User-Agent": "Adveyes/1.0",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await asaasRes.text();
    console.log(`[asaas] response ${asaasRes.status}:`, text.slice(0, 1000));

    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Always return 200 to the client with the Asaas payload, so the frontend can show the real error
    return new Response(JSON.stringify({ asaasStatus: asaasRes.status, data }), {
      status: asaasRes.ok ? 200 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[asaas] internal error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "Internal server error", details: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
