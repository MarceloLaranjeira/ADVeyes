import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { numero, tribunal } = await req.json();

    if (!numero || !numero.trim()) {
      return new Response(JSON.stringify({ error: "Número do processo é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DataJud CNJ public API
    const tribunalEndpoints: Record<string, string> = {
      tjam: "https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search",
      stj: "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
      stf: "https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
      tst: "https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search",
    };

    const endpoint = tribunalEndpoints[tribunal?.toLowerCase() || "tjam"] || DATAJUD_BASE;

    const body = {
      query: {
        match: {
          numeroProcesso: numero.replace(/[.\-\/]/g, ""),
        },
      },
      size: 10,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "APIKey cDZHYzlZa0JadVREZDR4cUY0c0VRQkF3SUlJa2RaS3I=",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DataJud error:", response.status, errorText);
      return new Response(JSON.stringify({ 
        error: `Erro ao consultar DataJud (${response.status})`,
        details: errorText 
      }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    const processos = (data.hits?.hits || []).map((hit: any) => {
      const s = hit._source;
      return {
        numero: s.numeroProcesso,
        classe: s.classe?.nome || s.classeProcessual,
        assunto: s.assuntos?.map((a: any) => a.nome).join(", ") || "",
        tribunal: s.tribunal,
        grau: s.grau,
        orgaoJulgador: s.orgaoJulgador?.nome || "",
        dataAjuizamento: s.dataAjuizamento,
        ultimaAtualizacao: s.dataHoraUltimaAtualizacao,
        movimentos: (s.movimentos || []).slice(0, 5).map((m: any) => ({
          nome: m.nome,
          data: m.dataHora,
          complementos: m.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join("; ") || "",
        })),
      };
    });

    return new Response(JSON.stringify({ processos, total: data.hits?.total?.value || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("busca-processual error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
