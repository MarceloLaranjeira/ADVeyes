import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate endpoint URL from tribunal key
const getEndpoint = (key: string) =>
  `https://api-publica.datajud.cnj.jus.br/api_publica_${key}/_search`;

// Complete list of all DataJud CNJ endpoints (official)
const ALL_TRIBUNAL_KEYS = [
  // Tribunais Superiores
  "tst", "tse", "stj", "stm",
  // Justiça Federal (TRFs)
  "trf1", "trf2", "trf3", "trf4", "trf5", "trf6",
  // Justiça Estadual (TJs)
  "tjac", "tjal", "tjam", "tjap", "tjba", "tjce", "tjdft", "tjes", "tjgo",
  "tjma", "tjmg", "tjms", "tjmt", "tjpa", "tjpb", "tjpe", "tjpi", "tjpr",
  "tjrj", "tjrn", "tjro", "tjrr", "tjrs", "tjsc", "tjse", "tjsp", "tjto",
  // Justiça do Trabalho (TRTs)
  "trt1", "trt2", "trt3", "trt4", "trt5", "trt6", "trt7", "trt8", "trt9",
  "trt10", "trt11", "trt12", "trt13", "trt14", "trt15", "trt16", "trt17",
  "trt18", "trt19", "trt20", "trt21", "trt22", "trt23", "trt24",
  // Justiça Eleitoral (TREs) — note: use hyphens as per DataJud
  "tre-ac", "tre-al", "tre-am", "tre-ap", "tre-ba", "tre-ce", "tre-dft",
  "tre-es", "tre-go", "tre-ma", "tre-mg", "tre-ms", "tre-mt", "tre-pa",
  "tre-pb", "tre-pe", "tre-pi", "tre-pr", "tre-rj", "tre-rn", "tre-ro",
  "tre-rr", "tre-rs", "tre-sc", "tre-se", "tre-sp", "tre-to",
  // Justiça Militar Estadual (TJMs)
  "tjmmg", "tjmrs", "tjmsp",
];

const ALL_TJS = [
  "tjac","tjal","tjam","tjap","tjba","tjce","tjdft","tjes","tjgo","tjma",
  "tjmg","tjms","tjmt","tjpa","tjpb","tjpe","tjpi","tjpr","tjrj","tjrn",
  "tjro","tjrr","tjrs","tjsc","tjse","tjsp","tjto",
];

const SEEU_TRIBUNAIS = [
  ...ALL_TJS, "stj", "stf",
  "trf1", "trf2", "trf3", "trf4", "trf5", "trf6",
  "tjmmg", "tjmrs", "tjmsp",
];

