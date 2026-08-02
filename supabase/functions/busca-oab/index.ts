/**
 * busca-oab — Edge Function
 * Busca processos por OAB, CPF ou Nome
 * Fonte primária: Escavador API v2
 * Fallback: DataJud/CNJ (API pública)
 * Requer sessão Supabase válida para proteger APIs externas e limitar abuso.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDataJudAuthorization } from "../_shared/datajud-auth.ts";
import { getEscavadorToken } from "../_shared/provider-secrets.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Escavador
const ESC_BASE = "https://api.escavador.com";

function escavadorHeaders(token: string) {
  return {
    "Authorization": `Bearer ${token}`,
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json",
  };
}

// DataJud fallback
const DATAJUD_KEY = getDataJudAuthorization();

const ENDPOINTS: Record<string, string> = {
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
  stf:  "https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
  stj:  "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
  tst:  "https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search",
  trf1: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
  trf2: "https://api-publica.datajud.cnj.jus.br/api_publica_trf2/_search",
  trf3: "https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search",
  trf4: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  trf5: "https://api-publica.datajud.cnj.jus.br/api_publica_trf5/_search",
  trt1:  "https://api-publica.datajud.cnj.jus.br/api_publica_trt1/_search",
  trt2:  "https://api-publica.datajud.cnj.jus.br/api_publica_trt2/_search",
  trt3:  "https://api-publica.datajud.cnj.jus.br/api_publica_trt3/_search",
  trt4:  "https://api-publica.datajud.cnj.jus.br/api_publica_trt4/_search",
  trt11: "https://api-publica.datajud.cnj.jus.br/api_publica_trt11/_search",
};

const OAB_ESTADO_TRIBUNAIS: Record<string, string[]> = {
  AM: ["tjam", "trf1", "trt11"],
  PA: ["tjpa", "trf1", "trt8"],
  SP: ["tjsp", "trf3", "trt2"],
  RJ: ["tjrj", "trf2", "trt1"],
  MG: ["tjmg", "trf1", "trt3"],
  RS: ["tjrs", "trf4", "trt4"],
  PR: ["tjpr", "trf4", "trt9"],
  SC: ["tjsc", "trf4", "trt12"],
  BA: ["tjba", "trf1", "trt5"],
  CE: ["tjce", "trf5", "trt7"],
  PE: ["tjpe", "trf5", "trt6"],
  GO: ["tjgo", "trf1", "trt18"],
  MT: ["tjmt", "trf1", "trt23"],
  MS: ["tjms", "trf3", "trt24"],
  DF: ["tjdft", "trf1", "trt10"],
  MA: ["tjma", "trf1", "trt16"],
  PI: ["tjpi", "trf1", "trt22"],
  RN: ["tjrn", "trf5", "trt21"],
  PB: ["tjpb", "trf5", "trt13"],
  AL: ["tjal", "trf5", "trt19"],
  SE: ["tjse", "trf5", "trt20"],
  AC: ["tjac", "trf1", "trt14"],
  AP: ["tjap", "trf1", "trt8"],
  RO: ["tjro", "trf1", "trt14"],
  RR: ["tjrr", "trf1", "trt11"],
  TO: ["tjto", "trf1", "trt10"],
  ES: ["tjes", "trf2", "trt17"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function tipoMovimento(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("sentença") || n.includes("sentenca")) return "sentenca";
  if (n.includes("acórdão") || n.includes("acordao")) return "acordao";
  if (n.includes("edital")) return "edital";
  if (n.includes("despacho")) return "despacho";
  if (n.includes("intimação") || n.includes("intimacao") || n.includes("cite-se") || n.includes("citação")) return "intimacao";
  return "despacho";
}

// ── Escavador ─────────────────────────────────────────────────────────────────

interface EscavadorItem {
  numero_cnj?: string;
  titulo_polo_ativo?: string;
  titulo_polo_passivo?: string;
  tribunal?: { sigla?: string; nome?: string };
  classe_processual?: { nome?: string };
  assuntos?: { nome: string }[];
  data_inicio?: string;
  data_ajuizamento?: string;
  ultima_movimentacao?: { tipo?: string; data?: string; conteudo?: string };
  fontes?: { nome?: string; tipo?: string; grau?: string }[];
}

function normalizarItemEscavador(item: EscavadorItem): Record<string, unknown> {
  const tribunalSigla = item.tribunal?.sigla || "?";
  const classe = item.classe_processual?.nome || "";
  const assuntos = (item.assuntos || []).map(a => a.nome).join(", ");
  const ultimaMov = item.ultima_movimentacao;

  return {
    tribunal: tribunalSigla.toUpperCase(),
    numero_processo: item.numero_cnj || "",
    classe,
    assuntos,
    orgao: tribunalSigla.toUpperCase(),
    data_ajuizamento: item.data_ajuizamento || item.data_inicio || null,
    partes: [
      ...(item.titulo_polo_ativo ? [{ nome: item.titulo_polo_ativo, tipo: "Ativo" }] : []),
      ...(item.titulo_polo_passivo ? [{ nome: item.titulo_polo_passivo, tipo: "Passivo" }] : []),
    ],
    ultimos_movimentos: ultimaMov
      ? [{
          nome: ultimaMov.tipo || "",
          data: ultimaMov.data || "",
          tipo: tipoMovimento(ultimaMov.tipo || ""),
        }]
      : [],
    grau: "G1",
    sistema: "Escavador",
  };
}

async function buscarEscavadorOAB(
  oabNumero: string,
  seccional: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  if (!token) return [];

  const items: EscavadorItem[] = [];
  let url: string | null =
    `${ESC_BASE}/api/v2/advogado/processos?oab_numero=${oabNumero}&oab_estado=${seccional}&limit=100`;

  while (url) {
    try {
      const resp = await fetch(url, {
        headers: escavadorHeaders(token),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) {
        console.warn(`[busca-oab] escavador HTTP ${resp.status}`);
        break;
      }
      const data = await resp.json() as { items?: EscavadorItem[]; links?: { next?: string } };
      const page = data.items || [];
      items.push(...page);
      url = (page.length >= 100 && data.links?.next) ? data.links.next : null;
    } catch (e) {
      console.warn(`[busca-oab] escavador erro: ${e}`);
      break;
    }
  }

  console.log(`[busca-oab] escavador OAB: ${items.length} itens`);
  return items.map(normalizarItemEscavador).filter(r => r.numero_processo);
}

async function buscarEscavadorNome(
  nome: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  if (!token) return [];

  try {
    const url = `${ESC_BASE}/api/v2/envolvido/processos?nome=${encodeURIComponent(nome)}&limit=100`;
    const resp = await fetch(url, {
      headers: escavadorHeaders(token),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as { items?: EscavadorItem[] };
    const items = data.items || [];
    console.log(`[busca-oab] escavador nome: ${items.length} itens`);
    return items.map(normalizarItemEscavador).filter(r => r.numero_processo);
  } catch (e) {
    console.warn(`[busca-oab] escavador nome erro: ${e}`);
    return [];
  }
}

// ── DataJud fallback ──────────────────────────────────────────────────────────

function queryOAB(numero: string): Record<string, unknown> {
  const digits = numero.replace(/\D/g, "");
  const seccional = (numero.match(/([A-Z]{2})/i) || [])[0]?.toUpperCase() || "";
  const termos: string[] = [digits];
  if (seccional) {
    termos.push(`${digits}/${seccional}`, `${seccional}${digits}`, `${seccional} ${digits}`);
  }
  return {
    bool: {
      should: termos.flatMap(t => [
        { match: { "partes.advogados.inscricaoOab": t } },
        { match: { "partes.advogados.oab": t } },
        { wildcard: { "partes.advogados.inscricaoOab": { value: `*${digits}*` } } },
      ]),
      minimum_should_match: 1,
    },
  };
}

function queryCPF(cpf: string): Record<string, unknown> {
  const digits = cpf.replace(/\D/g, "");
  const formatted = digits.length === 11
    ? `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`
    : digits;
  return {
    bool: {
      should: [
        { match: { "partes.cpfCnpj": digits } },
        { match: { "partes.cpfCnpj": formatted } },
        { match: { "partes.documento": digits } },
        { wildcard: { "partes.cpfCnpj": { value: `*${digits.slice(-4)}` } } },
      ],
      minimum_should_match: 1,
    },
  };
}

function queryNome(nome: string): Record<string, unknown> {
  return {
    bool: {
      should: [
        { match: { "partes.nome": { query: nome, fuzziness: "AUTO" } } },
        { match: { "partes.advogados.nome": { query: nome, fuzziness: "AUTO" } } },
        { match_phrase_prefix: { "partes.nome": nome } },
      ],
      minimum_should_match: 1,
    },
  };
}

function determinarTribunais(tipo: string, valor: string): string[] {
  if (tipo === "oab") {
    const seccional = (valor.match(/\/\s*([A-Z]{2})\s*$/i) || valor.match(/^([A-Z]{2})\s*\d/i) || [])[1]?.toUpperCase();
    if (seccional && OAB_ESTADO_TRIBUNAIS[seccional]) {
      return OAB_ESTADO_TRIBUNAIS[seccional];
    }
    return ["tjam", "trf1", "trt11", "stj"];
  }
  return ["tjam", "tjsp", "tjrj", "trf1", "stj"];
}

function normalizarHitDataJud(hit: Record<string, unknown>, trib: string): Record<string, unknown> {
  const src = (hit._source || {}) as Record<string, unknown>;
  const movimentos = (src.movimentos as Record<string, unknown>[]) || [];
  const partes = (src.partes as { nome: string; tipo: string; advogados?: { nome: string; inscricaoOab: string }[] }[]) || [];

  return {
    tribunal: trib.toUpperCase(),
    numero_processo: src.numeroProcesso || "",
    classe: ((src.classe as Record<string, unknown>)?.nome as string) || "",
    assuntos: ((src.assuntos as { nome: string }[]) || []).map(a => a.nome).join(", "),
    orgao: ((src.orgaoJulgador as Record<string, unknown>)?.nome as string) || trib.toUpperCase(),
    data_ajuizamento: (src.dataAjuizamento as string) || null,
    partes: partes.slice(0, 4).map(p => ({ nome: p.nome, tipo: p.tipo })),
    ultimos_movimentos: movimentos.slice(0, 3).map(m => ({
      nome: (m.nome as string) || "",
      data: (m.dataHora as string) || "",
      tipo: tipoMovimento((m.nome as string) || ""),
    })),
    grau: src.grau || "G1",
    sistema: src.sistema || "",
  };
}

async function consultarTribunal(
  trib: string,
  query: Record<string, unknown>,
  size = 10,
): Promise<Record<string, unknown>[]> {
  const endpoint = ENDPOINTS[trib];
  if (!endpoint) return [];

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": DATAJUD_KEY },
      body: JSON.stringify({
        query,
        size,
        sort: [{ "dataAjuizamento": { order: "desc" } }],
        _source: [
          "numeroProcesso", "classe", "assuntos", "orgaoJulgador",
          "dataAjuizamento", "grau", "sistema", "partes", "movimentos",
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.warn(`[busca-oab] datajud ${trib} HTTP ${resp.status}: ${body.slice(0, 120)}`);
      return [];
    }

    const data = await resp.json() as Record<string, unknown>;
    const hits = ((data.hits as Record<string, unknown>)?.hits as Record<string, unknown>[]) || [];
    console.log(`[busca-oab] datajud ${trib}: ${hits.length} resultados`);
    return hits.map(h => normalizarHitDataJud(h, trib));
  } catch (e) {
    clearTimeout(tid);
    console.warn(`[busca-oab] datajud ${trib} erro: ${String(e)}`);
    return [];
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
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
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const escavadorToken = await getEscavadorToken(supabaseAdmin);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    const tipo = ((body.tipo as string) || "oab").toLowerCase() as "oab" | "cpf" | "nome";
    const valor = ((body.valor as string) || "").trim();

    if (!valor) {
      return new Response(
        JSON.stringify({ error: "Informe o valor da busca (OAB, CPF ou Nome)" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    console.log(`[busca-oab] tipo=${tipo} valor="${valor}"`);

    // ── Fonte primária: Escavador ─────────────────────────────────────────────
    let resultados: Record<string, unknown>[] = [];
    let fonte = "Escavador";

    if (escavadorToken) {
      if (tipo === "oab") {
        // Extrair número e estado da OAB (ex: "10099/AM")
        const oabMatch = valor.match(/^(\d+)\s*\/\s*([A-Z]{2})$/i);
        if (oabMatch) {
          resultados = await buscarEscavadorOAB(
            oabMatch[1],
            oabMatch[2].toUpperCase(),
            escavadorToken,
          );
        } else {
          resultados = await buscarEscavadorOAB(
            valor.replace(/\D/g, ""),
            "AM",
            escavadorToken,
          );
        }
      } else if (tipo === "nome") {
        resultados = await buscarEscavadorNome(valor, escavadorToken);
      }
      // CPF não tem endpoint direto no Escavador — vai para DataJud
    }

    // ── Fallback: DataJud ─────────────────────────────────────────────────────
    if (resultados.length === 0) {
      if (resultados.length === 0) console.log(`[busca-oab] escavador sem resultados — usando DataJud`);
      fonte = "DataJud/CNJ";

      let esQuery: Record<string, unknown>;
      if (tipo === "oab") {
        esQuery = queryOAB(valor);
      } else if (tipo === "cpf") {
        esQuery = queryCPF(valor);
      } else {
        esQuery = queryNome(valor);
      }

      const tribunais = determinarTribunais(tipo, valor).filter(t => ENDPOINTS[t]);
      console.log(`[busca-oab] datajud tribunais: ${tribunais.join(", ")}`);

      resultados = (
        await Promise.all(tribunais.slice(0, 4).map(t => consultarTribunal(t, esQuery)))
      ).flat();
    }

    // Remove duplicatas por número de processo
    const vistos = new Set<string>();
    const unicos = resultados.filter(r => {
      const num = r.numero_processo as string;
      if (!num || vistos.has(num)) return false;
      vistos.add(num);
      return true;
    });

    console.log(`[busca-oab] total únicos: ${unicos.length} (fonte: ${fonte})`);

    return new Response(
      JSON.stringify({
        resultados: unicos,
        total: unicos.length,
        fonte,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[busca-oab] erro:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
