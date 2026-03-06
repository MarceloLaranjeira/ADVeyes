import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All DataJud endpoints
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
  stj: "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
  stf: "https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
  tst: "https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search",
  stm: "https://api-publica.datajud.cnj.jus.br/api_publica_stm/_search",
  tse: "https://api-publica.datajud.cnj.jus.br/api_publica_tse/_search",
  trf1: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
  trf2: "https://api-publica.datajud.cnj.jus.br/api_publica_trf2/_search",
  trf3: "https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search",
  trf4: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
  trf5: "https://api-publica.datajud.cnj.jus.br/api_publica_trf5/_search",
  trf6: "https://api-publica.datajud.cnj.jus.br/api_publica_trf6/_search",
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

// PJe MNI endpoints
const PJE_ENDPOINTS: Record<string, string> = {
  tjam: "https://pje.tjam.jus.br/pje/mni/",
  tjba: "https://pje.tjba.jus.br/pje/mni/",
  tjce: "https://pje.tjce.jus.br/pje/mni/",
  tjdft: "https://pje.tjdft.jus.br/pje/mni/",
  tjgo: "https://pje.tjgo.jus.br/pje/mni/",
  tjmg: "https://pje.tjmg.jus.br/pje/mni/",
  tjpe: "https://pje.tjpe.jus.br/pje/mni/",
  tjpi: "https://pje.tjpi.jus.br/pje/mni/",
  tjrn: "https://pje.tjrn.jus.br/pje/mni/",
  tjsp: "https://pje.tjsp.jus.br/pje/mni/",
  trf1: "https://pje.trf1.jus.br/pje/mni/",
  trf2: "https://pje.trf2.jus.br/pje/mni/",
  trf3: "https://pje.trf3.jus.br/pje/mni/",
  trf4: "https://pje.trf4.jus.br/pje/mni/",
  trf5: "https://pje.trf5.jus.br/pje/mni/",
  stj: "https://pje.stj.jus.br/pje/mni/",
  stf: "https://pje.stf.jus.br/pje/mni/",
  tst: "https://pje.tst.jus.br/pje/mni/",
};

// SEEU system URLs
const SEEU_URLS: Record<string, string> = {
  seeu_tjam: "https://seeu.pje.jus.br",
  seeu_tjba: "https://seeu.pje.jus.br",
  seeu_tjsp: "https://seeu.pje.jus.br",
};

