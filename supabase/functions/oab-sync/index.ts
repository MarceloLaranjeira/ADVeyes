import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_KEY = Deno.env.get("DATAJUD_API_KEY") ?? "";
if (!DATAJUD_KEY) {
  console.error("DATAJUD_API_KEY secret not configured");
}

// Tribunais por seccional — prioriza os mais relevantes para cada estado
const TRIBUNAIS_POR_SECCIONAL: Record<string, string[]> = {
  AC: ["tjac", "trf1", "tst", "stj"],
  AL: ["tjal", "trf5", "tst", "stj"],
  AM: ["tjam", "trf1", "tst", "stj"],
  AP: ["tjap", "trf1", "tst", "stj"],
  BA: ["tjba", "trf1", "tst", "stj"],
  CE: ["tjce", "trf5", "tst", "stj"],
  DF: ["tjdft", "trf1", "tst", "stj"],
  ES: ["tjes", "trf2", "tst", "stj"],
  GO: ["tjgo", "trf1", "tst", "stj"],
  MA: ["tjma", "trf1", "tst", "stj"],
  MG: ["tjmg", "trf1", "tst", "stj"],
  MS: ["tjms", "trf3", "tst", "stj"],
  MT: ["tjmt", "trf1", "tst", "stj"],
  PA: ["tjpa", "trf1", "tst", "stj"],
  PB: ["tjpb", "trf5", "tst", "stj"],
  PE: ["tjpe", "trf5", "tst", "stj"],
  PI: ["tjpi", "trf1", "tst", "stj"],
  PR: ["tjpr", "trf4", "tst", "stj"],
  RJ: ["tjrj", "trf2", "tst", "stj"],
  RN: ["tjrn", "trf5", "tst", "stj"],
  RO: ["tjro", "trf1", "tst", "stj"],
  RR: ["tjrr", "trf1", "tst", "stj"],
  RS: ["tjrs", "trf4", "tst", "stj"],
  SC: ["tjsc", "trf4", "tst", "stj"],
  SE: ["tjse", "trf5", "tst", "stj"],
  SP: ["tjsp", "trf3", "tst", "stj"],
  TO: ["tjto", "trf1", "tst", "stj"],
};

const getEndpoint = (t: string) =>
  `https://api-publica.datajud.cnj.jus.br/api_publica_${t.toLowerCase()}/_search`;

async function fetchWithRetry(endpoint: string, body: object, apiKey: string, maxRetries = 2): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (resp.status === 429 && attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!resp.ok) return null;
    return await resp.json();
  }
  return null;
}

async function fetchAllPages(endpoint: string, baseBody: object, apiKey: string): Promise<any[]> {
  const hits: any[] = [];
  let searchAfter: any[] | undefined;
  const body: any = { ...baseBody, size: 100, sort: [{ dataAjuizamento: { order: "desc" } }, { _id: { order: "asc" } }] };

  while (true) {
    if (searchAfter) body.search_after = searchAfter;
    const data = await fetchWithRetry(endpoint, body, apiKey);
    const page: any[] = data?.hits?.hits ?? [];
    hits.push(...page);
    if (page.length < 100) break;
    const last = page[page.length - 1];
    searchAfter = last.sort;
    if (!searchAfter) break;
  }
  return hits;
}

function normalizeCNJ(numero: string): string {
  const d = numero.replace(/\D/g, "");
  if (d.length === 20) {
    return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
  }
  return numero.trim();
}

