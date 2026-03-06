import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active monitored processes
    const { data: monitored } = await supabase
      .from("processo_monitoramento")
      .select("*")
      .eq("ativo", true);

    if (!monitored || monitored.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum processo monitorado", updates: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tribunalEndpoints: Record<string, string> = {
      tjam: "https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search",
      stj: "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search",
      stf: "https://api-publica.datajud.cnj.jus.br/api_publica_stf/_search",
      trf1: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
      tst: "https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search",
    };

    let totalUpdates = 0;

    for (const mon of monitored) {
      try {
        const endpoint = tribunalEndpoints[mon.tribunal] || tribunalEndpoints.tjam;
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "APIKey cDZHYzlZa0JadVREZDR4cUY0c0VRQkF3SUlJa2RaS3I=",
          },
          body: JSON.stringify({
            query: { match: { numeroProcesso: mon.numero_processo.replace(/[.\-\/]/g, "") } },
            size: 1,
          }),
        });

        if (!resp.ok) { await resp.text(); continue; }

        const data = await resp.json();
        const hit = data.hits?.hits?.[0]?._source;
        if (!hit) continue;

        const lastMov = hit.movimentos?.[0]?.nome || "";
        const now = new Date().toISOString();

        if (lastMov && lastMov !== mon.ultimo_movimento) {
          totalUpdates++;

          await supabase.from("processo_monitoramento")
            .update({ ultimo_movimento: lastMov, ultima_verificacao: now })
            .eq("id", mon.id);

          await supabase.from("notificacoes").insert({
            user_id: mon.user_id,
            titulo: `Nova movimentação - ${mon.numero_processo}`,
            mensagem: `${lastMov} (${mon.tribunal.toUpperCase()})`,
            tipo: "movimentacao",
            processo_numero: mon.numero_processo,
            tribunal: mon.tribunal,
          });
        } else {
          await supabase.from("processo_monitoramento")
            .update({ ultima_verificacao: now })
            .eq("id", mon.id);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error(`Error checking ${mon.numero_processo}:`, e);
      }
    }

    // Also check for upcoming deadlines and create notifications
    const em24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const hoje = new Date().toISOString().slice(0, 10);

    // Check tarefas with deadlines today or tomorrow
    const { data: tarefasUrgentes } = await supabase
      .from("tarefas")
      .select("*")
      .neq("status", "concluída")
      .not("data_limite", "is", null)
      .lte("data_limite", em24h)
      .gte("data_limite", hoje);

    for (const t of (tarefasUrgentes || [])) {
      // Check if we already notified about this
      const { data: existing } = await supabase
        .from("notificacoes")
        .select("id")
        .eq("user_id", t.user_id)
        .eq("titulo", `Prazo próximo - ${t.titulo}`)
        .gte("created_at", hoje)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("notificacoes").insert({
          user_id: t.user_id,
          titulo: `Prazo próximo - ${t.titulo}`,
          mensagem: `A tarefa "${t.titulo}" vence em ${new Date(t.data_limite).toLocaleDateString("pt-BR")}`,
          tipo: "alerta",
        });
      }
    }

    return new Response(JSON.stringify({ 
      message: "Verificação concluída",
      monitorados: monitored.length,
      updates: totalUpdates,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cron-monitoramento error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