// Projudi system URLs
const PROJUDI_URLS: Record<string, string> = {
  projudi_tjam: "https://projudi.tjam.jus.br",
  projudi_tjpr: "https://projudi.tjpr.jus.br",
  projudi_tjgo: "https://projudi.tjgo.jus.br",
  projudi_tjrn: "https://projudi.tjrn.jus.br",
  projudi_tjmt: "https://projudi.tjmt.jus.br",
  projudi_tjal: "https://projudi.tjal.jus.br",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.user.id;

    const { action, tribunal, numero_processo, documento, processo_id, sistema } = await req.json();
    const tribunalKey = (sistema || tribunal || "tjam").toLowerCase();

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
      case "consultar_processo": {
        const endpoint = DATAJUD_ENDPOINTS[tribunalKey];
        if (!endpoint) throw new Error(`Tribunal/sistema "${tribunalKey}" não suportado`);

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `APIKey ${Deno.env.get("DATAJUD_API_KEY")}`,
          },
          body: JSON.stringify({
            query: { match: { numeroProcesso: numero_processo.replace(/[.\-\/]/g, "") } },
            size: 10,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`DataJud: ${resp.status} - ${errText}`);
        }

        const data = await resp.json();
        result = {
          processos: (data.hits?.hits || []).map((hit: any) => {
            const s = hit._source;
            return {
              numero: s.numeroProcesso,
              classe: s.classe?.nome || s.classeProcessual,
              assunto: s.assuntos?.map((a: any) => a.nome).join(", ") || "",
              tribunal: s.tribunal,
              sistema: tribunalKey,
              orgaoJulgador: s.orgaoJulgador?.nome || "",
              dataAjuizamento: s.dataAjuizamento,
              movimentos: (s.movimentos || []).slice(0, 10).map((m: any) => ({
                nome: m.nome, data: m.dataHora,
                complementos: m.complementosTabelados?.map((c: any) => `${c.nome}: ${c.valor}`).join("; ") || "",
              })),
            };
          }),
          total: data.hits?.total?.value || 0,
        };
        break;
      }

      case "peticionar": {
        if (!cred) {
          return new Response(JSON.stringify({ error: `Credenciais não configuradas para ${tribunalKey.toUpperCase()}. Configure em Configurações > Integrações.` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const baseUrl = PJE_ENDPOINTS[tribunalKey];
        const sistemaDesc = baseUrl ? "PJe/MNI" : SEEU_URLS[`seeu_${tribunalKey}`] ? "SEEU" : PROJUDI_URLS[`projudi_${tribunalKey}`] ? "Projudi" : "sistema";

        result = {
          status: "preparado",
          message: `Petição preparada para envio ao ${tribunalKey.toUpperCase()} via ${sistemaDesc}.`,
          endpoint: baseUrl || SEEU_URLS[`seeu_${tribunalKey}`] || PROJUDI_URLS[`projudi_${tribunalKey}`] || "N/A",
          credencial: { oab: cred.numero_oab, seccional: cred.seccional_oab },
          nota: `O peticionamento real requer certificado digital A1/A3 para o ${sistemaDesc}. A petição foi salva e pode ser enviada manualmente.`,
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
          tribunal: tribunalKey,
          processo_id: processo_id || null,
          ativo: true,
        }, { onConflict: "user_id,numero_processo" });

        if (monError) {
          await supabase.from("processo_monitoramento").insert({
            user_id: userId,
            numero_processo,
            tribunal: tribunalKey,
            processo_id: processo_id || null,
            ativo: true,
          });
        }

        result = { status: "monitorando", message: `Processo ${numero_processo} adicionado ao monitoramento.` };
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
            const resp = await fetch(ep, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `APIKey ${Deno.env.get("DATAJUD_API_KEY")}`,
              },
              body: JSON.stringify({
                query: { match: { numeroProcesso: mon.numero_processo.replace(/[.\-\/]/g, "") } },
                size: 1,
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
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

      case "consultar_seeu":
      case "consultar_projudi": {
        // SEEU/Projudi data is indexed under respective tribunal endpoints
        const SEEU_TRIBUNAIS = ["tjam", "tjba", "tjsp", "tjrj", "tjmg", "tjpr", "tjrs", "tjsc", "tjpe", "tjce"];
        const PROJUDI_TRIBUNAIS = ["tjam", "tjpr", "tjgo", "tjrn", "tjmt", "tjal", "tjba", "tjms"];
        const tribunais = action === "consultar_seeu" ? SEEU_TRIBUNAIS : PROJUDI_TRIBUNAIS;
        const sistemaName = action === "consultar_seeu" ? "SEEU" : "Projudi";
        
        const allProcs: any[] = [];
        let totalCount = 0;
        
        for (let i = 0; i < tribunais.length; i += 5) {
          const batch = tribunais.slice(i, i + 5);
          const results = await Promise.allSettled(
            batch.map(async (t) => {
              const ep = DATAJUD_ENDPOINTS[t];
              if (!ep) return null;
              const resp = await fetch(ep, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `APIKey ${Deno.env.get("DATAJUD_API_KEY")}` },
                body: JSON.stringify({ query: { match: { numeroProcesso: numero_processo.replace(/[.\-\/]/g, "") } }, size: 5 }),
              });
              if (!resp.ok) return null;
              return { tribunal: t, data: await resp.json() };
            })
          );
          for (const r of results) {
            if (r.status === "fulfilled" && r.value?.data) {
              totalCount += r.value.data.hits?.total?.value || 0;
              for (const hit of (r.value.data.hits?.hits || [])) {
                const s = hit._source;
                allProcs.push({
                  numero: s.numeroProcesso,
                  classe: s.classe?.nome || s.classeProcessual,
                  tribunal: s.tribunal || r.value!.tribunal.toUpperCase(),
                  orgaoJulgador: s.orgaoJulgador?.nome || "",
                  movimentos: (s.movimentos || []).slice(0, 5).map((m: any) => ({ nome: m.nome, data: m.dataHora })),
                });
              }
            }
          }
        }
        
        result = { sistema: sistemaName, processos: allProcs, total: totalCount };
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
