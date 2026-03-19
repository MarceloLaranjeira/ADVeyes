import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// === JusBrasil API ===
// Docs: https://api.jusbrasil.com.br/docs/autenticacao/api_key.html
// Chave configurada em JUSBRASIL_API_KEY nas secrets da Edge Function
const JUSBRASIL_BASE = "https://api.jusbrasil.com.br";

async function queryJusBrasil(numero: string): Promise<{ processos?: any[]; error?: string }> {
  const apiKey = Deno.env.get("JUSBRASIL_API_KEY");
  if (!apiKey) return { error: "JUSBRASIL_API_KEY não configurada" };

  // Tenta o número como digitado e também formatado
  const formatted = normalizeCNJ(numero);
  const query = encodeURIComponent(formatted || numero.trim());

  try {
    const resp = await fetch(`${JUSBRASIL_BASE}/processos/v1/search?q=${query}&size=10`, {
      headers: {
        "Authorization": `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return { error: `JusBrasil API: ${resp.status} - ${errText.slice(0, 200)}` };
    }

    const data = await resp.json();
    // Normaliza resposta JusBrasil → formato interno
    const hits = data?.data || data?.processos || data?.hits?.hits || [];
    const processos = hits.map((p: any) => ({
      numero: p.numero || p.numeroProcesso || p.number || numero,
      classe: p.classe || p.classeProcessual || p.type || "Não informado",
      assunto: Array.isArray(p.assuntos) ? p.assuntos.map((a: any) => a.nome || a).join(", ") : (p.assunto || p.subject || ""),
      tribunal: p.tribunal || p.court || p.orgao || "",
      sistema: "jusbrasil",
      grau: p.grau || p.degree || "",
      orgaoJulgador: p.orgaoJulgador?.nome || p.orgao || p.court || "",
      dataAjuizamento: p.dataAjuizamento || p.dataDistribuicao || p.filed_at || null,
      ultimaAtualizacao: p.dataHoraUltimaAtualizacao || p.updated_at || null,
      partes: p.partes || p.parties || [],
      movimentos: (p.movimentos || p.moves || p.movements || []).map((m: any) => ({
        nome: m.nome || m.name || m.tipo || m.type || "",
        data: m.dataHora || m.data || m.date || "",
        complementos: m.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join("; ") || m.descricao || m.description || "",
      })),
      fonte: "JusBrasil",
    }));

    return { processos };
  } catch (err) {
    return { error: `JusBrasil fetch error: ${err}` };
  }
}

// === DataJud CNJ endpoints (APENAS os que realmente existem) ===
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
  stf: "https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
  stj: "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
  tst: "https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search",
  stm: "https://api-publica.datajud.cnj.jus.br/api_publica_stm/_search",
  tse: "https://api-publica.datajud.cnj.jus.br/api_publica_tse/_search",
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
};

// === Portais SEEU por estado ===
const SEEU_PORTALS: Record<string, string> = {
  nacional: "https://seeu.pje.jus.br",
  tjam: "https://seeu.pje.jus.br",
  tjba: "https://seeu.pje.jus.br",
  tjsp: "https://seeu.pje.jus.br",
  tjrj: "https://seeu.pje.jus.br",
  tjmg: "https://seeu.pje.jus.br",
};

// === Portais Projudi por estado ===
const PROJUDI_PORTALS: Record<string, string> = {
  tjam: "https://projudi.tjam.jus.br",
  tjpr: "https://projudi.tjpr.jus.br",
  tjgo: "https://projudi.tjgo.jus.br",
  tjrn: "https://projudi.tjrn.jus.br",
  tjmt: "https://projudi.tjmt.jus.br",
  tjal: "https://projudi.tjal.jus.br",
};

// === TRTs que usam Projudi ===
const PROJUDI_TRTS: Record<string, string> = {
  trt6: "https://projudi.trt6.jus.br",
  trt13: "https://projudi.trt13.jus.br",
};

/**
 * Detecta o tribunal DataJud a partir do número CNJ padrão.
 * Formato: NNNNNNN-DD.AAAA.J.TT.OOOO
 * J = segmento (1=STF,3=STJ,4=TRF,5=TRT,7=TRE/TSE,8=TJ estadual)
 * TT = código do tribunal dentro do segmento
 */
function detectTribunalFromCNJ(numero: string): string | null {
  // Normaliza para formato com pontuação se receber apenas dígitos
  const normalized = normalizeCNJ(numero);
  const clean = (normalized || numero).replace(/\s/g, "");
  const match = clean.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return null;

  const j = parseInt(match[1]);
  const tt = parseInt(match[2]);

  if (j === 1) return "stf";
  if (j === 3) return "stj";
  if (j === 4 && tt >= 1 && tt <= 6) return `trf${tt}`;
  if (j === 5 && tt >= 1 && tt <= 24) return `trt${tt}`;
  if (j === 6 && tt >= 1 && tt <= 24) return `trt${tt}`; // alguns sistemas usam J=6 para TRT
  if (j === 7) return "tse"; // Eleitoral
  if (j === 9) return "stm"; // Militar

  if (j === 8) {
    const tjMap: Record<number, string> = {
      1: "tjac", 2: "tjal", 3: "tjap", 4: "tjam", 5: "tjba",
      6: "tjce", 7: "tjdft", 8: "tjes", 9: "tjgo", 10: "tjma",
      11: "tjmg", 12: "tjms", 13: "tjmt", 14: "tjpa", 15: "tjpb",
      16: "tjpe", 17: "tjpi", 18: "tjpr", 19: "tjrj", 20: "tjrn",
      21: "tjro", 22: "tjrr", 23: "tjrs", 24: "tjsc", 25: "tjse",
      26: "tjsp", 27: "tjto",
    };
    return tjMap[tt] || null;
  }

  return null;
}

const DATAJUD_KEY = "APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

/**
 * Normaliza número CNJ para o formato canônico: NNNNNNN-DD.AAAA.J.TT.OOOO
 * DataJud armazena o número COM pontuação — buscas sem pontuação não funcionam.
 */
function normalizeCNJ(numero: string): string {
  const digits = numero.replace(/\D/g, "");
  // CNJ padrão tem 20 dígitos: 7+2+4+1+2+4
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`;
  }
  return numero.trim();
}

/** Realiza a consulta DataJud com múltiplas estratégias de busca */
async function queryDataJud(endpoint: string, numero: string): Promise<{ data?: any; error?: string; status?: number }> {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": DATAJUD_KEY,
  };

  // Estratégia 1: número CNJ formatado (como DataJud armazena)
  const formatted = normalizeCNJ(numero);
  // Estratégia 2: número como o usuário digitou (trimado)
  const original = numero.trim();
  // Estratégia 3: somente dígitos
  const stripped = numero.replace(/\D/g, "");

  // Remove duplicatas mantendo a ordem
  const candidates = [...new Set([formatted, original, stripped])].filter(Boolean);

  let lastError = "";
  let lastStatus = 0;

  for (const candidate of candidates) {
    let resp: Response;
    try {
      resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: { match: { numeroProcesso: candidate } },
          size: 10,
        }),
      });
    } catch (err) {
      lastError = String(err);
      continue;
    }

    if (!resp.ok) {
      lastStatus = resp.status;
      try { lastError = await resp.text(); } catch { lastError = `HTTP ${resp.status}`; }
      // Não tentar próxima estratégia em erros de autenticação/quota
      if (resp.status === 401 || resp.status === 402 || resp.status === 429) break;
      continue;
    }

    const data = await resp.json();
    // Retorna imediatamente se encontrou resultados
    if ((data.hits?.hits?.length ?? 0) > 0) return { data };
    // Guarda resultado vazio como fallback para retornar no fim
    lastError = "";
    lastStatus = 0;
    // Continua tentando as próximas estratégias antes de retornar vazio
    if (candidate === candidates[candidates.length - 1]) return { data };
  }

  if (lastError) return { error: lastError, status: lastStatus };
  return { data: { hits: { hits: [], total: { value: 0 } } } };
}

