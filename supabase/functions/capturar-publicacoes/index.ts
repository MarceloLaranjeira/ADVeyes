import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDataJudAuthorization } from "../_shared/datajud-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Escavador — fonte primária para DJe e publicações
const ESCAVADOR_TOKEN = Deno.env.get("ESCAVADOR_API_TOKEN") ?? "";
const ESC_BASE = "https://api.escavador.com";
const ESC_HEADERS = {
  "Authorization": `Bearer ${ESCAVADOR_TOKEN}`,
  "X-Requested-With": "XMLHttpRequest",
  "Accept": "application/json",
};

// DataJud — fallback gratuito
const DATAJUD_KEY = getDataJudAuthorization();

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
  stf: "https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
  stj: "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
  tst: "https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search",
  trf1: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
  trf2: "https://api-publica.datajud.cnj.jus.br/api_publica_trf2/_search",
  trf3: "https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search",
  trf4: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  trf5: "https://api-publica.datajud.cnj.jus.br/api_publica_trf5/_search",
};

function normalizeCNJ(numero: string): string {
  const digits = numero.replace(/\D/g, "");
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`;
  }
  return numero.trim();
}

function detectTribunalFromCNJ(numero: string): string {
  const clean = numero.replace(/\s/g, "");
  const match = clean.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return "tjam";
  const j = parseInt(match[1]);
  const tt = parseInt(match[2]);
  if (j === 1) return "stf";
  if (j === 3) return "stj";
  if (j === 4 && tt >= 1 && tt <= 6) return `trf${tt}`;
  if ((j === 5 || j === 6) && tt >= 1 && tt <= 24) return `trt${tt}`;
  if (j === 7) return "tse";
  if (j === 8) {
    const m: Record<number, string> = {
      1: "tjac", 2: "tjal", 3: "tjap", 4: "tjam", 5: "tjba", 6: "tjce",
      7: "tjdft", 8: "tjes", 9: "tjgo", 10: "tjma", 11: "tjmg", 12: "tjms",
      13: "tjmt", 14: "tjpa", 15: "tjpb", 16: "tjpe", 17: "tjpi", 18: "tjpr",
      19: "tjrj", 20: "tjrn", 21: "tjro", 22: "tjrr", 23: "tjrs", 24: "tjsc",
      25: "tjse", 26: "tjsp", 27: "tjto",
    };
    return m[tt] || "tjam";
  }
  return "tjam";
}

/** Classifica o nome do movimento DataJud → tipo de publicação */
function classifyMovimento(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("sentença") || n.includes("sentenca")) return "sentenca";
  if (n.includes("acórdão") || n.includes("acordao")) return "acordao";
  if (n.includes("edital")) return "edital";
  if (n.includes("despacho")) return "despacho";
  if (
    n.includes("intimação") ||
    n.includes("intimacao") ||
    n.includes("intimar") ||
    n.includes("cite-se") ||
    n.includes("citação")
  )
    return "intimacao";
  return "despacho";
}

/** Extrai prazo em dias do nome do movimento */
function extractPrazoDias(nome: string, complementos: string): number | null {
  const text = `${nome} ${complementos}`.toLowerCase();
  const patterns = [
    /(\d+)\s*dias?\s*út[ei][si]/,
    /prazo\s+de\s+(\d+)\s*dias?/,
    /(\d+)\s*dias?\s*para/,
    /no\s+prazo\s+de\s+(\d+)/,
    /(\d+)\s*dias?/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1]);
  }
  // Defaults by type
  if (text.includes("sentença") || text.includes("acórdão")) return 15;
  if (text.includes("intimação") || text.includes("despacho")) return 15;
  return null;
}

/** Monta o texto da publicação a partir dos dados DataJud */
function buildConteudo(
  hit: Record<string, unknown>,
  mov: Record<string, unknown>,
  orgao: string,
  tribunal: string,
  numero: string
): string {
  const complementos =
    (mov.complementosTabelados as { nome: string; valor: string }[])
      ?.map((c) => `${c.nome}: ${c.valor}`)
      .join("; ") || "";

  const classe = (hit.classe as Record<string, unknown>)?.nome || hit.classeProcessual || "";
  const assuntos =
    (hit.assuntos as { nome: string }[])?.map((a) => a.nome).join(", ") || "";

  const dataFormatada = mov.dataHora
    ? new Date(mov.dataHora as string).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("pt-BR");

  let texto = `${(mov.nome as string).toUpperCase()} — ${orgao}`;
  if (classe) texto += ` — ${classe}`;
  texto += `\nProcesso nº ${numero}`;
  if (assuntos) texto += ` — Assunto: ${assuntos}`;
  texto += `.`;
  if (complementos) texto += `\n${complementos}.`;
  texto += `\nData da movimentação: ${dataFormatada}.`;
  texto += `\n\n[Dados obtidos via API pública DataJud/CNJ — ${tribunal.toUpperCase()}]`;

  return texto;
}

// ── Escavador DJe ─────────────────────────────────────────────────────────────

interface EscavadorDiario {
  id?: number;
  tipo?: string;
  data_publicacao?: string;
  conteudo?: string;
  conteudo_simplificado?: string;
  numero_processo?: string;
  tribunal?: { sigla?: string; nome?: string };
  vara?: string;
  prazo?: number;
}

/** Busca publicações do DJe via Escavador para um advogado */
async function buscarDiariosEscavador(
  oabNumero: string,
  seccional: string,
  paginas = 3,
): Promise<EscavadorDiario[]> {
  if (!ESCAVADOR_TOKEN) return [];

  const items: EscavadorDiario[] = [];

  for (let page = 1; page <= paginas; page++) {
    try {
      const url = `${ESC_BASE}/api/v2/advogado/diarios?oab_numero=${oabNumero}&oab_estado=${seccional}&page=${page}`;
      const resp = await fetch(url, {
        headers: ESC_HEADERS,
        signal: AbortSignal.timeout(12000),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.warn(`[capturar] escavador diários HTTP ${resp.status}: ${txt.slice(0, 200)}`);
        break;
      }

      const data = await resp.json() as { items?: EscavadorDiario[]; meta?: { last_page?: number } };
      const page_items = data.items || [];
      items.push(...page_items);
      console.log(`[capturar] escavador diários página ${page}: ${page_items.length} itens`);

      // Parar se chegou na última página
      const lastPage = data.meta?.last_page || 1;
      if (page >= lastPage) break;
    } catch (e) {
      console.warn(`[capturar] escavador diários erro: ${e}`);
      break;
    }
  }

  return items;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ler corpo da requisição
    const body = await req.json().catch(() => ({}));

    // ─── MODO BUSCA: por OAB / CPF / Nome (via DataJud/DJe) ───────────────────
    if (body.busca) {
      console.log("[busca] iniciando", JSON.stringify(body.busca));

      const busca = body.busca as Record<string, unknown>;
      const tipo = (busca.tipo as string) || "oab";
      const valor = ((busca.valor as string) || "").trim();
      const tribList = busca.tribunais as string[] | undefined;
      const salvar = busca.salvar === true;

      if (!valor) {
        return new Response(JSON.stringify({ error: "Informe um valor para busca" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Detectar tribunal pelo estado da OAB (ex: 12345/AM → tjam)
      const estadoMatch = tipo === "oab" ? valor.match(/\/\s*([A-Z]{2})\s*$/i) : null;
      const estadoOAB = estadoMatch ? estadoMatch[1].toLowerCase() : "";
      const estadoParaTribunal: Record<string, string> = {
        ac: "tjac", al: "tjal", ap: "tjap", am: "tjam", ba: "tjba",
        ce: "tjce", df: "tjdft", es: "tjes", go: "tjgo", ma: "tjma",
        mg: "tjmg", ms: "tjms", mt: "tjmt", pa: "tjpa", pb: "tjpb",
        pe: "tjpe", pi: "tjpi", pr: "tjpr", rj: "tjrj", rn: "tjrn",
        ro: "tjro", rr: "tjrr", rs: "tjrs", sc: "tjsc", se: "tjse",
        sp: "tjsp", to: "tjto",
      };
      const trfMap: Record<string, string> = {
        am: "trf1", pa: "trf1", ma: "trf1", ap: "trf1", rr: "trf1", ro: "trf1", to: "trf1", ac: "trf1",
        ba: "trf1", go: "trf1", mt: "trf1", mg: "trf1", df: "trf1", pi: "trf1",
        rj: "trf2", es: "trf2", sp: "trf3", ms: "trf3",
        rs: "trf4", sc: "trf4", pr: "trf4",
        pe: "trf5", ce: "trf5", al: "trf5", rn: "trf5", pb: "trf5", se: "trf5",
      };

      let defaultTribs: string[];
      if (estadoOAB && estadoParaTribunal[estadoOAB]) {
        const tEstado = estadoParaTribunal[estadoOAB];
        const trf = trfMap[estadoOAB] || "trf1";
        // Deduplicar: se tEstado === trf, só usa um
        defaultTribs = [...new Set([tEstado, trf, "stj"])];
      } else {
        defaultTribs = ["tjam", "trf1", "stj"];
      }
      const tribunaisParaBuscar = (tribList && tribList.length > 0 ? tribList : defaultTribs).slice(0, 3);
      console.log("[busca] tribunais:", tribunaisParaBuscar.join(","));

      // ── Query Elasticsearch — usa apenas query_string (sem nested) ────────────
      // query_string é o mais seguro: não exige conhecer o mapping e lenient:true
      // ignora erros de tipo. Funciona com qualquer estrutura de campos.
      let esQuery: Record<string, unknown>;
      if (tipo === "oab") {
        const oabNumero = valor.replace(/[^0-9]/g, "");
        console.log("[busca] OAB número:", oabNumero);
        esQuery = {
          query_string: {
            query: oabNumero,
            fields: [
              "partes.advogados.inscricaoOab",
              "partes.advogados.oab",
              "advogados.inscricaoOab",
              "advogados.oab",
            ],
            lenient: true,
            default_operator: "AND",
          },
        };
      } else if (tipo === "cpf") {
        const cpfLimpo = valor.replace(/\D/g, "");
        esQuery = {
          query_string: {
            query: cpfLimpo,
            fields: ["partes.cpf", "advogados.cpf", "partes.documento"],
            lenient: true,
            default_operator: "AND",
          },
        };
      } else {
        esQuery = {
          multi_match: {
            query: valor,
            fields: ["partes.nome", "advogados.nome"],
            type: "best_fields",
            fuzziness: "AUTO",
          },
        };
      }

      // ── Busca paralela com timeout individual ─────────────────────────────────
      const SOURCE_FIELDS = ["numeroProcesso", "classe", "assuntos", "orgaoJulgador", "movimentos", "partes", "dataAjuizamento"];

      // rawSources: guarda dados completos para salvar depois, indexado por numeroProcesso
      const rawSources: Record<string, { src: Record<string, unknown>; trib: string }> = {};

      const searchResults = await Promise.all(
        tribunaisParaBuscar.map(async (trib) => {
          const endpoint = DATAJUD_ENDPOINTS[trib];
          if (!endpoint) return [] as Record<string, unknown>[];
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 6000);
          try {
            const resp = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: DATAJUD_KEY },
              body: JSON.stringify({ query: esQuery, size: 10, _source: SOURCE_FIELDS }),
              signal: controller.signal,
            });
            clearTimeout(tid);
            if (!resp.ok) {
              const errBody = await resp.text().catch(() => "");
              console.error(`[busca] ${trib} HTTP ${resp.status}:`, errBody.slice(0, 200));
              return [] as Record<string, unknown>[];
            }
            const data = await resp.json() as Record<string, unknown>;
            const hits = ((data.hits as Record<string, unknown>)?.hits as Record<string, unknown>[]) || [];
            console.log(`[busca] ${trib}: ${hits.length} hits`);
            return hits.map((hit) => {
              const src = (hit._source || {}) as Record<string, unknown>;
              const movimentos = (src.movimentos as Record<string, unknown>[]) || [];
              const numProc = (src.numeroProcesso as string) || "";
              // Guardar raw para save posterior
              if (numProc) rawSources[numProc] = { src, trib };
              return {
                tribunal: trib.toUpperCase(),
                numero_processo: numProc,
                classe: ((src.classe as Record<string, unknown>)?.nome as string) || "",
                assuntos: ((src.assuntos as { nome: string }[]) || []).map((a) => a.nome).join(", "),
                orgao: ((src.orgaoJulgador as Record<string, unknown>)?.nome as string) || trib.toUpperCase(),
                data_ajuizamento: (src.dataAjuizamento as string) || null,
                partes: ((src.partes as { nome: string; tipo: string }[]) || []).slice(0, 4),
                ultimos_movimentos: movimentos.slice(0, 3).map((m) => ({
                  nome: m.nome as string,
                  data: m.dataHora as string,
                  tipo: classifyMovimento((m.nome as string) || ""),
                })),
              } as Record<string, unknown>;
            });
          } catch (e) {
            clearTimeout(tid);
            console.error(`[busca] ${trib} erro:`, String(e));
            return [] as Record<string, unknown>[];
          }
        })
      );

      const resultados = searchResults.flat();
      console.log("[busca] total resultados:", resultados.length);

      // ── Salvar publicações encontradas no banco (integração DJe) ────────────
      let publicacoesSalvas = 0;
      if (salvar && resultados.length > 0) {
        try {
          const inserir: Record<string, unknown>[] = [];
          const { data: existentes } = await supabase
            .from("publicacoes")
            .select("numero_processo, conteudo")
            .eq("user_id", user.id);
          const existentesSet = new Set(
            (existentes || []).map((e: { numero_processo: string; conteudo?: string }) =>
              `${e.numero_processo}::${(e.conteudo || "").slice(0, 80)}`
            )
          );
          for (const r of resultados) {
            const numProc = r.numero_processo as string;
            const raw = rawSources[numProc];
            if (!raw) continue;
            const { src, trib } = raw;
            const orgao = ((src.orgaoJulgador as Record<string, unknown>)?.nome as string) || trib.toUpperCase();
            const movimentos = (src.movimentos as Record<string, unknown>[]) || [];
            for (const mov of movimentos.slice(0, 3)) {
              const conteudo = buildConteudo(src, mov, orgao, trib, numProc);
              const chave = `${numProc}::${conteudo.slice(0, 80)}`;
              if (existentesSet.has(chave)) continue;
              existentesSet.add(chave);
              const tipoMov = classifyMovimento((mov.nome as string) || "");
              const complementosText = ((mov.complementosTabelados as { nome: string; valor: string }[]) || [])
                .map((c) => `${c.nome}: ${c.valor}`).join("; ");
              const prazo = extractPrazoDias((mov.nome as string) || "", complementosText);
              inserir.push({
                user_id: user.id,
                tipo: tipoMov,
                tribunal: trib.toUpperCase(),
                numero_processo: numProc,
                cliente_nome: null,
                data_publicacao: (mov.dataHora as string) || new Date().toISOString(),
                conteudo,
                conteudo_simplificado: null,
                status: prazo !== null && prazo <= 5 ? "urgente" : "nova",
                prazo_dias: prazo,
                data_prazo: prazo ? new Date(Date.now() + prazo * 24 * 60 * 60 * 1000).toISOString() : null,
                tarefa_gerada: false,
              });
            }
          }
          if (inserir.length > 0) {
            const { error: insertErr } = await supabase.from("publicacoes").insert(inserir);
            if (!insertErr) publicacoesSalvas = inserir.length;
            else console.error("[busca] insert error:", insertErr.message);
          }
        } catch (saveErr) {
          console.error("[busca] save error:", String(saveErr));
        }
      }

      return new Response(
        JSON.stringify({ resultados, total: resultados.length, publicacoesSalvas }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ─── FIM MODO BUSCA ────────────────────────────────────────────────────────

    // OAB do advogado (opcional — ativa Escavador DJe se fornecido)
    const oabNumero: string = ((body.oab_numero as string) || "").replace(/\D/g, "");
    const seccional: string = ((body.seccional as string) || "AM").toUpperCase();

    // Buscar processos cadastrados do usuário
    const { data: processos, error: procError } = await supabase
      .from("processos")
      .select("numero, cliente_nome, vara")
      .eq("user_id", user.id)
      .neq("status", "Arquivado");

    if (procError) {
      return new Response(
        JSON.stringify({ error: procError.message, capturadas: 0, processosBuscados: 0 }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!processos || processos.length === 0) {
      return new Response(
        JSON.stringify({
          capturadas: 0,
          processosBuscados: 0,
          message:
            "Nenhum processo cadastrado. Cadastre processos no módulo Processos para capturar publicações reais.",
          novos: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar publicações existentes para evitar duplicatas
    const { data: existentes } = await supabase
      .from("publicacoes")
      .select("numero_processo, conteudo")
      .eq("user_id", user.id);

    const existentesSet = new Set(
      (existentes || []).map(
        (e: { numero_processo: string; conteudo?: string }) => `${e.numero_processo}::${e.conteudo?.slice(0, 80)}`
      )
    );

    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - 30); // últimos 30 dias

    const inserir: Record<string, unknown>[] = [];
    const erros: string[] = [];
    let processosBuscados = 0;
    const fonteUsada: string[] = [];

    // ── Escavador DJe — publicações do diário (primária) ──────────────────────
    if (oabNumero && ESCAVADOR_TOKEN) {
      console.log(`[capturar] buscando DJe via Escavador para OAB ${oabNumero}/${seccional}`);
      const diarios = await buscarDiariosEscavador(oabNumero, seccional);
      console.log(`[capturar] escavador DJe: ${diarios.length} publicações`);

      for (const diario of diarios) {
        // Filtrar apenas publicações dos últimos 30 dias
        if (diario.data_publicacao) {
          const dataPub = new Date(diario.data_publicacao);
          if (dataPub < limiteData) continue;
        }

        const numProc = diario.numero_processo || "";
        const tribunalSigla = diario.tribunal?.sigla || seccional;
        const tipoPubl = (diario.tipo || "despacho").toLowerCase();
        const conteudo = diario.conteudo || diario.conteudo_simplificado || `${tipoPubl.toUpperCase()} — ${numProc}`;
        const chave = `${numProc}::${conteudo.slice(0, 80)}`;

        if (existentesSet.has(chave)) continue;
        existentesSet.add(chave);

        const prazo = diario.prazo || null;
        inserir.push({
          user_id: user.id,
          tipo: tipoPubl,
          tribunal: tribunalSigla.toUpperCase(),
          numero_processo: numProc,
          cliente_nome: null,
          data_publicacao: diario.data_publicacao || new Date().toISOString(),
          conteudo,
          conteudo_simplificado: diario.conteudo_simplificado || null,
          status: prazo !== null && prazo <= 5 ? "urgente" : "nova",
          prazo_dias: prazo,
          data_prazo: prazo ? new Date(Date.now() + prazo * 24 * 60 * 60 * 1000).toISOString() : null,
          tarefa_gerada: false,
        });
      }

      if (inserir.length > 0) fonteUsada.push("Escavador DJe");
      processosBuscados = processos.length;
    }

    // DataJud fallback — só roda se Escavador não trouxe publicações
    if (inserir.length > 0) {
      console.log(`[capturar] Escavador já trouxe ${inserir.length} publicações — pulando DataJud`);
    }

    for (const proc of inserir.length > 0 ? [] : processos) {
      const numero = normalizeCNJ(proc.numero);
      const tribunalKey = detectTribunalFromCNJ(numero);
      const endpoint = DATAJUD_ENDPOINTS[tribunalKey];

      if (!endpoint) {
        erros.push(`Tribunal não suportado para processo ${numero}`);
        continue;
      }

      // Tentar com número normalizado e variações
      const candidates = [
        numero,
        proc.numero.trim(),
        proc.numero.replace(/\D/g, ""),
      ].filter((v, i, a) => a.indexOf(v) === i);

      let hit: Record<string, unknown> | null = null;
      let usedCandidate = "";

      for (const candidate of candidates) {
        try {
          const resp = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: DATAJUD_KEY,
            },
            body: JSON.stringify({
              query: { match: { numeroProcesso: candidate } },
              size: 1,
            }),
          });

          if (!resp.ok) continue;
          const data = await resp.json();
          const hits = (data.hits?.hits || []) as Record<string, unknown>[];
          if (hits.length > 0) {
            hit = hits[0]._source as Record<string, unknown>;
            usedCandidate = candidate;
            break;
          }
        } catch (e) {
          erros.push(`Erro ao consultar ${numero}: ${e}`);
        }
      }

      processosBuscados++;

      if (!hit) continue;

      const orgao = (hit.orgaoJulgador as Record<string, unknown>)?.nome || proc.vara || tribunalKey.toUpperCase();
      const movimentos = (hit.movimentos || []) as Record<string, unknown>[];

      // Pegar apenas movimentos recentes (últimos 30 dias)
      const recentes = movimentos.filter((m) => {
        if (!m.dataHora) return false;
        return new Date(m.dataHora as string) >= limiteData;
      });

      for (const mov of recentes.slice(0, 3)) {
        const tipo = classifyMovimento(mov.nome as string);
        const complementosText =
          (mov.complementosTabelados as { nome: string; valor: string }[])
            ?.map((c) => `${c.nome}: ${c.valor}`)
            .join("; ") || "";
        const conteudo = buildConteudo(
          hit,
          mov,
          orgao as string,
          tribunalKey,
          (hit.numeroProcesso as string) || usedCandidate
        );

        // Verificar duplicata
        const chave = `${(hit.numeroProcesso as string) || usedCandidate}::${conteudo.slice(0, 80)}`;
        if (existentesSet.has(chave)) continue;
        existentesSet.add(chave);

        const prazo = extractPrazoDias(mov.nome as string, complementosText);
        const status =
          tipo === "sentenca" || tipo === "acordao"
            ? "nova"
            : prazo !== null && prazo <= 5
            ? "urgente"
            : "nova";

        inserir.push({
          user_id: user.id,
          tipo,
          tribunal: tribunalKey.toUpperCase(),
          numero_processo: (hit.numeroProcesso as string) || usedCandidate,
          cliente_nome: proc.cliente_nome || null,
          data_publicacao: (mov.dataHora as string) || new Date().toISOString(),
          conteudo,
          conteudo_simplificado: null,
          status,
          prazo_dias: prazo,
          data_prazo: prazo
            ? new Date(Date.now() + prazo * 24 * 60 * 60 * 1000).toISOString()
            : null,
          tarefa_gerada: false,
        });
      }

      // Pequeno delay para não sobrecarregar a API
      await new Promise((r) => setTimeout(r, 150));
    }

    // Registra DataJud como fonte se usou
    if (processosBuscados > 0 && !fonteUsada.includes("Escavador DJe")) {
      fonteUsada.push("DataJud/CNJ");
    }

    let capturadas = 0;
    if (inserir.length > 0) {
      const { error: insertError } = await supabase
        .from("publicacoes")
        .insert(inserir);

      if (insertError) {
        return new Response(
          JSON.stringify({
            error: insertError.message,
            processosBuscados,
            erros,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      capturadas = inserir.length;
    }

    const fonteStr = fonteUsada.length > 0 ? fonteUsada.join(" + ") : "DataJud/CNJ";

    return new Response(
      JSON.stringify({
        capturadas,
        processosBuscados,
        erros,
        fonte: fonteStr,
        message:
          capturadas > 0
            ? `${capturadas} publicação(ões) capturada(s) via ${fonteStr} de ${processosBuscados} processo(s).`
            : processosBuscados > 0
            ? `${processosBuscados} processo(s) consultado(s) — nenhuma publicação nova nos últimos 30 dias.`
            : "Nenhum processo encontrado.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("capturar-publicacoes error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