const PROJUDI_TRIBUNAIS = [...ALL_TJS];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { numero, tribunal, filtros } = await req.json();

    if (!numero || !numero.trim()) {
      return new Response(JSON.stringify({ error: "Número do processo é obrigatório", processos: [], total: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let key = (tribunal || "tjam").toLowerCase();
    const cleanNum = numero.trim().replace(/[.\-\/]/g, "");

    // PROJUDI TJAM maps directly to tjam (single tribunal, no multi-search)
    if (key === "projudi-tjam") key = "tjam";

    const isMultiSearch = key === "seeu" || key === "projudi";
    const tribunaisToSearch = isMultiSearch
      ? (key === "seeu" ? SEEU_TRIBUNAIS : PROJUDI_TRIBUNAIS)
      : [key];

    // Validate single tribunal key
    if (!isMultiSearch && !ALL_TRIBUNAL_KEYS.includes(key)) {
      return new Response(JSON.stringify({ error: `Tribunal "${key}" não encontrado.`, processos: [], total: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Public DataJud/CNJ API key — used as fallback when secret is not configured
    const DATAJUD_PUBLIC_KEY = "cDZHYzlZa0JadVREZDJCendFbzV3cU1qM2owQUlTSmFRdnBEstF";
    const apiKey = Deno.env.get("DATAJUD_API_KEY") || DATAJUD_PUBLIC_KEY;

    // Build Elasticsearch query with optional filters
    // DataJud stores numeroProcesso as keyword — use multiple strategies for best coverage
    const formattedNum = numero.trim();
    const mustClauses: any[] = [
      {
        bool: {
          should: [
            // Exact match on clean number (no separators — most reliable for DataJud)
            { match: { numeroProcesso: cleanNum } },
            // Exact match on formatted CNJ number (with dots/dashes)
            { match_phrase: { numeroProcesso: formattedNum } },
            // Fallback: prefix search on clean number
            { prefix: { numeroProcesso: cleanNum.slice(0, 14) } },
          ],
          minimum_should_match: 1,
        },
      },
    ];

    // Advanced filters
    if (filtros?.classe) {
      mustClauses.push({ match_phrase: { "classe.nome": filtros.classe } });
    }
    if (filtros?.assunto) {
      mustClauses.push({ match: { "assuntos.nome": filtros.assunto } });
    }
    if (filtros?.orgaoJulgador) {
      mustClauses.push({ match: { "orgaoJulgador.nome": filtros.orgaoJulgador } });
    }
    if (filtros?.dataInicio || filtros?.dataFim) {
      const range: any = {};
      if (filtros.dataInicio) range.gte = filtros.dataInicio;
      if (filtros.dataFim) range.lte = filtros.dataFim;
      mustClauses.push({ range: { dataAjuizamento: range } });
    }

    const searchBody = JSON.stringify({
      query: { bool: { must: mustClauses } },
      size: 20,
      sort: [{ dataHoraUltimaAtualizacao: { order: "desc" } }],
    });

    const fetchTribunal = async (t: string) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout per tribunal
        const ep = getEndpoint(t);
        const resp = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `APIKey ${apiKey}` },
          body: searchBody,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          if (resp.status === 401) {
            const errorText = await resp.text();
            console.error(`DataJud auth error for ${t}:`, resp.status, errorText);
            return { tribunal: t, error: "auth", data: null };
          }
          return { tribunal: t, error: `${resp.status}`, data: null };
        }
        return { tribunal: t, error: null, data: await resp.json() };
      } catch (e) {
        // Timeout or network error — skip silently
        return { tribunal: t, error: "network", data: null };
      }
    };

    let allProcessos: any[] = [];
    let totalHits = 0;
    let authError = false;

    if (isMultiSearch) {
      // All tribunals in parallel (with individual timeouts)
      const results = await Promise.all(tribunaisToSearch.map(fetchTribunal));
      for (const r of results) {
        if (r.error === "auth") { authError = true; continue; }
        if (!r.data) continue;
        const hits = r.data.hits?.hits || [];
        totalHits += r.data.hits?.total?.value || 0;
        for (const hit of hits) {
          const s = hit._source;
          allProcessos.push(parseProcesso(s, r.tribunal, key));
        }
      }
    } else {
      const result = await fetchTribunal(key);
      if (result.error === "auth") {
        return new Response(JSON.stringify({
          error: "Erro de autenticação com o DataJud. Verifique se a chave de acesso está válida.",
          processos: [], total: 0,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (result.data) {
        totalHits = result.data.hits?.total?.value || 0;
        allProcessos = (result.data.hits?.hits || []).map((hit: any) => parseProcesso(hit._source, key, key));
      }
    }

    if (authError && allProcessos.length === 0) {
      return new Response(JSON.stringify({
        error: "Erro de autenticação com o DataJud. Verifique se a chave de acesso está válida.",
        processos: [], total: 0,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ processos: allProcessos, total: totalHits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("busca-processual error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido", processos: [], total: 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseProcesso(s: any, tribunalKey: string, sistema: string) {
  return {
    numero: s.numeroProcesso,
    classe: s.classe?.nome || s.classeProcessual || "",
    assunto: s.assuntos?.map((a: any) => a.nome).join(", ") || "",
    tribunal: s.tribunal || tribunalKey.toUpperCase(),
    sistema,
    grau: s.grau,
    orgaoJulgador: s.orgaoJulgador?.nome || "",
    dataAjuizamento: s.dataAjuizamento,
    ultimaAtualizacao: s.dataHoraUltimaAtualizacao,
    formato: s.formato?.nome || "",
    nivelSigilo: s.nivelSigilo,
    movimentos: (s.movimentos || [])
      .sort((a: any, b: any) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime())
      .slice(0, 20)
      .map((m: any) => ({
        nome: m.nome,
        data: m.dataHora,
        complementos: m.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join("; ") || "",
      })),
  };
}
