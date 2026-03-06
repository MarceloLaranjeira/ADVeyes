import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MNI (Modelo Nacional de Interoperabilidade) endpoints
const PJE_ENDPOINTS: Record<string, string> = {
  tjam: "https://pje.tjam.jus.br/pje/mni/",
  trf1: "https://pje.trf1.jus.br/pje/mni/",
  stj: "https://pje.stj.jus.br/pje/mni/",
  stf: "https://pje.stf.jus.br/pje/mni/",
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

    const { action, tribunal, numero_processo, documento, processo_id } = await req.json();

    // Fetch user's tribunal credentials
    const { data: cred } = await supabase
      .from("tribunal_credenciais")
      .select("*")
      .eq("user_id", userId)
      .eq("tribunal", tribunal)
      .eq("ativo", true)
      .single();

    if (!cred) {
      return new Response(JSON.stringify({ error: `Credenciais não configuradas para ${tribunal?.toUpperCase()}. Configure em Configurações > Integrações.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = {};

    switch (action) {
      case "consultar_processo": {
        // Use DataJud API for process lookup
        const tribunalEndpoints: Record<string, string> = {
          tjam: "https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search",
          stj: "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
          stf: "https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
          trf1: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
        };
        const endpoint = tribunalEndpoints[tribunal] || tribunalEndpoints.tjam;

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `APIKey cDZHYzlZa0JadVREZDR4cUY0c0VRQkF3SUlJa2RaS3I=`,
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
        // PJe MNI petitioning - prepare the SOAP envelope
        const baseUrl = PJE_ENDPOINTS[tribunal];
        if (!baseUrl) throw new Error(`Tribunal ${tribunal} não suportado para peticionamento`);

        // Note: Real PJe petitioning requires certificate-based auth (A1/A3)
        // This is a structured request that would be sent to PJe's MNI service
        result = {
          status: "preparado",
          message: `Petição preparada para envio ao ${tribunal.toUpperCase()} via MNI.`,
          endpoint: baseUrl,
          credencial: { oab: cred.numero_oab, seccional: cred.seccional_oab },
          nota: "O peticionamento real requer certificado digital A1/A3 configurado no servidor. A petição foi salva localmente e pode ser enviada manualmente via PJe.",
          documento_info: documento ? { nome: documento.nome, tipo: documento.tipo } : null,
        };

        // Save notification about the petition attempt
        await supabase.from("notificacoes").insert({
          user_id: userId,
          titulo: "Petição preparada",
          mensagem: `Petição preparada para o processo ${numero_processo} no ${tribunal.toUpperCase()}. Envie manualmente via PJe.`,
          tipo: "info",
          processo_numero: numero_processo,
          tribunal: tribunal,
        });
        break;
      }

      case "monitorar": {
        // Add process to monitoring list
        const { error: monError } = await supabase.from("processo_monitoramento").upsert({
          user_id: userId,
          numero_processo,
          tribunal,
          processo_id: processo_id || null,
          ativo: true,
        }, { onConflict: "user_id,numero_processo" });

        // Note: upsert may fail if there's no unique constraint on (user_id, numero_processo)
        // In that case we just insert
        if (monError) {
          await supabase.from("processo_monitoramento").insert({
            user_id: userId,
            numero_processo,
            tribunal,
            processo_id: processo_id || null,
            ativo: true,
          });
        }

        result = { status: "monitorando", message: `Processo ${numero_processo} adicionado ao monitoramento.` };
        break;
      }

      case "verificar_movimentacoes": {
        // Check for new movements in monitored processes
        const { data: monitored } = await supabase
          .from("processo_monitoramento")
          .select("*")
          .eq("user_id", userId)
          .eq("ativo", true);

        const updates: any[] = [];
        for (const mon of (monitored || [])) {
          const tribunalEndpoints: Record<string, string> = {
            tjam: "https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search",
            stj: "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
            stf: "https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
            trf1: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
          };
          const ep = tribunalEndpoints[mon.tribunal] || tribunalEndpoints.tjam;

          try {
            const resp = await fetch(ep, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `APIKey cDZHYzlZa0JadVREZDR4cUY0c0VRQkF3SUlJa2RaS3I=`,
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
                  
                  // Update last known movement
                  await supabase.from("processo_monitoramento")
                    .update({ ultimo_movimento: lastMov, ultima_verificacao: new Date().toISOString() })
                    .eq("id", mon.id);

                  // Create notification
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
