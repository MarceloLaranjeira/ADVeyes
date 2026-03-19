// Edge Function — Proxy seguro para a API Asaas
// A chave ASAAS_API_KEY fica no servidor (Supabase Secrets), nunca exposta no frontend.
// Configure em: Supabase Dashboard → Edge Functions → Secrets → ASAAS_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const BASE_URL = "https://api.asaas.com/v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const asaasRes = await fetch(`${BASE_URL}/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await asaasRes.json();

    return new Response(JSON.stringify(data), {
      status: asaasRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
