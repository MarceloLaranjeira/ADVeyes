import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// === DataJud endpoints (apenas os que realmente existem no CNJ) ===
const DATAJUD_ENDPOINTS: Record<string, string> = {
  tjac:"https://api-publica.datajud.cnj.jus.br/api_publica_tjac/_search",
  tjal:"https://api-publica.datajud.cnj.jus.br/api_publica_tjal/_search",
  tjam:"https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search",
  tjap:"https://api-publica.datajud.cnj.jus.br/api_publica_tjap/_search",
  tjba:"https://api-publica.datajud.cnj.jus.br/api_publica_tjba/_search",
  tjce:"https://api-publica.datajud.cnj.jus.br/api_publica_tjce/_search",
  tjdft:"https://api-publica.datajud.cnj.jus.br/api_publica_tjdft/_search",
  tjes:"https://api-publica.datajud.cnj.jus.br/api_publica_tjes/_search",
  tjgo:"https://api-publica.datajud.cnj.jus.br/api_publica_tjgo/_search",
  tjma:"https://api-publica.datajud.cnj.jus.br/api_publica_tjma/_search",
  tjmg:"https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search",
  tjms:"https://api-publica.datajud.cnj.jus.br/api_publica_tjms/_search",
  tjmt:"https://api-publica.datajud.cnj.jus.br/api_publica_tjmt/_search",
  tjpa:"https://api-publica.datajud.cnj.jus.br/api_publica_tjpa/_search",
  tjpb:"https://api-publica.datajud.cnj.jus.br/api_publica_tjpb/_search",
  tjpe:"https://api-publica.datajud.cnj.jus.br/api_publica_tjpe/_search",
  tjpi:"https://api-publica.datajud.cnj.jus.br/api_publica_tjpi/_search",
  tjpr:"https://api-publica.datajud.cnj.jus.br/api_publica_tjpr/_search",
  tjrj:"https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search",
  tjrn:"https://api-publica.datajud.cnj.jus.br/api_publica_tjrn/_search",
  tjro:"https://api-publica.datajud.cnj.jus.br/api_publica_tjro/_search",
  tjrr:"https://api-publica.datajud.cnj.jus.br/api_publica_tjrr/_search",
  tjrs:"https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search",
  tjsc:"https://api-publica.datajud.cnj.jus.br/api_publica_tjsc/_search",
  tjse:"https://api-publica.datajud.cnj.jus.br/api_publica_tjse/_search",
  tjsp:"https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search",
  tjto:"https://api-publica.datajud.cnj.jus.br/api_publica_tjto/_search",
  stf:"https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
  stj:"https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
  tst:"https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search",
  stm:"https://api-publica.datajud.cnj.jus.br/api_publica_stm/_search",
  tse:"https://api-publica.datajud.cnj.jus.br/api_publica_tse/_search",
  trf1:"https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
  trf2:"https://api-publica.datajud.cnj.jus.br/api_publica_trf2/_search",
  trf3:"https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search",
  trf4:"https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  trf5:"https://api-publica.datajud.cnj.jus.br/api_publica_trf5/_search",
  trf6:"https://api-publica.datajud.cnj.jus.br/api_publica_trf6/_search",
  trt1:"https://api-publica.datajud.cnj.jus.br/api_publica_trt1/_search",
  trt2:"https://api-publica.datajud.cnj.jus.br/api_publica_trt2/_search",
  trt3:"https://api-publica.datajud.cnj.jus.br/api_publica_trt3/_search",
  trt4:"https://api-publica.datajud.cnj.jus.br/api_publica_trt4/_search",
  trt5:"https://api-publica.datajud.cnj.jus.br/api_publica_trt5/_search",
  trt6:"https://api-publica.datajud.cnj.jus.br/api_publica_trt6/_search",
  trt7:"https://api-publica.datajud.cnj.jus.br/api_publica_trt7/_search",
  trt8:"https://api-publica.datajud.cnj.jus.br/api_publica_trt8/_search",
  trt9:"https://api-publica.datajud.cnj.jus.br/api_publica_trt9/_search",
  trt10:"https://api-publica.datajud.cnj.jus.br/api_publica_trt10/_search",
  trt11:"https://api-publica.datajud.cnj.jus.br/api_publica_trt11/_search",
  trt12:"https://api-publica.datajud.cnj.jus.br/api_publica_trt12/_search",
  trt13:"https://api-publica.datajud.cnj.jus.br/api_publica_trt13/_search",
  trt14:"https://api-publica.datajud.cnj.jus.br/api_publica_trt14/_search",
  trt15:"https://api-publica.datajud.cnj.jus.br/api_publica_trt15/_search",
  trt16:"https://api-publica.datajud.cnj.jus.br/api_publica_trt16/_search",
  trt17:"https://api-publica.datajud.cnj.jus.br/api_publica_trt17/_search",
  trt18:"https://api-publica.datajud.cnj.jus.br/api_publica_trt18/_search",
  trt19:"https://api-publica.datajud.cnj.jus.br/api_publica_trt19/_search",
  trt20:"https://api-publica.datajud.cnj.jus.br/api_publica_trt20/_search",
  trt21:"https://api-publica.datajud.cnj.jus.br/api_publica_trt21/_search",
  trt22:"https://api-publica.datajud.cnj.jus.br/api_publica_trt22/_search",
  trt23:"https://api-publica.datajud.cnj.jus.br/api_publica_trt23/_search",
  trt24:"https://api-publica.datajud.cnj.jus.br/api_publica_trt24/_search",
};

