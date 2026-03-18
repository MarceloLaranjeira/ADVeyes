import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get token from header or body
    let token = req.headers.get("x-portal-token");
    let action = "dashboard";

    if (req.method === "POST") {
      const body = await req.json();
      token = token || body.token;
      action = body.action || "dashboard";
    }

    if (!token) {
      return new Response(JSON.stringify({ error: "Token não fornecido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token against database
    const { data: access, error: accessError } = await supabase
      .from("portal_acessos")
      .select("id, cliente_id, ativo")
      .eq("token", token.trim())
      .eq("ativo", true)
      .maybeSingle();

    if (accessError || !access) {
      return new Response(JSON.stringify({ error: "Token inválido ou desativado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clienteId = access.cliente_id;

    // Update last access
    await supabase.from("portal_acessos")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("id", access.id);

    if (action === "validate") {
      return new Response(JSON.stringify({ valid: true, cliente_id: clienteId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all portal data for the client
    const [cliRes, procRes] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", clienteId).single(),
      supabase.from("processos").select("*").eq("cliente_id", clienteId).order("updated_at", { ascending: false }),
    ]);

    const procs = procRes.data || [];
    let audiencias: any[] = [];
    let documentos: any[] = [];

    if (procs.length > 0) {
      const procIds = procs.map((p: any) => p.id);
      const [audRes, docRes] = await Promise.all([
        supabase.from("audiencias").select("*").in("processo_id", procIds).order("data_hora", { ascending: false }).limit(10),
        supabase.from("documentos").select("*").in("processo_id", procIds).order("created_at", { ascending: false }).limit(20),
      ]);
      audiencias = audRes.data || [];
      documentos = docRes.data || [];
    }

    return new Response(JSON.stringify({
      cliente: cliRes.data,
      processos: procs,
      audiencias,
      documentos,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("portal-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