function detectArea(classes: string[], assuntos: string[]): string {
  const all = [...classes, ...assuntos].join(" ").toLowerCase();
  if (all.includes("criminal") || all.includes("penal") || all.includes("tráfico") || all.includes("homicídio")) return "penal";
  if (all.includes("trabalhista") || all.includes("emprego") || all.includes("rescisão") || all.includes("trt")) return "trabalhista";
  if (all.includes("família") || all.includes("divórcio") || all.includes("alimentos") || all.includes("guarda")) return "familia";
  if (all.includes("execução") || all.includes("cumprimento") || all.includes("penhora")) return "execucao";
  if (all.includes("recurso") || all.includes("apelação") || all.includes("agravo")) return "recurso";
  if (all.includes("administrativo") || all.includes("federal") || all.includes("previdenc")) return "administrativo";
  if (all.includes("consumidor") || all.includes("indenização") || all.includes("dano")) return "civel";
  return "civel";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth via JWT (verify_jwt: false — validamos aqui)
    const authHeader = req.headers.get("Authorization") || "";
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
    const oabNumero: string = (body.oab_numero || "").replace(/\D/g, "");
    const seccional: string = (body.seccional || "AM").toUpperCase();
    const modo: string = body.modo || "sync"; // "sync" | "monitor-check"

    if (!oabNumero) {
      return new Response(JSON.stringify({ error: "Número OAB obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tribunais = TRIBUNAIS_POR_SECCIONAL[seccional] || TRIBUNAIS_POR_SECCIONAL["AM"];
    const processosEncontrados: Record<string, any>[] = [];
    const erros: string[] = [];

    // Busca paralela nos tribunais (máx 4 simultâneos, timeout 8s cada)
    const MAX_PARALLEL = 4;
    for (let i = 0; i < tribunais.length; i += MAX_PARALLEL) {
      const batch = tribunais.slice(i, i + MAX_PARALLEL);
      const results = await Promise.all(batch.map(async (trib) => {
        try {
          const hits = await fetchAllPages(getEndpoint(trib), {
            query: {
              query_string: {
                query: oabNumero,
                fields: [
                  "partes.advogados.inscricaoOab",
                  "partes.advogados.oab",
                  "advogados.inscricaoOab",
                  "advogados.oab",
                  "representantePartes.inscricaoOab",
                ],
                lenient: true,
                default_operator: "AND",
              },
            },
          }, DATAJUD_KEY);
          return hits.map((h: any) => ({ ...h._source, _tribunal: trib }));
        } catch {
          erros.push(trib);
          return [];
        }
      }));
      processosEncontrados.push(...results.flat());
    }

    if (processosEncontrados.length === 0) {
      return new Response(JSON.stringify({
        sincronizados: 0,
        novos: 0,
        atualizados: 0,
        message: `Nenhum processo encontrado para OAB ${oabNumero}/${seccional} nos tribunais consultados.`,
        tribunais_com_erro: erros,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduplicar por número CNJ
    const vistos = new Set<string>();
    const unicos = processosEncontrados.filter((p) => {
      const key = (p.numeroProcesso || p.id || "").replace(/\D/g, "");
      if (!key || vistos.has(key)) return false;
      vistos.add(key);
      return true;
    });

    let novos = 0;
    let atualizados = 0;

    // Usar service_role para upsert (via supabase service)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    for (const proc of unicos) {
      const numero = normalizeCNJ(proc.numeroProcesso || "");
      if (!numero) continue;

      const tribunal = proc._tribunal?.toUpperCase() || seccional;
      const classe = proc.classe?.nome || proc.classeProcessual || "";
      const assuntos = (proc.assuntos || []).map((a: any) => a.nome || a).filter(Boolean);
      const area = detectArea([classe], assuntos);
      const ultimoMovimento = proc.movimentos?.[0]?.nome || "";
      const dataAjuizamento = proc.dataAjuizamento?.slice(0, 10) || null;

      // Dados do cliente (parte contrária ou nome genérico)
      const partes = proc.partes || [];
      const parteAtiva = partes.find((p: any) =>
        (p.tipoParte || "").toLowerCase().includes("ativo") ||
        (p.tipoParte || "").toLowerCase().includes("autor")
      );
      const nomeCliente = parteAtiva?.nome || partes[0]?.nome || "Cliente via OAB";

      // Upsert na tabela processos
      const { error: upsertErr, data: existing } = await supabaseAdmin
        .from("processos")
        .select("id, ultimo_andamento")
        .eq("numero", numero)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        // Novo processo
        const { error: insertErr } = await supabaseAdmin.from("processos").insert({
          user_id: user.id,
          numero,
          tribunal,
          vara: proc.orgaoJulgador?.nome || "",
          area,
          status: "ativo",
          descricao: assuntos.join(", ") || classe,
          data_ajuizamento: dataAjuizamento,
          ultimo_andamento: ultimoMovimento,
          fonte: "datajud_oab_sync",
        });
        if (!insertErr) novos++;
      } else if (ultimoMovimento && ultimoMovimento !== existing.ultimo_andamento) {
        // Processo existente com nova movimentação
        await supabaseAdmin.from("processos").update({
          ultimo_andamento: ultimoMovimento,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);

        // Notificação Jarvis
        await supabaseAdmin.from("notificacoes").insert({
          user_id: user.id,
          titulo: `Nova movimentação — ${numero}`,
          mensagem: `${ultimoMovimento} · ${tribunal}`,
          tipo: "movimentacao",
          lida: false,
        });
        atualizados++;
      }

      // Garantir entrada no monitoramento contínuo
      await supabaseAdmin.from("processo_monitoramento").upsert({
        user_id: user.id,
        numero_processo: numero,
        tribunal: tribunal.toLowerCase(),
        ultimo_movimento: ultimoMovimento,
        ultima_verificacao: new Date().toISOString(),
        ativo: true,
        oab_origem: `${oabNumero}/${seccional}`,
      }, { onConflict: "user_id,numero_processo" }).catch(() => null);
    }

    // Notificação de conclusão do sync
    if (novos > 0 || atualizados > 0) {
      await supabaseAdmin.from("notificacoes").insert({
        user_id: user.id,
        titulo: "ADVeyes — Sincronização OAB concluída",
        mensagem: `${novos} processo(s) novo(s) e ${atualizados} atualizado(s) para OAB ${oabNumero}/${seccional}.`,
        tipo: "sistema",
        lida: false,
      });
    }

    return new Response(JSON.stringify({
      sincronizados: unicos.length,
      novos,
      atualizados,
      tribunais_consultados: tribunais,
      tribunais_com_erro: erros,
      message: novos === 0 && atualizados === 0
        ? "Todos os processos já estão atualizados."
        : `${novos} novo(s) + ${atualizados} atualizado(s) de ${unicos.length} processos encontrados.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("oab-sync error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
