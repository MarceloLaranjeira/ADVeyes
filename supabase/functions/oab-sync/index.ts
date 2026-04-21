/**
 * oab-sync — Edge Function
 * Sincroniza processos do advogado
 * Fonte primária: Escavador API v2
 * Fallback: DataJud/CNJ (API pública)
 *
 * verify_jwt = false — aceita user_id no body como fallback
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Escavador
const ESCAVADOR_TOKEN = Deno.env.get("ESCAVADOR_API_TOKEN") ?? "";
const ESC_BASE = "https://api.escavador.com";
const ESC_HEADERS = {
  "Authorization": `Bearer ${ESCAVADOR_TOKEN}`,
  "X-Requested-With": "XMLHttpRequest",
  "Accept": "application/json",
};

// DataJud/CNJ — fallback gratuito
const DATAJUD_KEY =
  Deno.env.get("DATAJUD_API_KEY") ||
  "APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// Tribunais por estado OAB
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

const DATAJUD_ENDPOINTS: Record<string, string> = {
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
  trt5:  "https://api-publica.datajud.cnj.jus.br/api_publica_trt5/_search",
  trt8:  "https://api-publica.datajud.cnj.jus.br/api_publica_trt8/_search",
  trt9:  "https://api-publica.datajud.cnj.jus.br/api_publica_trt9/_search",
  trt10: "https://api-publica.datajud.cnj.jus.br/api_publica_trt10/_search",
  trt11: "https://api-publica.datajud.cnj.jus.br/api_publica_trt11/_search",
  trt12: "https://api-publica.datajud.cnj.jus.br/api_publica_trt12/_search",
};

// ── helpers ───────────────────────────────────────────────────────────────────

function normalizeCNJ(n: string): string {
  const d = n.replace(/\D/g, "");
  if (d.length === 20)
    return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16)}`;
  return n.trim();
}

function detectArea(texto: string): string {
  const t = texto.toLowerCase();
  if (t.match(/criminal|penal|tráfico|homicídio/)) return "penal";
  if (t.match(/trabalhista|emprego|rescisão|clt/)) return "trabalhista";
  if (t.match(/família|divórcio|alimentos|guarda/)) return "familia";
  if (t.match(/execução|cumprimento|penhora/)) return "execucao";
  if (t.match(/administrativo|federal|previdenci/)) return "administrativo";
  return "civel";
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
  fonte?: string;
}

/** Busca todos os processos de um advogado via Escavador (com paginação) */
async function buscarProcessosEscavador(
  oabNumero: string,
  seccional: string,
): Promise<EscavadorItem[]> {
  if (!ESCAVADOR_TOKEN) {
    console.warn("ESCAVADOR_API_TOKEN não configurado");
    return [];
  }

  const items: EscavadorItem[] = [];
  let url: string | null = `${ESC_BASE}/api/v2/advogado/processos?oab_numero=${oabNumero}&oab_estado=${seccional}&limit=100`;

  while (url) {
    try {
      const resp = await fetch(url, {
        headers: ESC_HEADERS,
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.warn(`escavador processos HTTP ${resp.status}: ${txt.slice(0, 200)}`);
        break;
      }

      const data = await resp.json() as { items?: EscavadorItem[]; links?: { next?: string } };
      const page = data.items || [];
      items.push(...page);
      console.log(`escavador processos página: ${page.length} itens (total acumulado: ${items.length})`);

      url = (page.length >= 100 && data.links?.next) ? data.links.next : null;
    } catch (e) {
      console.warn(`escavador processos erro: ${e}`);
      break;
    }
  }

  return items;
}

/** Busca processos por nome via Escavador */
async function buscarProcessosNomeEscavador(
  nome: string,
): Promise<EscavadorItem[]> {
  if (!ESCAVADOR_TOKEN) return [];

  const items: EscavadorItem[] = [];
  const url = `${ESC_BASE}/api/v2/envolvido/processos?nome=${encodeURIComponent(nome)}&limit=100`;

  try {
    const resp = await fetch(url, {
      headers: ESC_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) return [];

    const data = await resp.json() as { items?: EscavadorItem[] };
    items.push(...(data.items || []));
    console.log(`escavador envolvido processos: ${items.length} itens`);
  } catch (e) {
    console.warn(`escavador nome erro: ${e}`);
  }

  return items;
}

/** Normaliza item do Escavador para o formato do banco */
function normalizarItemEscavador(item: EscavadorItem) {
  const tribunalSigla = item.tribunal?.sigla || item.fonte || "desconhecido";
  const classe = item.classe_processual?.nome || "";
  const assuntos = (item.assuntos || []).map(a => a.nome).join(", ");
  const ultimaMov = item.ultima_movimentacao;
  const ultimoAndamento = ultimaMov
    ? `${ultimaMov.tipo || ""} — ${(ultimaMov.data || "").slice(0, 10)}`
    : "";

  return {
    numero: normalizeCNJ(item.numero_cnj || ""),
    tribunal: tribunalSigla.toUpperCase(),
    vara: tribunalSigla.toUpperCase(),
    area: detectArea(classe + " " + assuntos),
    descricao: assuntos || classe || "Importado via Escavador",
    data_ajuizamento: item.data_ajuizamento?.slice(0, 10) || item.data_inicio?.slice(0, 10) || null,
    ultimo_andamento: ultimoAndamento,
    fonte: "escavador",
  };
}

// ── DataJud fallback ──────────────────────────────────────────────────────────

async function buscarPorOABTribunal(
  oabNumero: string,
  seccional: string,
  endpoint: string,
): Promise<Record<string, unknown>[]> {
  const variantes = [
    oabNumero,
    `${oabNumero}/${seccional}`,
    `${seccional}${oabNumero}`,
    `${seccional} ${oabNumero}`,
  ];

  const query = {
    bool: {
      should: variantes.flatMap(v => [
        { match: { "partes.advogados.inscricaoOab": v } },
        { match: { "partes.advogados.oab": v } },
        { wildcard: { "partes.advogados.inscricaoOab": { value: `*${oabNumero}*` } } },
      ]),
      minimum_should_match: 1,
    },
  };

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: DATAJUD_KEY },
      body: JSON.stringify({
        query,
        size: 50,
        sort: [{ dataAjuizamento: { order: "desc" } }],
        _source: [
          "numeroProcesso", "classe", "assuntos", "orgaoJulgador",
          "dataAjuizamento", "grau", "movimentos", "partes",
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      console.warn(`datajud ${endpoint} HTTP ${resp.status}`);
      return [];
    }

    const data = await resp.json() as Record<string, unknown>;
    const hits = ((data.hits as Record<string, unknown>)?.hits as Record<string, unknown>[]) || [];
    console.log(`datajud ${endpoint.split("api_publica_")[1]?.split("/")[0]}: ${hits.length} hits`);
    return hits;
  } catch (e) {
    console.warn(`datajud erro: ${e}`);
    return [];
  }
}

async function buscarPorNomeTribunal(
  nome: string,
  endpoint: string,
): Promise<Record<string, unknown>[]> {
  const query = {
    bool: {
      should: [
        { match: { "partes.nome": { query: nome, fuzziness: "AUTO" } } },
        { match: { "partes.advogados.nome": { query: nome, fuzziness: "AUTO" } } },
        { match_phrase_prefix: { "partes.nome": nome } },
      ],
      minimum_should_match: 1,
    },
  };

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: DATAJUD_KEY },
      body: JSON.stringify({
        query,
        size: 30,
        sort: [{ dataAjuizamento: { order: "desc" } }],
        _source: [
          "numeroProcesso", "classe", "assuntos", "orgaoJulgador",
          "dataAjuizamento", "grau", "movimentos", "partes",
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return [];
    const data = await resp.json() as Record<string, unknown>;
    return ((data.hits as Record<string, unknown>)?.hits as Record<string, unknown>[]) || [];
  } catch {
    return [];
  }
}

function normalizarHitDataJud(hit: Record<string, unknown>, trib: string) {
  const src = (hit._source || {}) as Record<string, unknown>;
  const movimentos = (src.movimentos as Record<string, unknown>[]) || [];
  const classe = ((src.classe as Record<string, unknown>)?.nome as string) || "";
  const assuntos = ((src.assuntos as { nome: string }[]) || []).map(a => a.nome).join(", ");
  const orgao = ((src.orgaoJulgador as Record<string, unknown>)?.nome as string) || "";
  const ultimoMov = movimentos[0]
    ? `${(movimentos[0].nome as string) || ""} — ${((movimentos[0].dataHora as string) || "").slice(0, 10)}`
    : "";

  return {
    numero: normalizeCNJ((src.numeroProcesso as string) || ""),
    tribunal: trib.toUpperCase(),
    vara: orgao,
    area: detectArea(classe + " " + assuntos),
    descricao: assuntos || classe || "Importado via DataJud/CNJ",
    data_ajuizamento: (src.dataAjuizamento as string)?.slice(0, 10) || null,
    ultimo_andamento: ultimoMov,
    fonte: "datajud_cnj",
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    let user: { id: string } | null = null;
    try {
      const r = await supabase.auth.getUser(token);
      user = r.data.user;
    } catch {
      user = null;
    }

    const body = await req.json().catch(() => ({}));
    const oabNumero: string = (body.oab_numero || "").replace(/\D/g, "");
    const seccional: string = (body.seccional || "AM").toUpperCase();
    const nomeAdvogado: string = (body.nome_advogado || "").trim();
    const userId: string = user?.id || (body.user_id as string) || "";

    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autenticado. Faça logout e login novamente." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!oabNumero) {
      return new Response(JSON.stringify({ error: "Número OAB obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`oab-sync: OAB=${oabNumero}/${seccional} nome="${nomeAdvogado}" user=${userId}`);

    // ── Fonte primária: Escavador ─────────────────────────────────────────────
    let processosNormalizados: ReturnType<typeof normalizarItemEscavador>[] = [];
    let fonte = "Escavador";

    const escavadorItems = await buscarProcessosEscavador(oabNumero, seccional);

    if (escavadorItems.length > 0) {
      processosNormalizados = escavadorItems
        .map(normalizarItemEscavador)
        .filter(p => p.numero);
      console.log(`escavador: ${processosNormalizados.length} processos normalizados`);
    } else if (nomeAdvogado && ESCAVADOR_TOKEN) {
      // Fallback por nome no Escavador
      const nomeItems = await buscarProcessosNomeEscavador(nomeAdvogado);
      if (nomeItems.length > 0) {
        processosNormalizados = nomeItems
          .map(normalizarItemEscavador)
          .filter(p => p.numero);
        console.log(`escavador por nome: ${processosNormalizados.length} processos`);
      }
    }

    // ── Fallback: DataJud/CNJ ─────────────────────────────────────────────────
    if (processosNormalizados.length === 0) {
      console.log("Escavador sem resultados — usando DataJud/CNJ como fallback");
      fonte = "DataJud/CNJ";

      const tribunais = OAB_ESTADO_TRIBUNAIS[seccional] || ["tjam", "trf1", "trt11"];
      const endpoints = tribunais.map(t => ({ trib: t, url: DATAJUD_ENDPOINTS[t] })).filter(e => e.url);

      const hitsRaw = (
        await Promise.all(
          endpoints.map(e => buscarPorOABTribunal(oabNumero, seccional, e.url).then(hits =>
            hits.map(h => ({ hit: h, trib: e.trib }))
          ))
        )
      ).flat();

      let hitsFinal = hitsRaw;
      if (hitsFinal.length === 0 && nomeAdvogado) {
        console.log(`DataJud fallback por nome: "${nomeAdvogado}"`);
        const hitsPorNome = (
          await Promise.all(
            endpoints.slice(0, 2).map(e => buscarPorNomeTribunal(nomeAdvogado, e.url).then(hits =>
              hits.map(h => ({ hit: h, trib: e.trib }))
            ))
          )
        ).flat();
        hitsFinal = hitsPorNome;
      }

      processosNormalizados = hitsFinal
        .map(({ hit, trib }) => normalizarHitDataJud(hit, trib))
        .filter(p => p.numero);
    }

    if (processosNormalizados.length === 0) {
      return new Response(JSON.stringify({
        sincronizados: 0, novos: 0, atualizados: 0,
        message: `Nenhum processo encontrado para OAB ${oabNumero}/${seccional}.`,
        fonte,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Salva no banco
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let novos = 0, atualizados = 0;
    const vistos = new Set<string>();

    for (const proc of processosNormalizados) {
      if (!proc.numero || vistos.has(proc.numero)) continue;
      vistos.add(proc.numero);

      const { data: existing } = await supabaseAdmin
        .from("processos")
        .select("id, ultimo_andamento")
        .eq("numero", proc.numero)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        const { error: insErr } = await supabaseAdmin.from("processos").insert({
          user_id: userId,
          ...proc,
          status: "ativo",
        });
        if (!insErr) novos++;
        else console.error(`insert erro ${proc.numero}:`, insErr.message);
      } else if (proc.ultimo_andamento && proc.ultimo_andamento !== existing.ultimo_andamento) {
        await supabaseAdmin.from("processos").update({
          ultimo_andamento: proc.ultimo_andamento,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);

        await supabaseAdmin.from("notificacoes").insert({
          user_id: userId,
          titulo: `Nova movimentação — ${proc.numero}`,
          mensagem: `${proc.ultimo_andamento} · ${proc.tribunal}`,
          tipo: "movimentacao",
          lida: false,
        });
        atualizados++;
      }

      // Monitoramento contínuo
      await supabaseAdmin.from("processo_monitoramento").upsert({
        user_id: userId,
        numero_processo: proc.numero,
        tribunal: proc.tribunal,
        ultimo_movimento: proc.ultimo_andamento,
        ultima_verificacao: new Date().toISOString(),
        ativo: true,
        oab_origem: `${oabNumero}/${seccional}`,
      }, { onConflict: "user_id,numero_processo" }).catch(() => null);
    }

    if (novos > 0) {
      await supabaseAdmin.from("notificacoes").insert({
        user_id: userId,
        titulo: "Horus — Sincronização concluída",
        mensagem: `${novos} processo(s) novo(s) via ${fonte}.`,
        tipo: "sistema",
        lida: false,
      });
    }

    return new Response(JSON.stringify({
      sincronizados: vistos.size,
      novos,
      atualizados,
      fonte,
      message: novos === 0 && atualizados === 0
        ? `Todos os ${vistos.size} processo(s) já estão atualizados.`
        : `${novos} novo(s) + ${atualizados} atualizado(s) de ${vistos.size} processos encontrados.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("oab-sync error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
