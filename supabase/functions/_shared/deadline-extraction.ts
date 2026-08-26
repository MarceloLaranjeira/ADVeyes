/**
 * Leitura do prazo a partir do texto da publicação.
 *
 * O sistema tinha apenas um regex que respondia "talvez exista um prazo
 * aqui". Este módulo responde três coisas: quantos dias, de que ato, e com
 * que grau de certeza — e nunca esconde a incerteza de quem vai assinar.
 *
 * Três níveis de confiança, do mais forte ao mais fraco:
 *
 *   explicito — o texto diz o número de dias. É o que mais aparece.
 *   inferido  — o ato foi reconhecido e o prazo vem da lei (ex.: embargos
 *               de declaração, 5 dias, art. 1.023).
 *   residual  — nada foi reconhecido; aplica-se o art. 218, §3 (5 dias).
 *
 * Nenhum nível autoriza gravar prazo sozinho. A saída alimenta uma proposta
 * que só vira tarefa depois da confirmação humana.
 *
 * Módulo puro de propósito: sem importações, sem rede, sem banco.
 */

export type DeadlineConfidence = "explicito" | "inferido" | "residual";

export interface ExtractedDeadline {
  dias: number;
  diasCorridos: boolean;
  /**
   * O qualificador que o ato usou, quando usou algum.
   *
   * `diasCorridos` sozinho nao distingue "5 dias uteis" escrito com todas as
   * letras de "5 dias" sem qualificador — os dois viram `false`. A diferenca
   * importa: num processo criminal a regra do ramo impoe dias corridos, mas
   * se o juiz escreveu "uteis" e o sistema contar corrido, a data fatal sai
   * diferente da que foi expressamente determinada.
   */
  qualificadorExplicito: "uteis" | "corridos" | null;
  confianca: DeadlineConfidence;
  /** Ato processual reconhecido, quando houver. */
  ato: string | null;
  /** Fundamento do prazo aplicado. */
  fundamento: string;
  /** Trecho do texto que sustentou a leitura. */
  trecho: string | null;
  /** Pontos que exigem conferência humana antes de confirmar. */
  alertas: string[];
}

/* ------------------------------------------------------------------ */
/* Numerais por extenso                                                */
/* ------------------------------------------------------------------ */

const NUMERAIS: Record<string, number> = {
  um: 1,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  sessenta: 60,
};

/** Remove acentos e normaliza espaços para comparação estável. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Prazos legais por ato                                               */
/* ------------------------------------------------------------------ */

interface ActRule {
  /** Expressão que identifica o ato no texto já normalizado. */
  pattern: RegExp;
  ato: string;
  dias: number;
  fundamento: string;
}

/**
 * Prazos que a lei fixa. Só entram atos cujo prazo é estável e não depende
 * de circunstância do processo — o resto fica para a leitura explícita.
 */
const ACT_RULES: ActRule[] = [
  {
    pattern: /embargos de declarac/,
    ato: "Embargos de declaração",
    dias: 5,
    fundamento: "CPC, art. 1.023 — cinco dias.",
  },
  {
    pattern: /contestac/,
    ato: "Contestação",
    dias: 15,
    fundamento: "CPC, art. 335 — quinze dias.",
  },
  {
    pattern: /agravo interno/,
    ato: "Agravo interno",
    dias: 15,
    fundamento: "CPC, art. 1.021, §2º — quinze dias.",
  },
  {
    pattern: /agravo de instrumento/,
    ato: "Agravo de instrumento",
    dias: 15,
    fundamento: "CPC, art. 1.003, §5º — quinze dias.",
  },
  {
    pattern: /(apelac|recurso de apelac)/,
    ato: "Apelação",
    dias: 15,
    fundamento: "CPC, art. 1.003, §5º — quinze dias.",
  },
  {
    pattern: /recurso (especial|extraordinario)/,
    ato: "Recurso especial ou extraordinário",
    dias: 15,
    fundamento: "CPC, art. 1.003, §5º — quinze dias.",
  },
  {
    pattern: /impugnac.{0,30}cumprimento de sentenc/,
    ato: "Impugnação ao cumprimento de sentença",
    dias: 15,
    fundamento: "CPC, art. 525 — quinze dias.",
  },
  {
    pattern: /embargos a execuc/,
    ato: "Embargos à execução",
    dias: 15,
    fundamento: "CPC, art. 915 — quinze dias.",
  },
  {
    pattern: /(replica|impugnac.{0,20}contestac)/,
    ato: "Réplica",
    dias: 15,
    fundamento: "CPC, art. 351 — quinze dias.",
  },
  {
    pattern: /especificac.{0,20}provas/,
    ato: "Especificação de provas",
    dias: 5,
    fundamento: "CPC, art. 218, §3º — cinco dias na omissão da lei.",
  },
];

