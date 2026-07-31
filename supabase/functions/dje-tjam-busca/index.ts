/**
 * dje-tjam-busca — Edge Function
 * Busca publicações no Diário de Justiça Eletrônico do TJAM
 *
 * Portal SAJ: https://consultasaj.tjam.jus.br/cdje/
 *
 * Parâmetros esperados no body:
 *   - dataInicio: string  "YYYY-MM-DD"
 *   - dataFim:    string  "YYYY-MM-DD"
 *   - palavraChave?: string
 *   - oab?:        string  (apenas dígitos)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DJE_BASE = "https://consultasaj.tjam.jus.br/cdje";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converte "YYYY-MM-DD" → "DD/MM/YYYY" */
function toPtBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Extrai o valor de um atributo de um cookie Set-Cookie */
function extractCookie(header: string, name: string): string {
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? "";
}

/** Remove tags HTML e normaliza espaços */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Classifica o tipo de ato a partir do texto */
function classificarTipo(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("sentença") || t.includes("sentenca")) return "sentenca";
  if (t.includes("acórdão") || t.includes("acordao")) return "acordao";
  if (t.includes("edital")) return "edital";
  if (t.includes("portaria") || t.includes("resolução")) return "portaria";
  if (t.includes("despacho")) return "despacho";
  if (t.includes("intimação") || t.includes("intimacao") || t.includes("intimar")) return "intimacao";
  if (t.includes("citação") || t.includes("citacao") || t.includes("cite-se")) return "intimacao";
  return "despacho";
}

/** Extrai números CNJ do texto */
function extrairNumerosCNJ(texto: string): string[] {
  const matches = texto.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) ?? [];
  return [...new Set(matches)];
}

/** Extrai partes (réu/autor) do texto da publicação */
function extrairPartes(texto: string): string {
  // Padrão: "AUTOR: X vs RÉU: Y" ou "Requerente: X / Requerido: Y" etc.
  const patterns = [
    /(?:autor[ae]?|requerente|exequente|impetrante)[:\s]+([^.\n;]{3,60})/i,
    /(?:réu|ré|requerido[a]?|executado[a]?|impetrado[a]?)[:\s]+([^.\n;]{3,60})/i,
  ];
  const partes: string[] = [];
  for (const p of patterns) {
    const m = texto.match(p);
    if (m?.[1]) partes.push(m[1].trim());
    if (partes.length >= 2) break;
  }
  return partes.join(" × ") || "";
}

/** Extrai nome do órgão julgador do texto */
function extrairOrgao(texto: string): string {
  const m = texto.match(/(\d[ªº]?\s+Var[a][\w\s]+?(?:de[\s\w]+?)?(?:Comarca[\s\w]+?)?)\s*[.—]/i)
    || texto.match(/(Câmara[\s\w]+)/i)
    || texto.match(/(Vara[\s\w,]+)/i);
  return m?.[1]?.trim() ?? "";
}

// ─── Parsing do HTML do SAJ DJe ──────────────────────────────────────────────

interface PublicacaoRaw {
  id: string;
  dataPublicacao: string;
  edicao: string;
  caderno: string;
  pagina: string;
  tipoAto: string;
  conteudo: string;
  numeroProcesso: string | null;
  partes: string | null;
  orgaoJulgador: string | null;
}

/**
 * Faz scraping do portal SAJ DJe TJAM e retorna publicações.
 *
 * Fluxo:
 * 1. GET /cdje/index.do → obtém JSESSIONID
 * 2. POST /cdje/consultaAvancada.do → HTML com lista de edições + snippets
 * 3. Para cada edição na lista, GET /cdje/consultaSimples.do?nuDiario=X → snippets de publicações
 * 4. Parseia e retorna publicações estruturadas
 */
