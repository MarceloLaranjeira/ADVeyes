import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // JWT Authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompts: Record<string, string> = {
      resumo: "Você é um assistente jurídico especializado em resumir peças processuais (petições, sentenças, acórdãos) em linguagem clara e acessível. Mantenha a precisão técnica mas use termos compreensíveis. Estruture o resumo com: Partes, Objeto, Fundamentos Principais, Decisão/Pedido.",
      analise: "Você é um assistente jurídico especializado em analisar documentos e contratos. Identifique cláusulas importantes, riscos, prazos e obrigações. Destaque pontos de atenção.",
      peticao: "Você é um assistente jurídico especializado em gerar rascunhos de peças processuais. Siga a estrutura formal: Endereçamento, Qualificação das Partes, Fatos, Fundamentos Jurídicos, Pedidos. Use linguagem formal e técnica apropriada ao Direito brasileiro.",
      assistente: "Você é um assistente jurídico brasileiro especializado em Direito Penal, Cível, Família e Execução Penal, com foco na legislação e jurisprudência do estado do Amazonas (TJAM). Responda de forma clara, citando artigos de lei e jurisprudência quando relevante.",
      traducao: "Você é um especialista em traduzir linguagem jurídica complexa ('juridiquês') para uma linguagem simples, clara e acessível ao cidadão comum. Seu objetivo é explicar decisões judiciais, intimações, sentenças e documentos jurídicos de forma que qualquer pessoa, sem conhecimento técnico em Direito, possa entender plenamente. Use palavras do dia a dia, evite termos técnicos (e quando for necessário usá-los, explique-os entre parênteses). Mantenha a precisão do conteúdo mas priorize a clareza. Estruture sua resposta em: O QUE ACONTECEU, O QUE SIGNIFICA PARA VOCÊ, O QUE VOCÊ PRECISA FAZER AGORA.",
      triagem: "Você é um agente especializado em triagem e qualificação de leads jurídicos para um escritório de advocacia. Sua função é analisar a consulta inicial de um potencial cliente e: 1) Identificar a área do Direito envolvida (Penal, Cível, Família, Trabalhista, Consumidor, Previdenciário, etc.); 2) Avaliar a urgência do caso (alta/média/baixa) com base nos prazos mencionados; 3) Fazer perguntas objetivas para coletar as informações essenciais (fatos, documentos disponíveis, partes envolvidas, prazos); 4) Apresentar um resumo do caso qualificado para o advogado; 5) Orientar o cliente sobre os próximos passos. Seja empático, profissional e objetivo. Ao final de cada interação, apresente um RELATÓRIO DE TRIAGEM com: Área Jurídica, Urgência, Resumo do Caso, Documentos Necessários, Ação Recomendada.",
    };

    const systemContent = systemPrompts[mode] || systemPrompts.assistente;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
