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
  /**
   * Regime do CPP aplicado: termo inicial no dia seguinte ao ato, sem
   * protração para dia útil. Só é verdadeiro quando o CPP de fato incide.
   */
  regimePenal: boolean;
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
   * A regra que de fato governou a contagem, e com que firmeza. Nem sempre
   * é a do ramo: o qualificador escrito no ato vence, e a sobreposição do
   * advogado vence os dois.
   * `confianca: "baixa"` obriga a interface a pedir conferência — é o caso
   * do Juizado Especial e do processo sem ramo identificado.
   */
  regraContagem: {
    modo: "uteis" | "corridos";
    fonte: "cpc" | "clt" | "cpp" | "jec" | "padrao" | "ato" | "manual";
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
/**
 * Fuso em que se lê a data civil de um prazo.
 *
 * Prazo processual vence numa data do calendário civil brasileiro, não num
 * instante UTC. `new Date()` avaliado em UTC vira o dia seguinte a partir das
 * 21h no horário de Brasília — então, para quem confere prazo à noite, o
 * cartão classificava como "vence hoje" um prazo que vence amanhã, e como
 * vencido um que ainda vence hoje. É a faixa do dia em que o advogado mais
 * olha para a tela.
 *
 * Fixo em Brasília por ora. Os fusos brasileiros vão de UTC−2 a UTC−5, então
 * um escritório em Manaus ou Rio Branco ainda pode divergir na última hora do
 * dia; fechar isso exige o fuso do escritório em `tenant`, que não existe
 * hoje. Ler a data civil em Brasília erra em uma hora para alguns; ler em UTC
 * errava em três para todos.
 */
const FUSO_FORENSE = "America/Sao_Paulo";

/** A data civil de hoje no fuso forense, como "AAAA-MM-DD". */
export function hojeNoFusoForense(agora = new Date()): string {
  // `en-CA` formata como AAAA-MM-DD, que é o formato que `parseIsoDate` lê.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_FORENSE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function situacaoDoPrazo(
  vencimento: string,
  /**
   * Aceita a data civil como texto ("AAAA-MM-DD"), que é o caminho correto,
   * ou um `Date`, que é lido pelas partes UTC. O padrão resolve o fuso
   * sozinho, então a tela não precisa saber disto.
   */
  hoje: Date | string = hojeNoFusoForense(),
  feriados: HolidayInput[] = [],
): SituacaoPrazo {
  const alvo = parseIsoDate(vencimento);
  const base = typeof hoje === "string"
    ? parseIsoDate(hoje)
    : new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()),
    );

  if (alvo.getTime() === base.getTime()) return { estado: "vence_hoje" };

  // Todos os anos entre as duas pontas, não só as pontas.
  //
  // A lista anterior tinha apenas os dois extremos mais uma folga de um ano
  // para cada lado. Num intervalo que atravessa mais de um ano — um prazo
  // longo aberto no fim de 2026 e vencendo em 2028 —, o ano do meio ficava
  // sem feriados, e cada feriado nacional em dia de semana de 2027 era
  // contado como dia útil. A contagem saía maior do que a real.
  const primeiro = Math.min(base.getUTCFullYear(), alvo.getUTCFullYear()) - 1;
  const ultimo = Math.max(base.getUTCFullYear(), alvo.getUTCFullYear()) + 1;
  const anos: number[] = [];
  for (let ano = primeiro; ano <= ultimo; ano += 1) anos.push(ano);
  const calendario = buildCalendar(anos, feriados);

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