async function buscarDjeTjam(params: {
  dataInicio: string;
  dataFim: string;
  palavraChave: string;
  oab: string;
}): Promise<PublicacaoRaw[]> {
  const { dataInicio, dataFim, palavraChave, oab } = params;

  // 1. Sessão
  let jsessionid = "";
  try {
    const sessionResp = await fetch(`${DJE_BASE}/index.do`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    const cookieHeader = sessionResp.headers.get("set-cookie") ?? "";
    jsessionid = extractCookie(cookieHeader, "JSESSIONID");
    console.log("[dje-tjam] JSESSIONID:", jsessionid ? "ok" : "não obtido");
  } catch (e) {
    console.error("[dje-tjam] erro ao criar sessão:", e);
  }

  const cookieStr = jsessionid ? `JSESSIONID=${jsessionid}` : "";
  const baseHeaders = {
    "User-Agent": UA,
    "Cookie": cookieStr,
    "Referer": `${DJE_BASE}/index.do`,
  };

  // 2. Busca avançada — monta termo de pesquisa
  const termoBusca = [
    palavraChave,
    oab ? `${oab}` : "",
    oab ? `OAB/AM ${oab}` : "",
  ].filter(Boolean).join(" OR ");

  const formBody = new URLSearchParams({
    "dadosConsulta.pesquisaLivre": termoBusca,
    "dadosConsulta.dtInicio": toPtBR(dataInicio),
    "dadosConsulta.dtFim": toPtBR(dataFim),
    "dadosConsulta.cdCaderno": "1",  // Caderno 1 = Judicial
    "buscaavancada": "",
  });

  let searchHtml = "";
  try {
    const searchResp = await fetch(`${DJE_BASE}/consultaAvancada.do`, {
      method: "POST",
      headers: { ...baseHeaders, "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    if (searchResp.ok) {
      searchHtml = await searchResp.text();
      console.log("[dje-tjam] busca HTML tamanho:", searchHtml.length);
    } else {
      console.error("[dje-tjam] busca HTTP:", searchResp.status);
    }
  } catch (e) {
    console.error("[dje-tjam] erro na busca:", e);
  }

  // 3. Extrai nuDiario das edições encontradas
  const nuDiarios = [...new Set(
    [...(searchHtml.matchAll(/nuDiario[=:'"]+\s*(\d+)/gi))]
      .map(m => parseInt(m[1]))
      .filter(n => !isNaN(n))
  )].sort((a, b) => b - a).slice(0, 10);

  console.log("[dje-tjam] edições encontradas:", nuDiarios.join(",") || "nenhuma");

  // Também verifica se há snippets de publicação diretamente no HTML da busca
  const publicacoes: PublicacaoRaw[] = [];
  const vistos = new Set<string>();

  // 4. Parseia snippets do HTML de busca
  parsearSnippetsHTML(searchHtml, publicacoes, vistos, dataFim);

  // 5. Para cada edição, busca o conteúdo de publicações
  for (const nuDiario of nuDiarios.slice(0, 5)) {
    await buscarConteudoEdicao(nuDiario, cookieStr, params, publicacoes, vistos);
  }

  console.log("[dje-tjam] total publicações:", publicacoes.length);
  return publicacoes;
}

/** Parseia snippets de publicações dentro de um HTML do SAJ DJe */
function parsearSnippetsHTML(
  html: string,
  resultado: PublicacaoRaw[],
  vistos: Set<string>,
  dataRef: string,
): void {
  if (!html) return;

  // O SAJ DJe tipicamente retorna blocos de publicação em <tr> ou <div class="publicacao">
  // Extraímos via regex os blocos de texto que contém palavras-chave jurídicas

  // Padrão 1: blocos com número de processo
  const cnjPattern = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  const matches = [...html.matchAll(cnjPattern)];

  for (const match of matches) {
    const numero = match[1];
    if (vistos.has(numero)) continue;

    // Extrai contexto ao redor do número (500 chars antes e depois)
    const start = Math.max(0, match.index! - 300);
    const end = Math.min(html.length, match.index! + 500);
    const trecho = stripHtml(html.substring(start, end));

    if (trecho.length < 50) continue;
    vistos.add(numero);

    resultado.push({
      id: `parse-${numero}-${Date.now()}`,
      dataPublicacao: dataRef,
      edicao: "",
      caderno: "1 - Judicial",
      pagina: "",
      tipoAto: classificarTipo(trecho),
      conteudo: trecho,
      numeroProcesso: numero,
      partes: extrairPartes(trecho) || null,
      orgaoJulgador: extrairOrgao(trecho) || null,
    });
  }
}

/** Busca publicações de uma edição específica pelo nuDiario */
async function buscarConteudoEdicao(
  nuDiario: number,
  cookieStr: string,
  params: { palavraChave: string; oab: string; dataInicio: string; dataFim: string },
  resultado: PublicacaoRaw[],
  vistos: Set<string>,
): Promise<void> {
  const baseHeaders = {
    "User-Agent": UA,
    "Cookie": cookieStr,
    "Referer": `${DJE_BASE}/index.do`,
  };

  // Tenta endpoint de consulta por edição
  const endpoints = [
    `${DJE_BASE}/consultaSimples.do?nuDiario=${nuDiario}&cdCaderno=1`,
    `${DJE_BASE}/getConteudo.do?nuDiario=${nuDiario}`,
    `${DJE_BASE}/downloadDiario.do?nuDiario=${nuDiario}&cdCaderno=1`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        headers: baseHeaders,
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      });

      if (!resp.ok) continue;

      const contentType = resp.headers.get("content-type") ?? "";
      let texto = "";

      if (contentType.includes("pdf") || contentType.includes("octet-stream")) {
        // PDF: tenta extrair texto ASCII embutido
        const bytes = await resp.arrayBuffer();
        const raw = new TextDecoder("latin1").decode(bytes);
        // Extrai strings de texto entre parênteses (operadores Tj/TJ do PDF)
        const textParts = [...raw.matchAll(/\(([^)]{5,200})\)\s*T[jJ]/g)].map(m => m[1]);
        texto = textParts.join(" ");
      } else if (contentType.includes("html") || contentType.includes("text")) {
        texto = await resp.text();
      } else {
        continue;
      }

      if (!texto || texto.length < 100) continue;

      console.log(`[dje-tjam] edição ${nuDiario} conteúdo tamanho:`, texto.length);

      // Filtra pelo termo de busca se especificado
      const termoBusca = (params.palavraChave + " " + params.oab).trim().toLowerCase();
      if (termoBusca) {
        const primeiraTerm = termoBusca.split(/\s+/)[0];
        if (primeiraTerm.length > 3 && !texto.toLowerCase().includes(primeiraTerm)) {
          console.log(`[dje-tjam] edição ${nuDiario} não contém o termo, pulando`);
          break;
        }
      }

      // Extrai data da edição do HTML (se disponível)
      const dataEdicaoMatch = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
      const dataEdicao = dataEdicaoMatch
        ? dataEdicaoMatch[1].split("/").reverse().join("-")
        : params.dataFim;

      // Parse de publicações no conteúdo
      if (contentType.includes("html") || contentType.includes("text")) {
        parsearSnippetsHTMLComEdicao(
          texto, nuDiario.toString(), dataEdicao, resultado, vistos
        );
      } else {
        // PDF: divide por números CNJ
        parsearTextoPDF(texto, nuDiario.toString(), dataEdicao, params, resultado, vistos);
      }

      break; // sucesso, não tenta próximo endpoint
    } catch (e) {
      console.error(`[dje-tjam] erro edição ${nuDiario} endpoint ${url}:`, String(e));
    }
  }
}

/** Parseia HTML com contexto de edição */
function parsearSnippetsHTMLComEdicao(
  html: string,
  edicao: string,
  dataPublicacao: string,
  resultado: PublicacaoRaw[],
  vistos: Set<string>,
): void {
  const texto = stripHtml(html);

  // Extrai por número CNJ
  const cnjPattern = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  const matches = [...html.matchAll(cnjPattern)];

  for (const match of matches) {
    const numero = match[1];
    const chave = `${edicao}-${numero}`;
    if (vistos.has(chave)) continue;

    const start = Math.max(0, match.index! - 200);
    const end = Math.min(html.length, match.index! + 800);
    const trecho = stripHtml(html.substring(start, end));

    if (trecho.length < 30) continue;
    vistos.add(chave);

    // Extrai caderno do HTML se disponível
    const cadernoMatch = html.match(/(?:caderno|cad)[:\s]+([^<\n]{3,60})/i);
    const caderno = cadernoMatch?.[1]?.trim() ?? "1 - Judicial";

    // Extrai página se disponível
    const paginaMatch = trecho.match(/p[áa]g(?:ina)?\.?\s*(\d+)/i);
    const pagina = paginaMatch?.[1] ?? "";

    resultado.push({
      id: `edicao-${edicao}-${numero}-${Date.now()}`,
      dataPublicacao,
      edicao,
      caderno,
      pagina,
      tipoAto: classificarTipo(trecho),
      conteudo: trecho,
      numeroProcesso: numero,
      partes: extrairPartes(trecho) || null,
      orgaoJulgador: extrairOrgao(trecho) || null,
    });
  }

  // Se nenhum CNJ encontrado, tenta blocos por delimitadores
  if (matches.length === 0) {
    const blocos = texto.split(/(?=INTIMAÇÃO|DESPACHO|SENTENÇA|ACÓRDÃO|EDITAL|PORTARIA)/i);
    for (const bloco of blocos.slice(1, 20)) {
      const trim = bloco.trim();
      if (trim.length < 50) continue;
      const chave = `${edicao}-${trim.slice(0, 40)}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      resultado.push({
        id: `bloco-${edicao}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dataPublicacao,
        edicao,
        caderno: "1 - Judicial",
        pagina: "",
        tipoAto: classificarTipo(trim),
        conteudo: trim.slice(0, 2000),
        numeroProcesso: extrairNumerosCNJ(trim)[0] ?? null,
        partes: extrairPartes(trim) || null,
        orgaoJulgador: extrairOrgao(trim) || null,
      });
    }
  }
}

/** Parseia texto extraído de PDF */
function parsearTextoPDF(
  texto: string,
  edicao: string,
  dataPublicacao: string,
  params: { palavraChave: string; oab: string },
  resultado: PublicacaoRaw[],
  vistos: Set<string>,
): void {
  // Divide por número CNJ ou por marcadores de tipo de ato
  const cnjPattern = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
  const matches = [...texto.matchAll(cnjPattern)];

  for (const match of matches) {
    const numero = match[1];
    const chave = `pdf-${edicao}-${numero}`;
    if (vistos.has(chave)) continue;

    // Verifica se o trecho contém o termo buscado
    const start = Math.max(0, match.index! - 300);
    const end = Math.min(texto.length, match.index! + 800);
    const trecho = texto.substring(start, end).replace(/[^\x20-\x7E\u00C0-\u024F\n]/g, " ").trim();

    if (trecho.length < 30) continue;

    // Filtra por termo de busca
    const termos = [params.palavraChave, params.oab].filter(Boolean);
    if (termos.length > 0) {
      const encontrou = termos.some(t =>
        t.length > 3 && trecho.toLowerCase().includes(t.toLowerCase())
      );
      if (!encontrou) continue;
    }

    vistos.add(chave);

    resultado.push({
      id: `pdf-${edicao}-${numero}-${Date.now()}`,
      dataPublicacao,
      edicao,
      caderno: "1 - Judicial",
      pagina: "",
      tipoAto: classificarTipo(trecho),
      conteudo: trecho,
      numeroProcesso: numero,
      partes: extrairPartes(trecho) || null,
      orgaoJulgador: extrairOrgao(trecho) || null,
    });
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    const dataInicio = (body.dataInicio as string) || "";
    const dataFim = (body.dataFim as string) || "";
    const palavraChave = ((body.palavraChave as string) || "").trim();
    const oab = ((body.oab as string) || "").replace(/\D/g, "");

    // Validações
    if (!dataInicio || !dataFim) {
      return new Response(
        JSON.stringify({ error: "Informe dataInicio e dataFim (YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!palavraChave && !oab) {
      return new Response(
        JSON.stringify({ error: "Informe palavraChave ou oab" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[dje-tjam-busca] user=${userId} periodo=${dataInicio}→${dataFim} palavraChave="${palavraChave}" oab="${oab}"`);

    const publicacoes = await buscarDjeTjam({ dataInicio, dataFim, palavraChave, oab });

    return new Response(
      JSON.stringify({
        publicacoes,
        total: publicacoes.length,
        fonte: "DJE TJAM — consultasaj.tjam.jus.br",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[dje-tjam-busca] erro:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