/* ------------------------------------------------------------------ */
/* Situações que exigem conferência                                    */
/* ------------------------------------------------------------------ */

interface WarningRule {
  pattern: RegExp;
  message: string;
}

/**
 * Circunstâncias que alteram o prazo mas que o texto da publicação não
 * permite confirmar sozinho. O sistema não aplica o multiplicador; avisa.
 */
const WARNING_RULES: WarningRule[] = [
  {
    pattern: /(fazenda publica|uniao|estado d|municipio d|autarquia|inss)/,
    message:
      "Possível Fazenda Pública no polo: o prazo pode ser em dobro " +
      "(CPC, art. 183). Confira antes de confirmar.",
  },
  {
    pattern: /(ministerio publico|promotor|procurador de justica)/,
    message:
      "Ministério Público envolvido: prazo em dobro (CPC, art. 180). " +
      "Confira antes de confirmar.",
  },
  {
    pattern: /defensoria publica/,
    message:
      "Defensoria Pública envolvida: prazo em dobro (CPC, art. 186). " +
      "Confira antes de confirmar.",
  },
  {
    pattern: /litisconsor/,
    message:
      "Litisconsórcio citado: se houver procuradores distintos em autos " +
      "físicos, o prazo é em dobro (CPC, art. 229).",
  },
  {
    // Este aviso afirmava "contam-se em dias corridos" como fato. O
    // resolver de ramo calcula o Juizado em dias úteis, então os dois
    // chegavam juntos ao cartão dizendo o oposto um do outro sobre a mesma
    // data. A controvérsia é real; a certeza é que não era.
    pattern: /(juizado especial|lei 9.?099)/,
    message:
      "Juizado Especial: a contagem no rito da Lei 9.099/95 é " +
      "controvertida. Confira o rito antes de usar a data como prazo fatal.",
  },
  {
    pattern: /intimac.{0,20}pessoal/,
    message:
      "Intimação pessoal mencionada: o termo inicial pode não ser a " +
      "publicação no diário.",
  },
];

/* ------------------------------------------------------------------ */
/* Extração                                                            */
/* ------------------------------------------------------------------ */

/**
 * Captura "prazo de 15 (quinze) dias", "em 5 dias úteis", "prazo: 10 dias"
 * e variações. O numeral por extenso entre parênteses é redundante no texto
 * jurídico, então o dígito tem precedência e o extenso serve de conferência.
 */
const EXPLICIT_PATTERN =
  /(?:prazo\s*(?:de|:)?\s*|dentro\s+de\s+|em\s+)(\d{1,3})\s*(?:\(\s*([a-z\s]{3,20})\s*\)\s*)?dias?(\s+uteis|\s+corridos)?/;

/** Fallback para o caso de o número vir só por extenso. */
const WORD_ONLY_PATTERN =
  /(?:prazo\s*(?:de|:)?\s*|dentro\s+de\s+|em\s+)([a-z]{3,12})\s*dias?(\s+uteis|\s+corridos)?/;

function findWarnings(normalized: string): string[] {
  return WARNING_RULES
    .filter((rule) => rule.pattern.test(normalized))
    .map((rule) => rule.message);
}

function findAct(normalized: string): ActRule | null {
  return ACT_RULES.find((rule) => rule.pattern.test(normalized)) ?? null;
}

