/**
 * Tradução única das falhas vindas das Edge Functions.
 *
 * Toda falha conhecida tem um código estável e uma mensagem específica. O que
 * não é conhecido vira `operation_failed` acompanhado de um identificador de
 * diagnóstico, que o servidor registrou no log — é o que torna a falha
 * rastreável sem expor detalhes internos ao usuário.
 */

export interface EdgeErrorPayload {
  error?: string;
  diagnosticId?: string;
}

export class EdgeFunctionError extends Error {
  readonly code: string;
  readonly diagnosticId: string | null;

  constructor(
    code: string,
    messages: Record<string, string>,
    diagnosticId: string | null = null,
  ) {
    const base = messages[code] ?? messages.operation_failed ??
      "Não foi possível concluir a operação.";
    super(diagnosticId ? `${base} (código ${diagnosticId})` : base);
    this.name = "EdgeFunctionError";
    this.code = code;
    this.diagnosticId = diagnosticId;
  }
}

/**
 * Extrai código e diagnóstico do corpo da resposta. Um erro de rede, um
 * timeout ou um corpo que não é JSON caem no código estável de fallback.
 */
export async function readEdgeError(
  error: unknown,
): Promise<{ code: string; diagnosticId: string | null }> {
  const context = (error as { context?: Response } | null)?.context;
  if (!context) return { code: "operation_failed", diagnosticId: null };

  try {
    const payload = await context.clone().json() as EdgeErrorPayload;
    return {
      code: payload.error ?? "operation_failed",
      diagnosticId: payload.diagnosticId ?? null,
    };
  } catch {
    // Resposta sem JSON (502, HTML de proxy, corpo vazio): o código estável
    // esconde a infraestrutura, mas o status ainda ajuda o diagnóstico.
    return {
      code: "operation_failed",
      diagnosticId: context.status ? `HTTP-${context.status}` : null,
    };
  }
}

/** Mensagem pronta para a interface, já com o código de diagnóstico. */
export function describeEdgeError(error: unknown, fallback: string): string {
  if (error instanceof EdgeFunctionError) return error.message;
  if (error instanceof Error) {
    const diagnosticId = (error as { diagnosticId?: string }).diagnosticId;
    return diagnosticId
      ? `${error.message} (código ${diagnosticId})`
      : error.message;
  }
  return fallback;
}
