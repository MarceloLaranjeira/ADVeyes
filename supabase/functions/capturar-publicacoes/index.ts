import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_KEY =
  Deno.env.get("DATAJUD_API_KEY") ||
  "APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

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

    for (const proc of processos) {
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

    return new Response(
      JSON.stringify({
        capturadas,
        processosBuscados,
        erros,
        message:
          capturadas > 0
            ? `${capturadas} movimentação(ões) real(is) capturada(s) via DataJud/CNJ de ${processosBuscados} processo(s).`
            : processosBuscados > 0
            ? `${processosBuscados} processo(s) consultado(s) no DataJud — nenhuma movimentação nova nos últimos 30 dias.`
            : "Nenhum processo encontrado no DataJud.",
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
