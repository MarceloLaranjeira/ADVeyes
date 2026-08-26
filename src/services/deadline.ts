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
    /**
     * Feriados que o servidor aplicou — nacionais, do tribunal, do escritório.
     * Vêm na resposta para que a contagem regressiva do cartão use exatamente
     * o mesmo calendário do cálculo.
     */
    feriados: HolidayInput[];
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
 * Situação do prazo em relação a hoje.
 *
 * Um número só não dá conta disto, e a tentativa anterior tinha uma armadilha
 * silenciosa: quando o vencimento caía numa sexta e hoje era sábado, não havia
 * nenhum dia útil no intervalo, então a contagem devolvia `-0`. Em JavaScript
 * `-0 < 0` é falso e `-0 === 0` é verdadeiro, então o cartão anunciava "Vence
 * hoje" para um prazo que já tinha vencido.
 *
 * O mesmo zero ambíguo aparecia do outro lado: em 21/12, um prazo que vence em
 * 11/01 tem zero dias úteis no meio por causa do recesso — e virava "Vence
 * hoje" para uma data a três semanas de distância.
 *
 * A direção agora vem da data do calendário, e a magnitude vem dos dias úteis.
 * São perguntas diferentes e param de se confundir.
 */
export type SituacaoPrazo =
  | { estado: "vence_hoje" }
  | { estado: "a_vencer"; diasUteis: number }
  | { estado: "vencido"; diasUteis: number };

/**
 * Calcula a situação pelo mesmo calendário do prazo: fins de semana, feriados
 * nacionais e o recesso do art. 220.
 *
 * `feriados` recebe o calendário do tribunal devolvido junto com a proposta.
 * Sem ele a conta continua certa para o resto e apenas otimista nos dias em
 * que aquele tribunal específico não abre — por isso quem tiver a lista deve
 * passá-la.
 */
export function situacaoDoPrazo(
  vencimento: string,
  hoje = new Date(),
  feriados: HolidayInput[] = [],
): SituacaoPrazo {
  const alvo = parseIsoDate(vencimento);
  const base = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()),
  );

  if (alvo.getTime() === base.getTime()) return { estado: "vence_hoje" };

  const anos = [base.getUTCFullYear(), alvo.getUTCFullYear()];
  const calendario = buildCalendar(
    [...anos, Math.min(...anos) - 1, Math.max(...anos) + 1],
    feriados,
  );

  const vencido = alvo.getTime() < base.getTime();
  const inicio = vencido ? alvo : base;
  const fim = vencido ? base : alvo;

  // Intervalo aberto à esquerda: o dia de partida não entra, o de chegada
  // entra. É a mesma convenção do art. 224.
  let diasUteis = 0;
  let cursor = new Date(inicio.getTime() + 86_400_000);
  while (cursor.getTime() <= fim.getTime()) {
    if (calendario.nonBusinessReason(cursor) === null) diasUteis += 1;
    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  return vencido
    ? { estado: "vencido", diasUteis }
    : { estado: "a_vencer", diasUteis };
}
