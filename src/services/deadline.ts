/**
 * Proposta de prazo a partir de uma publicação.
 *
 * O serviço só busca a proposta. Confirmar continua sendo a
 * `review-publication-deadline`, que já existia — a interface calcula com
 * este serviço, o advogado confere, e a confirmação segue pelo caminho de
 * sempre. Cálculo é opinião do sistema; tarefa é decisão de quem assina.
 */

import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";

/** Quão firme é a leitura do prazo. Decide o peso visual na interface. */
export type ConfiancaPrazo =
  | "explicito"
  | "inferido"
  | "residual"
  | "manual";

export interface DiaNaoUtil {
  date: string;
  reason?: string;
}

export interface PropostaPrazo {
  numeroProcesso: string | null;
  tribunal: string | null;
  /** Ato processual reconhecido, quando houver. */
  ato: string | null;
  dias: number;
  diasCorridos: boolean;
  intimacaoPessoal: boolean;
  confianca: ConfiancaPrazo;
  /** Por que este número de dias foi aplicado. */
  fundamentoDoPrazo: string;
  /** Trecho da publicação que sustentou a leitura. */
  trecho: string | null;
  disponibilizacao: string;
  publicacao: string;
  termoInicial: string;
  vencimento: string;
  diasUteisContados: number;
  diasNaoUteis: DiaNaoUtil[];
  /** Artigos do CPC aplicados, na ordem em que incidiram. */
  fundamentos: string[];
  /** Pontos que exigem conferência humana antes de confirmar. */
  alertas: string[];
  calendario: {
    tribunal: string | null;
    feriadosDoTribunal: number;
    cobertura: "tribunal" | "nacional";
  };
}

const messages: Record<string, string> = {
  unauthorized: "Sua sessão expirou. Entre novamente.",
  permission_denied: "Você não tem acesso a este escritório.",
  invalid_payload: "Confira os dados informados.",
  invalid_date: "A data informada não é válida.",
  publication_not_found: "A publicação não está mais disponível.",
  missing_publication_date:
    "A publicação não tem data de disponibilização, então o prazo não pode " +
    "ser calculado. Informe a data manualmente.",
  computation_failed:
    "Não foi possível fechar a contagem com os dados informados.",
  operation_failed: "Não foi possível calcular o prazo agora.",
};

export class DeadlineError extends Error {
  constructor(public readonly code: string) {
    super(messages[code] ?? messages.operation_failed);
  }
}

interface ComputeInput {
  tenantId: string;
  /** Publicação já ingerida. */
  publicationId?: string;
  /** Modo avulso, para simular sem publicação cadastrada. */
  texto?: string;
  disponibilizacao?: string;
  tribunal?: string;
  /** Correções do advogado sobre a leitura automática. */
  override?: {
    dias?: number;
    diasCorridos?: boolean;
    intimacaoPessoal?: boolean;
  };
}

export const deadlineService = {
  async compute(input: ComputeInput): Promise<PropostaPrazo> {
    const { data, error } = await withTimeout(
      supabase.functions.invoke("legal-compute-deadline", { body: input }),
      20_000,
    );

    if (error) {
      const context = (error as { context?: Response }).context;
      let payload: Record<string, unknown> = {};
      if (context) {
        try {
          payload = await context.clone().json() as Record<string, unknown>;
        } catch {
          // Mantém um erro estável e sem dado sensível para a interface.
        }
      }
      throw new DeadlineError(
        typeof payload.error === "string" ? payload.error : "operation_failed",
      );
    }

    return (data as { proposta: PropostaPrazo }).proposta;
  },
};

/* ------------------------------------------------------------------ */
/* Apresentação                                                        */
/* ------------------------------------------------------------------ */

/**
 * Quanto a interface deve insistir para o advogado ler o inteiro teor.
 * Confiança baixa não bloqueia — apenas pede mais atenção.
 */
export function pesoDaConfianca(
  confianca: ConfiancaPrazo,
): { rotulo: string; exigeLeitura: boolean } {
  switch (confianca) {
    case "explicito":
      return { rotulo: "Prazo escrito na publicação", exigeLeitura: false };
    case "manual":
      return { rotulo: "Prazo informado por você", exigeLeitura: false };
    case "inferido":
      return { rotulo: "Prazo deduzido do ato", exigeLeitura: true };
    case "residual":
      return { rotulo: "Prazo residual da lei", exigeLeitura: true };
  }
}

/** Dias corridos entre hoje e o vencimento. Negativo indica prazo vencido. */
export function diasAteVencimento(
  vencimento: string,
  hoje = new Date(),
): number {
  const alvo = new Date(`${vencimento}T00:00:00.000Z`);
  const base = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()),
  );
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
}