/** Mapeia hits do DataJud para o formato do sistema */
function mapHits(hits: any[], sistema: string) {
  return (hits || []).map((hit: any) => {
    const s = hit._source;
    return {
      numero: s.numeroProcesso,
      classe: s.classe?.nome || s.classeProcessual || "Não informado",
      assunto: s.assuntos?.map((a: any) => a.nome).join(", ") || "",
      tribunal: s.tribunal || sistema.toUpperCase(),
      sistema,
      grau: s.grau || "",
      orgaoJulgador: s.orgaoJulgador?.nome || "",
      dataAjuizamento: s.dataAjuizamento || null,
      ultimaAtualizacao: s.dataHoraUltimaAtualizacao || null,
      movimentos: (s.movimentos || []).map((m: any) => ({
        nome: m.nome,
        data: m.dataHora,
        complementos: m.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join("; ") || "",
      })),
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { numero, tribunal, sistema } = await req.json();

    if (!numero?.trim()) {
      return new Response(JSON.stringify({ error: "Número do processo é obrigatório", processos: [], total: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inputKey = (sistema || tribunal || "tjam").toLowerCase();

    // === SEEU: não tem endpoint DataJud próprio — detectar pelo número CNJ ===
    if (inputKey === "seeu") {
      const detected = detectTribunalFromCNJ(normalizeCNJ(numero) || numero);
      const endpoint = detected ? DATAJUD_ENDPOINTS[detected] : null;

      if (endpoint) {
        const result = await queryDataJud(endpoint, numero);
        if (result.data) {
          const processos = mapHits(result.data.hits?.hits, detected!);
          const portalUrl = SEEU_PORTALS[detected!] || SEEU_PORTALS.nacional;
          return new Response(JSON.stringify({
            processos,
            total: result.data.hits?.total?.value || 0,
            info: `SEEU: processo do ${detected!.toUpperCase()} encontrado via DataJud/CNJ.`,
            portal_seeu: portalUrl,
            tribunal_detectado: detected,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({
        processos: [],
        total: 0,
        info: "O SEEU não possui endpoint DataJud independente. O número do processo não segue o padrão CNJ ou não foi possível detectar o tribunal. Acesse o portal diretamente.",
        portais_seeu: SEEU_PORTALS,
        portal_seeu: SEEU_PORTALS.nacional,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === PROJUDI: não tem endpoint DataJud próprio — detectar pelo número CNJ ===
    if (inputKey === "projudi") {
      const detected = detectTribunalFromCNJ(normalizeCNJ(numero) || numero);
      const endpoint = detected ? DATAJUD_ENDPOINTS[detected] : null;

      if (endpoint) {
        const result = await queryDataJud(endpoint, numero);
        if (result.data) {
          const processos = mapHits(result.data.hits?.hits, detected!);
          const portalUrl = PROJUDI_PORTALS[detected!] || PROJUDI_TRTS[detected!] || null;
          return new Response(JSON.stringify({
            processos,
            total: result.data.hits?.total?.value || 0,
            info: `Projudi: processo do ${detected!.toUpperCase()} encontrado via DataJud/CNJ.`,
            portal_projudi: portalUrl,
            tribunal_detectado: detected,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({
        processos: [],
        total: 0,
        info: "O Projudi não possui endpoint DataJud independente. O número do processo não segue o padrão CNJ ou não foi possível detectar o tribunal. Acesse o portal do tribunal correspondente.",
        portais_projudi: { ...PROJUDI_PORTALS, ...PROJUDI_TRTS },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === TRIBUNAIS NORMAIS ===
    // Auto-detectar tribunal pelo número CNJ se informado
    const autoDetected = detectTribunalFromCNJ(normalizeCNJ(numero) || numero);
    const resolvedKey = DATAJUD_ENDPOINTS[inputKey] ? inputKey : (autoDetected || inputKey);

    const endpoint = DATAJUD_ENDPOINTS[resolvedKey];
    if (!endpoint) {
      return new Response(JSON.stringify({
        error: `Tribunal "${resolvedKey.toUpperCase()}" não encontrado no DataJud. Verifique se o tribunal está correto.`,
        processos: [],
        total: 0,
        dica: autoDetected ? `O número CNJ sugere que o processo é do ${autoDetected.toUpperCase()}` : undefined,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Tenta JusBrasil primeiro (se API key configurada) ===
    const jbResult = await queryJusBrasil(numero);
    if (jbResult.processos && jbResult.processos.length > 0) {
      const finalResult: any = {
        processos: jbResult.processos,
        total: jbResult.processos.length,
        fonte: "JusBrasil",
      };
      if (autoDetected && autoDetected !== inputKey) {
        finalResult.tribunal_detectado = autoDetected;
      }
      return new Response(JSON.stringify(finalResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Fallback: DataJud ===
    const { data, error: djError, status: djStatus } = await queryDataJud(endpoint, numero);

    if (djError) {
      console.error("DataJud error:", djStatus, djError);
      // Se JusBrasil também falhou com erro (não apenas sem resultados), reportar
      const jbErr = jbResult.error && !jbResult.error.includes("não configurada") ? ` | JusBrasil: ${jbResult.error.slice(0, 100)}` : "";
      return new Response(JSON.stringify({
        error: djStatus === 401
          ? `Chave de acesso DataJud inválida ou expirada para ${resolvedKey.toUpperCase()}.`
          : djStatus === 402
          ? `Créditos/quota DataJud esgotados.`
          : djStatus === 429
          ? `Limite de requisições DataJud excedido. Tente em instantes.`
          : djStatus === 404
          ? `Endpoint ${resolvedKey.toUpperCase()} não disponível no DataJud no momento.`
          : `Erro ao consultar DataJud (${djStatus})${jbErr}`,
        processos: [],
        total: 0,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const processos = mapHits(data.hits?.hits, resolvedKey);

    const finalResult: any = {
      processos,
      total: data.hits?.total?.value || 0,
      fonte: "DataJud/CNJ",
    };
    if (autoDetected && autoDetected !== inputKey) {
      finalResult.tribunal_detectado = autoDetected;
      finalResult.info = `Número CNJ detectado: consulta realizada no ${autoDetected.toUpperCase()}`;
    }

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("busca-processual error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Erro desconhecido",
      processos: [],
      total: 0,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
