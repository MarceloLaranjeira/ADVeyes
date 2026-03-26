import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESCAVADOR_TOKEN = Deno.env.get("ESCAVADOR_API_TOKEN") ?? "";
const ESC_HEADERS = {
  "Authorization": `Bearer ${ESCAVADOR_TOKEN}`,
  "X-Requested-With": "XMLHttpRequest",
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

async function escGet(url: string): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await fetch(url, {
        headers: ESC_HEADERS,
        signal: AbortSignal.timeout(20000),
      });
      if (resp.status === 429) { await new Promise(r => setTimeout(r, 2000 * (i + 1))); continue; }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error(`escavador GET ${url} → ${resp.status}: ${txt.slice(0, 200)}`);
        return null;
      }
      return await resp.json() as Record<string, unknown>;
    } catch (e) {
      console.error(`escavador fetch attempt ${i}:`, e);
      if (i === 2) return null;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

/** Busca todos os processos de um advogado pela OAB usando a API V2 */
async function buscarProcessosPorOAB(oab: string, seccional: string): Promise<Record<string, unknown>[]> {
  const processos: Record<string, unknown>[] = [];
  
  // Endpoint correto da V2 para busca por OAB
  let url: string | null =
    `https://api.escavador.com/api/v2/advogado/processos?oab_numero=${encodeURIComponent(oab)}&oab_estado=${encodeURIComponent(seccional)}&limit=100`;

  let paginas = 0;
  while (url && paginas < 20) {
    const data = await escGet(url);
    if (!data) break;

    // A resposta tem os processos dentro de data.items
    const items = (data.items as Record<string, unknown>[]) || [];
    processos.push(...items);
    console.log(`escavador v2 oab: página ${++paginas} → ${items.length} processos`);

    // Seguir próxima página via links.next
    const next = (data.links as Record<string, unknown>)?.next as string | null;
    url = next && next !== url ? next : null;

    if (items.length < 100) break; // última página
    await new Promise(r => setTimeout(r, 300));
  }

  return processos;
}

/** Busca todos os processos de um envolvido pelo nome usando a API V2 */
async function buscarProcessosPorNome(nome: string): Promise<Record<string, unknown>[]> {
  const processos: Record<string, unknown>[] = [];
  
  // Endpoint correto da V2 para busca por nome
  let url: string | null =
    `https://api.escavador.com/api/v2/envolvido/processos?nome=${encodeURIComponent(nome)}&limit=100`;

  let paginas = 0;
  while (url && paginas < 20) {
    const data = await escGet(url);
    if (!data) break;

    const items = (data.items as Record<string, unknown>[]) || [];
    processos.push(...items);
    console.log(`escavador v2 nome: página ${++paginas} → ${items.length} processos`);

    // Seguir próxima página via links.next
    const next = (data.links as Record<string, unknown>)?.next as string | null;
    url = next && next !== url ? next : null;

    if (items.length < 100) break; // última página
    await new Promise(r => setTimeout(r, 300));
  }

  return processos;
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

    const { data: { user } } = await supabase.auth.getUser(token);

    const body = await req.json().catch(() => ({}));
    const oabNumero: string = (body.oab_numero || "").replace(/\D/g, "");
    const seccional: string = (body.seccional || "AM").toUpperCase();
    const nomeAdvogado: string = (body.nome_advogado || "").trim();

    // Aceita user_id do body como fallback (sessão expirada ou anon token)
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
    if (!ESCAVADOR_TOKEN) {
      return new Response(JSON.stringify({ error: "ESCAVADOR_API_TOKEN não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`oab-sync: OAB=${oabNumero}/${seccional} nome_recebido="${nomeAdvogado}" user=${userId}`);

    // ── 1. Tenta buscar processos diretamente pela OAB na API V2 ───────────────
    let processosRaw = await buscarProcessosPorOAB(oabNumero, seccional);
    console.log(`escavador por OAB: total bruto = ${processosRaw.length}`);

    // ── 2. Fallback: Se não encontrou por OAB, tenta por nome ─────────────────
    if (processosRaw.length === 0 && nomeAdvogado) {
      console.log(`oab-sync: Nenhum processo encontrado por OAB. Tentando por nome: "${nomeAdvogado}"`);
      processosRaw = await buscarProcessosPorNome(nomeAdvogado);
      console.log(`escavador por nome: total bruto = ${processosRaw.length}`);
    }

    if (processosRaw.length === 0) {
      return new Response(JSON.stringify({
        sincronizados: 0, novos: 0, atualizados: 0,
        message: `Nenhum processo encontrado para OAB ${oabNumero}/${seccional}${nomeAdvogado ? ` ou nome "${nomeAdvogado}"` : ""} no Escavador.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── 3. Salva no banco ─────────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let novos = 0, atualizados = 0;
    const vistos = new Set<string>();

    for (const proc of processosRaw) {
      const numero = normalizeCNJ((proc.numero_cnj as string) || "");
      if (!numero || vistos.has(numero)) continue;
      vistos.add(numero);

      // Tribunal — vem de unidade_origem.tribunal_sigla ou estado_origem
      const unidade = proc.unidade_origem as Record<string, unknown> | undefined;
      const tribunal = ((unidade?.tribunal_sigla as string) ||
        (proc.estado_origem as Record<string, unknown>)?.sigla as string ||
        "").toUpperCase();

      const vara = (unidade?.nome as string) || "";
      const dataAj = (proc.data_inicio as string)?.slice(0, 10) || null;

      // Detalhes vêm em fontes[]
      const fontes = (proc.fontes as Record<string, unknown>[]) || [];
      const fonte0 = fontes[0] || {};
      const classe = (fonte0.classe as string) || "";
      const assunto = (fonte0.assunto as string) ||
        ((fonte0.assuntos_normalizados as string[]) || []).join(", ") || "";
      const area = detectArea(classe + " " + assunto);

      // Última movimentação
      const ultimoMov = (proc.data_ultima_movimentacao as string)
        ? `Atualizado em ${(proc.data_ultima_movimentacao as string).slice(0, 10)}`
        : "";

      // Verifica existência
      const { data: existing } = await supabaseAdmin
        .from("processos")
        .select("id, ultimo_andamento")
        .eq("numero", numero)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        const { error: insErr } = await supabaseAdmin.from("processos").insert({
          user_id: userId,
          numero,
          tribunal,
          vara,
          area,
          status: "ativo",
          descricao: assunto || classe || "Importado via Escavador",
          data_ajuizamento: dataAj,
          ultimo_andamento: ultimoMov,
          fonte: "escavador_v2",
        });
        if (!insErr) novos++;
        else console.error(`insert erro ${numero}:`, insErr.message);
      } else if (ultimoMov && ultimoMov !== existing.ultimo_andamento) {
        await supabaseAdmin.from("processos").update({
          ultimo_andamento: ultimoMov,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);

        await supabaseAdmin.from("notificacoes").insert({
          user_id: userId,
          titulo: `Nova movimentação — ${numero}`,
          mensagem: `${ultimoMov} · ${tribunal}`,
          tipo: "movimentacao",
          lida: false,
        });
        atualizados++;
      }

      // Monitoramento contínuo
      await supabaseAdmin.from("processo_monitoramento").upsert({
        user_id: userId,
        numero_processo: numero,
        tribunal: tribunal.toLowerCase(),
        ultimo_movimento: ultimoMov,
        ultima_verificacao: new Date().toISOString(),
        ativo: true,
        oab_origem: `${oabNumero}/${seccional}`,
      }, { onConflict: "user_id,numero_processo" }).catch(() => null);
    }

    // Notificação de conclusão
    if (novos > 0) {
      await supabaseAdmin.from("notificacoes").insert({
        user_id: userId,
        titulo: "🦅 Horus — Descoberta concluída",
        mensagem: `${novos} processo(s) novo(s) encontrado(s).`,
        tipo: "sistema",
        lida: false,
      });
    }

    return new Response(JSON.stringify({
      sincronizados: vistos.size,
      novos,
      atualizados,
      advogado: nomeAdvogado,
      message: novos === 0 && atualizados === 0
        ? "Todos os processos já estão atualizados."
        : `${novos} novo(s) + ${atualizados} atualizado(s) de ${vistos.size} processos encontrados.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("oab-sync error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
