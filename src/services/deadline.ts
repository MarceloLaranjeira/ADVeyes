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
import {
  buildCalendar,
  parseIsoDate,
  type HolidayInput,
} from "../../supabase/functions/_shared/forensic-calendar.ts";

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
  /**
   * Qual regra de contagem o ramo do processo impôs, e com que firmeza.
   * `confianca: "baixa"` obriga a interface a pedir conferência — é o caso
   * do Juizado Especial e do processo sem ramo identificado.
   */
  regraContagem: {
    modo: "uteis" | "corridos";
    fonte: "cpc" | "clt" | "cpp" | "jec" | "padrao";
    confianca: "alta" | "baixa";
    fundamento: string;
  };
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

/**
 * Quantos dias ÚTEIS faltam até o vencimento. Negativo indica prazo vencido.
 *
 * Contar em dias corridos aqui era mentira confortável: no dia 21 de
 * dezembro, um prazo que vence em 10 de janeiro aparecia como "faltam 20
 * dias", quando na verdade o fórum está em recesso e não há um único dia
 * útil no meio. O advogado que confiasse no número perderia o prazo lendo
 * uma tela que dizia haver folga.
 *
 * Usa o mesmo calendário do cálculo — fins de semana, feriados nacionais e
 * o recesso do art. 220. Feriados de tribunal entram por `feriados`, vindos
 * de `forensic_holidays`; sem eles a conta continua correta para o resto e
 * apenas otimista nos dias em que aquele tribunal específico não abre.
 *
 * O dia de hoje não conta: vencimento hoje devolve zero, e é isso que a
 * interface traduz como "vence hoje".
 */
export function diasUteisAteVencimento(
  vencimento: string,
  hoje = new Date(),
  feriados: HolidayInput[] = [],
): number {
  const alvo = parseIsoDate(vencimento);
  const base = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()),
  );

  if (alvo.getTime() === base.getTime()) return 0;

  const anos = [base.getUTCFullYear(), alvo.getUTCFullYear()];
  const calendario = buildCalendar(
    [...anos, Math.min(...anos) - 1, Math.max(...anos) + 1],
    feriados,
  );

  const vencido = alvo.getTime() < base.getTime();
  const inicio = vencido ? alvo : base;
  const fim = vencido ? base : alvo;

  // Conta os dias úteis no intervalo aberto à esquerda: o dia de partida
  // não entra, o de chegada entra. É a mesma convenção do art. 224.
  let uteis = 0;
  let cursor = new Date(inicio.getTime() + 86_400_000);
  while (cursor.getTime() <= fim.getTime()) {
    if (calendario.nonBusinessReason(cursor) === null) uteis += 1;
    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  return vencido ? -uteis : uteis;
}
