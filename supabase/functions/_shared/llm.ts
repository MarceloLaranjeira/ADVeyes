/**
 * Acesso ao modelo de linguagem.
 *
 * O sistema tinha um único caminho de IA — a função `chat`, apontando para o
 * gateway da Lovable com um modelo Gemini — e ele está fora do ar porque a
 * `LOVABLE_API_KEY` não está configurada. Este módulo passa a ser a porta
 * única, com o provedor escolhido por qual chave existe no ambiente.
 *
 * Hoje o provedor implementado é a OpenAI, com o SDK oficial. A fronteira
 * está desenhada para receber outro (`resolveProvider` decide, `complete` é
 * a assinatura que qualquer provedor precisa cumprir), mas não há abstração
 * especulativa: o segundo entra quando houver chave e decisão.
 */

import OpenAI from "npm:openai@7.4.0";

/**
 * O topo da família 5.6, lançada em julho de 2026. Trabalho jurídico é
 * sensível a qualidade, não a centavos.
 */
const DEFAULT_MODEL = "gpt-5.6-sol";

/**
 * Teto de saída. Uma minuta inicial cabe folgado; o limite existe para a
 * função não estourar o tempo de execução da Edge Function. O modelo
 * suporta até 128 mil.
 */
const DEFAULT_MAX_TOKENS = 8_000;

export type LlmProvider = "openai";

export class LlmNotConfiguredError extends Error {
  readonly code = "llm_not_configured";
  constructor() {
    super(
      "Nenhuma chave de IA configurada. Defina OPENAI_API_KEY nos secrets.",
    );
  }
}

export class LlmRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/** Devolve o provedor disponível, ou nulo quando nenhum está configurado. */
export function resolveProvider(): LlmProvider | null {
  return Deno.env.get("OPENAI_API_KEY")?.trim() ? "openai" : null;
}

export interface CompletionInput {
  /** Instrução de sistema: papel, limites e formato esperado. */
  system: string;
  /** Conteúdo do usuário. Um único turno; não há conversa aqui. */
  prompt: string;
  maxTokens?: number;
  /**
   * Profundidade de raciocínio. `medium` mantém a latência dentro do tempo
   * da Edge Function; `high` para tarefas que justificam a espera.
   */
  effort?: "low" | "medium" | "high";
}

export interface CompletionResult {
  text: string;
  provider: LlmProvider;
  model: string;
  /** Tokens cobrados, para a trilha de custo por escritório. */
  usage: { input: number; output: number };
}

/**
 * Gera uma resposta única.
 *
 * Não faz retentativa: quem chama decide se repete, porque em uma Edge
 * Function o tempo já é curto e uma segunda tentativa silenciosa costuma
 * estourar o limite em vez de salvar a requisição.
 */
export async function complete(
  input: CompletionInput,
): Promise<CompletionResult> {
  const provider = resolveProvider();
  if (provider === null) throw new LlmNotConfiguredError();

  const client = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

  try {
    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      instructions: input.system,
      input: input.prompt,
      max_output_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      reasoning: { effort: input.effort ?? "medium" },
      // A API guarda a resposta para consulta posterior por padrão. Aqui
      // trafegam autos e dados de cliente sob sigilo profissional, então a
      // retenção no provedor é desligada explicitamente.
      store: false,
    });

    const text = response.output_text?.trim() ?? "";
    if (!text) {
      throw new LlmRequestError(
        "llm_empty_response",
        "O modelo não devolveu texto.",
      );
    }

    return {
      text,
      provider,
      model: response.model,
      usage: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    if (error instanceof LlmRequestError) throw error;

    if (error instanceof OpenAI.RateLimitError) {
      throw new LlmRequestError(
        "llm_rate_limited",
        "O limite de consultas do provedor de IA foi atingido.",
      );
    }
    if (error instanceof OpenAI.AuthenticationError) {
      throw new LlmRequestError(
        "llm_unauthorized",
        "A chave da IA foi recusada.",
      );
    }
    if (error instanceof OpenAI.PermissionDeniedError) {
      throw new LlmRequestError(
        "llm_forbidden",
        "A conta não tem acesso a este modelo.",
      );
    }
    if (error instanceof OpenAI.APIConnectionError) {
      throw new LlmRequestError(
        "llm_unreachable",
        "Não foi possível falar com o provedor de IA.",
      );
    }

    console.error("llm: falha inesperada", error);
    throw new LlmRequestError("llm_failed", "A geração falhou.");
  }
}
