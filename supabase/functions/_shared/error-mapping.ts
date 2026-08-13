/**
 * Tradução de erro para o registro de sincronização.
 *
 * O cliente do Supabase devolve falha como objeto simples, não como `Error`.
 * Quando esse objeto é repassado por `throw` — o que acontece em vários
 * pontos da ingestão — ele não casa com `instanceof Error`, e o tratamento
 * anterior caía no genérico: gravava `provider_error` / `operation_failed` e
 * jogava fora a mensagem real do banco.
 *
 * O efeito prático era pior do que parece. Cinco falhas seguidas pausam a
 * fonte por `max_retries`, que é definitivo e exige reativação manual — e
 * quem fosse investigar encontrava duas palavras genéricas, sem SQLSTATE,
 * sem constraint, sem pista nenhuma.
 *
 * Módulo puro de propósito: sem importações, para poder ser testado pelo
 * vitest do frontend.
 */

export interface PostgrestLike {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** Reconhece o formato de erro do Supabase. `Error` não conta. */
export function asPostgrestError(error: unknown): PostgrestLike | null {
  if (!error || typeof error !== "object" || error instanceof Error) return null;
  const candidate = error as Record<string, unknown>;
  return typeof candidate.message === "string"
    ? (candidate as unknown as PostgrestLike)
    : null;
}

/**
 * Código estável do erro do banco, quando houver. O SQLSTATE identifica a
 * causa melhor que qualquer rótulo nosso: `23505` é violação de unicidade,
 * `23503` é chave estrangeira, `42501` é permissão negada pela RLS.
 */
export function postgrestErrorCode(error: unknown): string | null {
  const postgrest = asPostgrestError(error);
  return postgrest?.code ? `db_${postgrest.code}` : null;
}

/** Mensagem legível, com no máximo 500 caracteres. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);

  const postgrest = asPostgrestError(error);
  if (postgrest) {
    return [postgrest.message, postgrest.details, postgrest.hint]
      .filter((part): part is string => Boolean(part))
      .join(" · ")
      .slice(0, 500);
  }

  return "operation_failed";
}
