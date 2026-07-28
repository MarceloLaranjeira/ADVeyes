import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_KEY = Deno.env.get("DATAJUD_API_KEY") ?? "";

// Regex para número CNJ: 0000000-00.0000.0.00.0000
const CNJ_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;

/** Retorna lista de nuDiario recentes do TJAM DJe */
async function getTJAMRecentEditions(days = 14): Promise<number[]> {
  try {
    const session = await fetch("https://consultasaj.tjam.jus.br/cdje/index.do", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    const cookieHeader = session.headers.get("set-cookie") || "";
    const jsessionid = (cookieHeader.match(/JSESSIONID=([^;]+)/) || [])[1] || "";

    const dtFim = new Date().toLocaleDateString("pt-BR");
    const dtInicio = new Date(Date.now() - days * 86400000).toLocaleDateString("pt-BR");

    const body = new URLSearchParams({
      "dadosConsulta.pesquisaLivre": "",
      "dadosConsulta.dtInicio": dtInicio,
      "dadosConsulta.dtFim": dtFim,
      "buscaavancada": "",
    });

    const resp = await fetch("https://consultasaj.tjam.jus.br/cdje/consultaAvancada.do", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://consultasaj.tjam.jus.br/cdje/index.do",
        "Cookie": jsessionid ? `JSESSIONID=${jsessionid}` : "",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) return [];
    const html = await resp.text();

    // Extrai nuDiario: 4237, 4236, etc.
    const matches = [...html.matchAll(/nuDiario:\s*(\d+)/g)].map(m => parseInt(m[1]));
    return [...new Set(matches)].sort((a, b) => b - a).slice(0, 20); // top 20 mais recentes
  } catch (e) {
    console.error("dje-discovery: erro ao buscar edições TJAM:", e);
    return [];
  }
}

/** Baixa PDF de uma edição do DJe e extrai texto legível */
async function downloadDJeEdition(nuDiario: number, jsessionid: string): Promise<string> {
  // Tenta diferentes endpoints de download do SAJ DJe
  const endpoints = [
    `https://consultasaj.tjam.jus.br/cdje/downloadDiario.do?nuDiario=${nuDiario}&cdCaderno=1`,
    `https://consultasaj.tjam.jus.br/cdje/getByteDiario.do?nuDiario=${nuDiario}`,
    `https://consultasaj.tjam.jus.br/cdje/gerarDiario.do?nuDiario=${nuDiario}`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/pdf,*/*",
          "Cookie": jsessionid ? `JSESSIONID=${jsessionid}` : "",
          "Referer": "https://consultasaj.tjam.jus.br/cdje/index.do",
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!resp.ok) continue;

      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("pdf") || contentType.includes("octet-stream")) {
        const bytes = await resp.arrayBuffer();
        // Extrai texto legível do PDF (texto embutido entre streams)
        const text = new TextDecoder("latin1").decode(bytes);
        return text;
      }
      if (contentType.includes("html") || contentType.includes("text")) {
        return await resp.text();
      }
    } catch {
      continue;
    }
  }
  return "";
}

/** Busca processos de um advogado no DJe do TJAM por OAB ou nome */
async function searchTJAMDJe(
  oabNumero: string,
  nomeParcial: string,
  dias = 90,
): Promise<{ numeros: string[]; edicoes_verificadas: number }> {
  const editions = await getTJAMRecentEditions(dias);
  if (editions.length === 0) {
    return { numeros: [], edicoes_verificadas: 0 };
  }

  console.log(`dje-discovery: verificando ${editions.length} edições do TJAM DJe`);

  // Pega o JSESSIONID para o download
  let jsessionid = "";
  try {
    const s = await fetch("https://consultasaj.tjam.jus.br/cdje/index.do", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    const ch = s.headers.get("set-cookie") || "";
    jsessionid = (ch.match(/JSESSIONID=([^;]+)/) || [])[1] || "";
  } catch { /* ignora */ }

  const numerosEncontrados = new Set<string>();

  // Verifica apenas as últimas 5 edições para não exceder timeout
  for (const nuDiario of editions.slice(0, 5)) {
    try {
      const texto = await downloadDJeEdition(nuDiario, jsessionid);
      if (!texto) continue;

      // Verifica se o OAB ou nome aparece nesta edição
      const oabVariants = [
        oabNumero,
        `AM${oabNumero}`,
        `AM ${oabNumero}`,
        `${oabNumero}/AM`,
        `OAB/AM ${oabNumero}`,
      ];
      const contemOAB = oabVariants.some(v => texto.includes(v));
      const contemNome = nomeParcial.length > 4
        ? texto.toLowerCase().includes(nomeParcial.toLowerCase().split(" ")[0])
        : false;

      if (contemOAB || contemNome) {
        const matches = texto.match(CNJ_REGEX) || [];
        matches.forEach(n => numerosEncontrados.add(n));
        console.log(`dje-discovery: edição ${nuDiario} tem ${matches.length} processos`);
      }
    } catch (e) {
      console.error(`dje-discovery: erro na edição ${nuDiario}:`, e);
    }
  }

  return {
    numeros: [...numerosEncontrados],
    edicoes_verificadas: editions.slice(0, 5).length,
  };
}

/** Busca detalhes de um processo no DataJud pelo número */
async function fetchProcessoByNumero(numero: string): Promise<Record<string, unknown> | null> {
  const clean = numero.replace(/\D/g, "");
  const url = "https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search";

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": DATAJUD_KEY,
      },
      body: JSON.stringify({
        query: {
          bool: {
            should: [
              { match: { numeroProcesso: numero } },
              { match: { numeroProcesso: clean } },
            ],
          },
        },
        size: 1,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return null;
    const data = await resp.json() as Record<string, unknown>;
    const hits = ((data.hits as Record<string, unknown>)?.hits as Record<string, unknown>[]) || [];
    return hits[0]?._source as Record<string, unknown> | null ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));

    const userId = user.id;

    const modo: string = body.modo || "dje"; // "dje" | "import"

    // ── MODO IMPORT: aceita lista de números de processo para salvar e monitorar ─
    if (modo === "import") {
      const numerosRaw: string[] = body.numeros || [];
      const tribunal: string = (body.tribunal || "TJAM").toUpperCase();
      if (numerosRaw.length === 0) {
        return new Response(JSON.stringify({ error: "Informe ao menos um número de processo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const tribKey = tribunal.toLowerCase();
      const endpoint = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribKey}/_search`;
      let novos = 0;
      const detalhes: Record<string, unknown>[] = [];

      for (const numero of numerosRaw.slice(0, 50)) {
        const clean = numero.trim();
        if (!clean) continue;

        const { data: existing } = await supabaseAdmin
          .from("processos").select("id").eq("numero", clean).eq("user_id", userId).maybeSingle();

        // Busca detalhes no DataJud
        let proc: Record<string, unknown> | null = null;
        try {
          const resp = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: DATAJUD_KEY },
            body: JSON.stringify({ query: { bool: { should: [
              { match: { numeroProcesso: clean } },
              { match: { numeroProcesso: clean.replace(/\D/g, "") } },
            ]}}, size: 1 }),
            signal: AbortSignal.timeout(8000),
          });
          if (resp.ok) {
            const d = await resp.json() as Record<string, unknown>;
            const hits = ((d.hits as Record<string, unknown>)?.hits as Record<string, unknown>[]) || [];
            proc = hits[0]?._source as Record<string, unknown> | null ?? null;
          }
        } catch { /* ignora */ }

        const classe = (proc?.classe as Record<string, unknown>)?.nome || "";
        const assuntos = ((proc?.assuntos as { nome: string }[]) || []).map(a => a.nome);
        const ultimoMov = (proc?.movimentos as Record<string, unknown>[])?.[0]?.nome || "";
        const dataAj = (proc?.dataAjuizamento as string)?.slice(0, 10) || null;
        const vara = (proc?.orgaoJulgador as Record<string, unknown>)?.nome || "";

        detalhes.push({ numero: clean, classe, assuntos, ultimoMov, vara, dataAj, encontrado_datajud: !!proc });

        if (!existing) {
          const { error: insErr } = await supabaseAdmin.from("processos").insert({
            user_id: userId,
            numero: clean,
            tribunal,
            vara,
            area: "civel",
            status: "ativo",
            descricao: assuntos.join(", ") || classe || "Importado manualmente",
            data_ajuizamento: dataAj,
            ultimo_andamento: ultimoMov,
            fonte: `import_manual_${tribKey}`,
          });
          if (!insErr) novos++;
        }

        await supabaseAdmin.from("processo_monitoramento").upsert({
          user_id: userId,
          numero_processo: clean,
          tribunal: tribKey,
          ultimo_movimento: ultimoMov,
          ultima_verificacao: new Date().toISOString(),
          ativo: true,
        }, { onConflict: "user_id,numero_processo" });
      }

      if (novos > 0) {
        await supabaseAdmin.from("notificacoes").insert({
          user_id: userId,
          titulo: `${novos} processo(s) importado(s) para monitoramento`,
          mensagem: `Os processos importados agora estão sendo monitorados via DataJud/${tribunal}.`,
          tipo: "sistema",
          lida: false,
        });
      }

      return new Response(JSON.stringify({
        novos,
        detalhes,
        message: `${novos} processo(s) novo(s) importado(s). ${numerosRaw.length - novos} já existiam.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ── FIM MODO IMPORT ─────────────────────────────────────────────────────────

    const oabNumero: string = (body.oab_numero || "").replace(/\D/g, "");
    const seccional: string = (body.seccional || "AM").toUpperCase();
    const nomeAdvogado: string = body.nome_advogado || "";
    const dias: number = body.dias || 90;

    if (!oabNumero) {
      return new Response(JSON.stringify({ error: "OAB obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`dje-discovery: OAB ${oabNumero}/${seccional} nome="${nomeAdvogado}"`);

    // Por enquanto só suporta TJAM — adicionar outros tribunais conforme necessário
    if (seccional !== "AM") {
      return new Response(JSON.stringify({
        numeros: [],
        edicoes_verificadas: 0,
        message: `DJe discovery não implementado para ${seccional} ainda`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { numeros, edicoes_verificadas } = await searchTJAMDJe(oabNumero, nomeAdvogado, dias);

    // Para cada número encontrado, busca detalhes no DataJud e salva na tabela processos
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let novos = 0;
    const detalhes: Record<string, unknown>[] = [];

    for (const numero of numeros) {
      // Verifica se já existe
      const { data: existing } = await supabaseAdmin
        .from("processos")
        .select("id")
        .eq("numero", numero)
        .eq("user_id", userId)
        .maybeSingle();

      const proc = await fetchProcessoByNumero(numero);
      const classe = (proc?.classe as Record<string, unknown>)?.nome || "";
      const assuntos = ((proc?.assuntos as { nome: string }[]) || []).map(a => a.nome);
      const ultimoMov = (proc?.movimentos as Record<string, unknown>[])?.[0]?.nome || "";
      const dataAj = (proc?.dataAjuizamento as string)?.slice(0, 10) || null;
      const vara = (proc?.orgaoJulgador as Record<string, unknown>)?.nome || "";

      detalhes.push({ numero, classe, assuntos, ultimoMov, vara, dataAj });

      if (!existing) {
        const { error: insErr } = await supabaseAdmin.from("processos").insert({
          user_id: userId,
          numero,
          tribunal: "TJAM",
          vara,
          area: "civel",
          status: "ativo",
          descricao: assuntos.join(", ") || classe,
          data_ajuizamento: dataAj,
          ultimo_andamento: ultimoMov,
          fonte: "dje_tjam",
        });
        if (!insErr) novos++;
      }

      // Monitoramento
      await supabaseAdmin.from("processo_monitoramento").upsert({
        user_id: userId,
        numero_processo: numero,
        tribunal: "tjam",
        ultimo_movimento: ultimoMov,
        ultima_verificacao: new Date().toISOString(),
        ativo: true,
        oab_origem: `${oabNumero}/${seccional}`,
      }, { onConflict: "user_id,numero_processo" });
    }

    if (novos > 0) {
      await supabaseAdmin.from("notificacoes").insert({
        user_id: userId,
        titulo: "Processos descobertos via DJe TJAM",
        mensagem: `${novos} novo(s) processo(s) encontrado(s) no Diário da Justiça do TJAM.`,
        tipo: "sistema",
        lida: false,
      });
    }

    return new Response(JSON.stringify({
      numeros,
      detalhes,
      novos,
      edicoes_verificadas,
      message: numeros.length > 0
        ? `${numeros.length} processo(s) encontrado(s) no DJe TJAM (${edicoes_verificadas} edições verificadas). ${novos} novo(s) salvo(s).`
        : `Nenhum processo encontrado no DJe TJAM nas últimas ${edicoes_verificadas} edições verificadas.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("dje-discovery error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
