import type { FunctionsError } from "@supabase/supabase-js";

/**
 * Lê a mensagem real de uma falha de Edge Function.
 *
 * O `supabase-js` põe sempre o mesmo texto em `error.message` — "Edge
 * Function returned a non-2xx status code" — independentemente do que a
 * função respondeu. A mensagem útil viaja no corpo da resposta, acessível
 * por `error.context`, e quem só mostra `error.message` esconde de si mesmo
 * a causa: "credenciais não configuradas" chega ao usuário como um código
 * de status.
 */

/** Códigos que as Edge Functions deste projeto devolvem, em português. */
const MENSAGENS: Record<string, string> = {
  unauthorized: "Sua sessão expirou. Entre novamente.",
  permission_denied: "Você não tem permissão para esta ação.",
  invalid_payload: "Confira os dados informados.",
  operation_failed: "A operação falhou. Tente novamente.",
  llm_not_configured: "A IA ainda não foi configurada nesta plataforma.",
  llm_unauthorized: "A chave da IA foi recusada.",
  llm_rate_limited: "O limite de consultas da IA foi atingido.",
  llm_forbidden: "A conta não tem acesso ao modelo de IA.",
  llm_unreachable: "Não foi possível falar com o provedor de IA.",
  process_not_found: "O processo não está mais disponível.",
  publication_not_found: "A publicação não está mais disponível.",
};

export interface EdgeFunctionFailure {
  /** Código estável, quando a função devolveu um. */
  code: string | null;
  /** Texto para mostrar ao usuário. Nunca vazio. */
  message: string;
}

/**
 * Extrai código e mensagem de uma falha de invoke.
 *
 * Precisa ser assíncrono porque o corpo do erro só existe como `Response`
 * ainda não lida. O `clone()` é obrigatório: ler o corpo original o
 * consome, e qualquer outro leitor depois receberia vazio.
 */
export async function readEdgeFunctionError(
  error: unknown,
): Promise<EdgeFunctionFailure> {
  const context = (error as FunctionsError & { context?: Response })?.context;

  if (context && typeof context.clone === "function") {
    try {
      const payload = await context.clone().json() as Record<string, unknown>;

      // As funções deste projeto respondem `{ error: "codigo" }`, às vezes
      // com um `detail` mais específico ao lado.
      const code = typeof payload.error === "string" ? payload.error : null;
      const detail = typeof payload.detail === "string" ? payload.detail : null;

      if (code) {
        return { code, message: detail ?? MENSAGENS[code] ?? code };
      }
      if (typeof payload.message === "string") {
        return { code: null, message: payload.message };
      }
    } catch {
      // Corpo não era JSON. Cai no genérico abaixo.
    }
  }

  const fallback = error instanceof Error ? error.message : "";
  return {
    code: null,
    message: fallback && !fallback.includes("non-2xx")
      ? fallback
      : "A operação falhou. Tente novamente.",
  };
}
