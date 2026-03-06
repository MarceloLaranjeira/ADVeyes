import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All DataJud CNJ public API endpoints
const DATAJUD_ENDPOINTS: Record<string, string> = {
  // Justiça Estadual
  tjac: "https://api-publica.datajud.cnj.jus.br/api_publica_tjac/_search",
  tjal: "https://api-publica.datajud.cnj.jus.br/api_publica_tjal/_search",
  tjam: "https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search",
  tjap: "https://api-publica.datajud.cnj.jus.br/api_publica_tjap/_search",
  tjba: "https://api-publica.datajud.cnj.jus.br/api_publica_tjba/_search",
  tjce: "https://api-publica.datajud.cnj.jus.br/api_publica_tjce/_search",
  tjdft: "https://api-publica.datajud.cnj.jus.br/api_publica_tjdft/_search",
  tjes: "https://api-publica.datajud.cnj.jus.br/api_publica_tjes/_search",
  tjgo: "https://api-publica.datajud.cnj.jus.br/api_publica_tjgo/_search",
  tjma: "https://api-publica.datajud.cnj.jus.br/api_publica_tjma/_search",
  tjmg: "https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search",
  tjms: "https://api-publica.datajud.cnj.jus.br/api_publica_tjms/_search",
  tjmt: "https://api-publica.datajud.cnj.jus.br/api_publica_tjmt/_search",
  tjpa: "https://api-publica.datajud.cnj.jus.br/api_publica_tjpa/_search",
  tjpb: "https://api-publica.datajud.cnj.jus.br/api_publica_tjpb/_search",
  tjpe: "https://api-publica.datajud.cnj.jus.br/api_publica_tjpe/_search",
  tjpi: "https://api-publica.datajud.cnj.jus.br/api_publica_tjpi/_search",
  tjpr: "https://api-publica.datajud.cnj.jus.br/api_publica_tjpr/_search",
  tjrj: "https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search",
  tjrn: "https://api-publica.datajud.cnj.jus.br/api_publica_tjrn/_search",
  tjro: "https://api-publica.datajud.cnj.jus.br/api_publica_tjro/_search",
  tjrr: "https://api-publica.datajud.cnj.jus.br/api_publica_tjrr/_search",
  tjrs: "https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search",
  tjsc: "https://api-publica.datajud.cnj.jus.br/api_publica_tjsc/_search",
  tjse: "https://api-publica.datajud.cnj.jus.br/api_publica_tjse/_search",
  tjsp: "https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search",
  tjto: "https://api-publica.datajud.cnj.jus.br/api_publica_tjto/_search",
  // Tribunais Superiores
  stj: "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
  stf: "https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
  tst: "https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search",
  // TRFs
  trf1: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
  trf2: "https://api-publica.datajud.cnj.jus.br/api_publica_trf2/_search",
  trf3: "https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search",
  trf4: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  trf5: "https://api-publica.datajud.cnj.jus.br/api_publica_trf5/_search",
  trf6: "https://api-publica.datajud.cnj.jus.br/api_publica_trf6/_search",
  // TRTs
  trt1: "https://api-publica.datajud.cnj.jus.br/api_publica_trt1/_search",
  trt2: "https://api-publica.datajud.cnj.jus.br/api_publica_trt2/_search",
  trt3: "https://api-publica.datajud.cnj.jus.br/api_publica_trt3/_search",
  trt4: "https://api-publica.datajud.cnj.jus.br/api_publica_trt4/_search",
  trt5: "https://api-publica.datajud.cnj.jus.br/api_publica_trt5/_search",
  trt6: "https://api-publica.datajud.cnj.jus.br/api_publica_trt6/_search",
  trt7: "https://api-publica.datajud.cnj.jus.br/api_publica_trt7/_search",
  trt8: "https://api-publica.datajud.cnj.jus.br/api_publica_trt8/_search",
  trt9: "https://api-publica.datajud.cnj.jus.br/api_publica_trt9/_search",
  trt10: "https://api-publica.datajud.cnj.jus.br/api_publica_trt10/_search",
  trt11: "https://api-publica.datajud.cnj.jus.br/api_publica_trt11/_search",
  trt12: "https://api-publica.datajud.cnj.jus.br/api_publica_trt12/_search",
  trt13: "https://api-publica.datajud.cnj.jus.br/api_publica_trt13/_search",
  trt14: "https://api-publica.datajud.cnj.jus.br/api_publica_trt14/_search",
  trt15: "https://api-publica.datajud.cnj.jus.br/api_publica_trt15/_search",
  trt16: "https://api-publica.datajud.cnj.jus.br/api_publica_trt16/_search",
  trt17: "https://api-publica.datajud.cnj.jus.br/api_publica_trt17/_search",
  trt18: "https://api-publica.datajud.cnj.jus.br/api_publica_trt18/_search",
  trt19: "https://api-publica.datajud.cnj.jus.br/api_publica_trt19/_search",
  trt20: "https://api-publica.datajud.cnj.jus.br/api_publica_trt20/_search",
  trt21: "https://api-publica.datajud.cnj.jus.br/api_publica_trt21/_search",
  trt22: "https://api-publica.datajud.cnj.jus.br/api_publica_trt22/_search",
  trt23: "https://api-publica.datajud.cnj.jus.br/api_publica_trt23/_search",
  trt24: "https://api-publica.datajud.cnj.jus.br/api_publica_trt24/_search",
  // Justiça Militar
  stm: "https://api-publica.datajud.cnj.jus.br/api_publica_stm/_search",
  // Justiça Eleitoral
  tse: "https://api-publica.datajud.cnj.jus.br/api_publica_tse/_search",
  // SEEU (Sistema Eletrônico de Execução Unificado) - via DataJud
  seeu: "https://api-publica.datajud.cnj.jus.br/api_publica_seeu/_search",
  // Projudi - via DataJud
  projudi: "https://api-publica.datajud.cnj.jus.br/api_publica_projudi/_search",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { numero, tribunal, sistema } = await req.json();

    if (!numero || !numero.trim()) {
      return new Response(JSON.stringify({ error: "Número do processo é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Support "sistema" param for SEEU/Projudi alongside tribunal
    const key = (sistema || tribunal || "tjam").toLowerCase();
    const endpoint = DATAJUD_ENDPOINTS[key];

    if (!endpoint) {
      return new Response(JSON.stringify({ error: `Tribunal/sistema "${key}" não encontrado. Tribunais disponíveis: ${Object.keys(DATAJUD_ENDPOINTS).join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        sistema: key,
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
