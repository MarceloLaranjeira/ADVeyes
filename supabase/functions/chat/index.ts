import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Models in order of preference (fallback on failure)
const MODELS = [
  "google/gemini-2.0-flash-exp",
  "google/gemini-2.0-flash",
  "google/gemini-1.5-flash",
  "google/gemini-1.5-flash-8b",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompts: Record<string, string> = {
      resumo: `Você é JARVIS, assistente jurídico especializado em resumir peças processuais (petições, sentenças, acórdãos) em linguagem clara e acessível. Mantenha a precisão técnica. Estruture o resumo com: Partes, Objeto, Fundamentos Principais, Decisão/Pedido.`,
      analise: `Você é JARVIS, assistente jurídico especializado em analisar documentos e contratos. Identifique cláusulas importantes, riscos, prazos e obrigações. Destaque pontos de atenção com linguagem objetiva.`,
      peticao: `Você é JARVIS, assistente jurídico especializado em gerar rascunhos de peças processuais. Siga a estrutura formal: Endereçamento, Qualificação das Partes, Fatos, Fundamentos Jurídicos, Pedidos. Use linguagem formal e técnica do Direito brasileiro.`,
      assistente: `Você é JARVIS, assistente jurídico de inteligência artificial desenvolvido para o escritório Albertino e Advogados Associados. Você é especializado em Direito brasileiro, com foco no estado do Amazonas (TJAM), mas com conhecimento abrangente de toda a legislação e jurisprudência nacional. Responda de forma clara, direta e técnica, citando artigos de lei, súmulas e jurisprudência quando relevante. Seja como o JARVIS — inteligente, preciso e proativo.`,
    };

    const systemContent = systemPrompts[mode] || systemPrompts.assistente;

    // Try models in sequence
    let lastError = "";
    for (const model of MODELS) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemContent },
              ...messages,
            ],
            stream: true,
            max_tokens: 4096,
          }),
        });

        if (response.ok) {
          return new Response(response.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }

        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const errText = await response.text();
        lastError = `${model}: ${response.status} - ${errText.slice(0, 100)}`;
        console.error("AI gateway error:", lastError);
        // Continue to next model
      } catch (fetchErr) {
        lastError = `${model}: ${fetchErr}`;
        console.error("Fetch error:", lastError);
        // Continue to next model
      }
    }

    // All models failed
    return new Response(JSON.stringify({ error: `Serviço de IA indisponível no momento. ${lastError}` }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