// === PJe MNI ===
const PJE_ENDPOINTS: Record<string, string> = {
  tjam:"https://pje.tjam.jus.br/pje/mni/",
  tjba:"https://pje.tjba.jus.br/pje/mni/",
  tjce:"https://pje.tjce.jus.br/pje/mni/",
  tjdft:"https://pje.tjdft.jus.br/pje/mni/",
  tjgo:"https://pje.tjgo.jus.br/pje/mni/",
  tjmg:"https://pje.tjmg.jus.br/pje/mni/",
  tjpe:"https://pje.tjpe.jus.br/pje/mni/",
  tjpi:"https://pje.tjpi.jus.br/pje/mni/",
  tjrn:"https://pje.tjrn.jus.br/pje/mni/",
  tjsp:"https://pje.tjsp.jus.br/pje/mni/",
  trf1:"https://pje.trf1.jus.br/pje/mni/",
  trf2:"https://pje.trf2.jus.br/pje/mni/",
  trf3:"https://pje.trf3.jus.br/pje/mni/",
  trf4:"https://pje.trf4.jus.br/pje/mni/",
  trf5:"https://pje.trf5.jus.br/pje/mni/",
  stj:"https://pje.stj.jus.br/pje/mni/",
  stf:"https://pje.stf.jus.br/pje/mni/",
  tst:"https://pje.tst.jus.br/pje/mni/",
};

// === Portais SEEU ===
const SEEU_PORTALS: Record<string, string> = {
  nacional:"https://seeu.pje.jus.br",
  tjam:"https://seeu.pje.jus.br",
  tjba:"https://seeu.pje.jus.br",
  tjsp:"https://seeu.pje.jus.br",
};

// === Portais Projudi ===
const PROJUDI_PORTALS: Record<string, string> = {
  tjam:"https://projudi.tjam.jus.br",
  tjpr:"https://projudi.tjpr.jus.br",
  tjgo:"https://projudi.tjgo.jus.br",
  tjrn:"https://projudi.tjrn.jus.br",
  tjmt:"https://projudi.tjmt.jus.br",
  tjal:"https://projudi.tjal.jus.br",
};

/**
 * Detecta o tribunal DataJud a partir do número CNJ padrão.
 * Formato: NNNNNNN-DD.AAAA.J.TT.OOOO
 */
function detectTribunalFromCNJ(numero: string): string | null {
  const clean = numero.replace(/\s/g, "");
  const match = clean.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return null;
  const j = parseInt(match[1]);
  const tt = parseInt(match[2]);
  if (j === 1) return "stf";
  if (j === 3) return "stj";
  if (j === 4 && tt >= 1 && tt <= 6) return `trf${tt}`;
  if ((j === 5 || j === 6) && tt >= 1 && tt <= 24) return `trt${tt}`;
  if (j === 7) return "tse";
  if (j === 9) return "stm";
  if (j === 8) {
    const m: Record<number, string> = {
      1:"tjac",2:"tjal",3:"tjap",4:"tjam",5:"tjba",6:"tjce",7:"tjdft",
      8:"tjes",9:"tjgo",10:"tjma",11:"tjmg",12:"tjms",13:"tjmt",14:"tjpa",
      15:"tjpb",16:"tjpe",17:"tjpi",18:"tjpr",19:"tjrj",20:"tjrn",
      21:"tjro",22:"tjrr",23:"tjrs",24:"tjsc",25:"tjse",26:"tjsp",27:"tjto",
    };
    return m[tt] || null;
  }
  return null;
}