/**
 * Lê o prazo de uma publicação.
 *
 * Sempre devolve um resultado — nunca `null` — porque o art. 218, §3 dá a
 * regra residual de cinco dias. O que muda é a confiança, e é ela que
 * decide se a interface pede mais atenção do advogado.
 */
export function extractDeadline(content: string): ExtractedDeadline {
  const normalized = normalize(content ?? "");
  const alertas = findWarnings(normalized);
  const act = findAct(normalized);

  const explicitMatch = EXPLICIT_PATTERN.exec(normalized);
  if (explicitMatch) {
    const dias = Number(explicitMatch[1]);
    const porExtenso = explicitMatch[2]?.trim();
    const qualificador = explicitMatch[3]?.trim();

    if (Number.isInteger(dias) && dias > 0 && dias <= 365) {
      // O texto jurídico repete o número por extenso. Divergência entre o
      // dígito e o extenso costuma indicar erro de digitação na publicação,
      // e é exatamente o tipo de coisa que faz perder prazo.
      if (porExtenso) {
        const esperado = NUMERAIS[porExtenso.replace(/\s/g, "")];
        if (esperado !== undefined && esperado !== dias) {
          alertas.push(
            `A publicação diz "${dias}" em algarismo e "${porExtenso}" por ` +
              "extenso. Confira o prazo no inteiro teor antes de confirmar.",
          );
        }
      }

      return {
        dias,
        diasCorridos: qualificador === "corridos",
        qualificadorExplicito: qualificador === "corridos"
          ? "corridos"
          : qualificador === "uteis"
            ? "uteis"
            : null,
        confianca: "explicito",
        ato: act?.ato ?? null,
        // O fundamento diz de onde saiu o NÚMERO de dias, e só isso. O modo
        // de contagem e sua base legal vêm do resolver de ramo, que sabe se
        // o processo corre pelo CPC, pela CLT ou pelo CPP — afirmar aqui
        // "dias úteis na forma do art. 219" produzia justificativa
        // contraditória num processo criminal.
        fundamento: qualificador === "corridos"
          ? "Prazo em dias corridos declarado na própria publicação."
          : qualificador === "uteis"
            ? "Prazo em dias úteis declarado na própria publicação."
            : "Prazo declarado na própria publicação.",
        trecho: explicitMatch[0],
        alertas,
      };
    }
  }

  const wordMatch = WORD_ONLY_PATTERN.exec(normalized);
  if (wordMatch) {
    const dias = NUMERAIS[wordMatch[1]];
    if (dias !== undefined) {
      const qualificadorPorExtenso = wordMatch[2]?.trim();
      return {
        dias,
        diasCorridos: qualificadorPorExtenso === "corridos",
        qualificadorExplicito: qualificadorPorExtenso === "corridos"
          ? "corridos"
          : qualificadorPorExtenso === "uteis"
            ? "uteis"
            : null,
        confianca: "explicito",
        ato: act?.ato ?? null,
        fundamento: "Prazo declarado por extenso na publicação.",
        trecho: wordMatch[0],
        alertas,
      };
    }
  }

  if (act) {
    return {
      dias: act.dias,
      diasCorridos: false,
      qualificadorExplicito: null,
      confianca: "inferido",
      ato: act.ato,
      fundamento: act.fundamento,
      trecho: null,
      alertas: [
        ...alertas,
        "O prazo não estava escrito na publicação; foi aplicado o prazo " +
        `legal de ${act.ato.toLowerCase()}. Confira o inteiro teor.`,
      ],
    };
  }

  return {
    dias: 5,
    diasCorridos: false,
    qualificadorExplicito: null,
    confianca: "residual",
    ato: null,
    fundamento: "CPC, art. 218, §3º — cinco dias quando a lei é omissa.",
    trecho: null,
    alertas: [
      ...alertas,
      "Nem o prazo nem o ato foram reconhecidos no texto. O prazo residual " +
      "de cinco dias é apenas um ponto de partida — leia o inteiro teor.",
    ],
  };
}