const DATAJUD_KEY = "APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

function normalizeCNJ(numero: string): string {
  const digits = numero.replace(/\D/g, "");
  if (digits.length === 20) {
    return `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16)}`;
  }
  return numero.trim();
}

async function queryDataJud(endpoint: string, numero_processo: string): Promise<{ data?: any; error?: string; status?: number }> {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": DATAJUD_KEY,
  };
  const candidates = [...new Set([normalizeCNJ(numero_processo), numero_processo.trim(), numero_processo.replace(/\D/g, "")])].filter(Boolean);

  let lastError = "";
  let lastStatus = 0;

  for (const candidate of candidates) {
    let resp: Response;
    try {
      resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: { match: { numeroProcesso: candidate } }, size: 10 }),
      });
    } catch (err) {
      lastError = String(err);
      continue;
    }
    if (!resp.ok) {
      lastStatus = resp.status;
      try { lastError = await resp.text(); } catch { lastError = `HTTP ${resp.status}`; }
      if (resp.status === 401 || resp.status === 402 || resp.status === 429) break;
      continue;
    }
    const data = await resp.json();
    if ((data.hits?.hits?.length ?? 0) > 0) return { data };
    if (candidate === candidates[candidates.length - 1]) return { data };
  }

  if (lastError) return { error: lastError, status: lastStatus };
  return { data: { hits: { hits: [], total: { value: 0 } } } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.user.id;

    const { action, tribunal, numero_processo, documento, processo_id, sistema } = await req.json();

    // Resolver o tribunal: pode vir como "seeu" ou "projudi" → detectar pelo número CNJ
    let tribunalKey = (sistema || tribunal || "tjam").toLowerCase();
    let realKey = tribunalKey;

    if (tribunalKey === "seeu" || tribunalKey === "projudi") {
      const detected = numero_processo ? detectTribunalFromCNJ(numero_processo) : null;
      if (detected) {
        realKey = detected;
      }
    }

    // Fetch user's tribunal credentials
    const { data: cred } = await supabase
      .from("tribunal_credenciais")
      .select("*")
      .eq("user_id", userId)
      .eq("tribunal", tribunalKey)
      .eq("ativo", true)
      .maybeSingle();

    let result: any = {};

    switch (action) {
      case "consultar_processo":
      case "consultar_seeu":
      case "consultar_projudi": {
        const endpoint = DATAJUD_ENDPOINTS[realKey];
        if (!endpoint) {
          const autoDetected = numero_processo ? detectTribunalFromCNJ(numero_processo) : null;
          throw new Error(
            autoDetected
              ? `Tribunal "${tribunalKey}" não tem endpoint DataJud. O número CNJ sugere: ${autoDetected.toUpperCase()}. Selecione este tribunal.`
              : `Tribunal/sistema "${tribunalKey}" não suportado pelo DataJud.`
          );
        }

        const { data, error: djError, status: djStatus } = await queryDataJud(endpoint, numero_processo);
        if (djError) {
          throw new Error(`DataJud ${realKey.toUpperCase()}: ${djStatus} - ${djError.slice(0, 200)}`);
        }

        result = {
          sistema: tribunalKey === "seeu" ? "SEEU" : tribunalKey === "projudi" ? "Projudi" : realKey.toUpperCase(),
          tribunal_consultado: realKey.toUpperCase(),
          processos: (data.hits?.hits || []).map((hit: any) => {
            const s = hit._source;
            return {
              numero: s.numeroProcesso,
              classe: s.classe?.nome || s.classeProcessual || "Não informado",
              assunto: s.assuntos?.map((a: any) => a.nome).join(", ") || "",
              tribunal: s.tribunal || realKey.toUpperCase(),
              orgaoJulgador: s.orgaoJulgador?.nome || "",
              dataAjuizamento: s.dataAjuizamento,
              movimentos: (s.movimentos || []).map((m: any) => ({
                nome: m.nome, data: m.dataHora,
                complementos: m.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join("; ") || "",
              })),
            };
          }),
          total: data.hits?.total?.value || 0,
          portal_seeu: tribunalKey === "seeu" ? (SEEU_PORTALS[realKey] || SEEU_PORTALS.nacional) : undefined,
          portal_projudi: tribunalKey === "projudi" ? (PROJUDI_PORTALS[realKey] || null) : undefined,
        };
        break;
      }

      case "peticionar": {
        if (!cred) {
          return new Response(JSON.stringify({
            error: `Credenciais não configuradas para ${tribunalKey.toUpperCase()}. Configure em Configurações > Tribunais.`,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const baseUrl = PJE_ENDPOINTS[realKey];
        const sistemaDesc = baseUrl ? "PJe/MNI"
          : SEEU_PORTALS[realKey] ? "SEEU"
          : PROJUDI_PORTALS[realKey] ? "Projudi"
          : "sistema judicial";

        result = {
          status: "preparado",
          message: `Petição preparada para envio ao ${tribunalKey.toUpperCase()} via ${sistemaDesc}.`,
          endpoint: baseUrl || SEEU_PORTALS[realKey] || PROJUDI_PORTALS[realKey] || "N/A",
          credencial: { oab: cred.numero_oab, seccional: cred.seccional_oab },
          nota: `O peticionamento real requer certificado digital A1/A3 para o ${sistemaDesc}. Acesse o portal para assinar e enviar.`,
          documento_info: documento ? { nome: documento.nome, tipo: documento.tipo } : null,
        };

        await supabase.from("notificacoes").insert({
          user_id: userId,
          titulo: "Petição preparada",
          mensagem: `Petição preparada para o processo ${numero_processo} no ${tribunalKey.toUpperCase()} via ${sistemaDesc}.`,
          tipo: "info",
          processo_numero: numero_processo,
          tribunal: tribunalKey,
        });
        break;
      }

      case "monitorar": {
        const { error: monError } = await supabase.from("processo_monitoramento").upsert({
          user_id: userId,
          numero_processo,
          tribunal: realKey,
          processo_id: processo_id || null,
          ativo: true,
        }, { onConflict: "user_id,numero_processo" });

        if (monError) {
          await supabase.from("processo_monitoramento").insert({
            user_id: userId,
            numero_processo,
            tribunal: realKey,
            processo_id: processo_id || null,
            ativo: true,
          });
        }

        result = { status: "monitorando", message: `Processo ${numero_processo} adicionado ao monitoramento (${realKey.toUpperCase()}).` };
        break;
      }

      case "verificar_movimentacoes": {
        const { data: monitored } = await supabase
          .from("processo_monitoramento")
          .select("*")
          .eq("user_id", userId)
          .eq("ativo", true);

        const updates: any[] = [];
        for (const mon of (monitored || [])) {
          const ep = DATAJUD_ENDPOINTS[mon.tribunal] || DATAJUD_ENDPOINTS.tjam;
          try {
            const { data } = await queryDataJud(ep, mon.numero_processo);
            if (data) {
              const hit = data.hits?.hits?.[0]?._source;
              if (hit) {
                const lastMov = hit.movimentos?.[0]?.nome || "";
                if (lastMov && lastMov !== mon.ultimo_movimento) {
                  updates.push({ processo: mon.numero_processo, movimento: lastMov, tribunal: mon.tribunal });
                  await supabase.from("processo_monitoramento")
                    .update({ ultimo_movimento: lastMov, ultima_verificacao: new Date().toISOString() })
                    .eq("id", mon.id);
                  await supabase.from("notificacoes").insert({
                    user_id: userId,
                    titulo: `Nova movimentação - ${mon.numero_processo}`,
                    mensagem: `${lastMov} (${mon.tribunal.toUpperCase()})`,
                    tipo: "movimentacao",
                    processo_numero: mon.numero_processo,
                    tribunal: mon.tribunal,
                  });
                } else {
                  await supabase.from("processo_monitoramento")
                    .update({ ultima_verificacao: new Date().toISOString() })
                    .eq("id", mon.id);
                }
              }
            }
          } catch (e) {
            console.error(`Error checking ${mon.numero_processo}:`, e);
          }
        }

        result = { atualizacoes: updates, total_monitorados: monitored?.length || 0 };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tribunal-api error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
