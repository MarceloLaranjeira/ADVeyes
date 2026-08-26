/**
 * Qual regra de contagem se aplica a um processo.
 *
 * O motor de prazo (`forensic-calendar.ts`) já sabe contar: recebe
 * `diasCorridos` e obedece. O que faltava era alguém decidir esse booleano.
 * Até aqui ele vinha só do texto da publicação — quando o texto dizia "dias
 * corridos" com todas as letras. Fora disso, tudo caía no padrão do CPC.
 *
 * Isso é errado em dois ramos, e o erro é do tipo que faz perder prazo:
 *
 *   Penal — CPP, art. 798: os prazos são contínuos, não se interrompem por
 *           férias, domingo ou feriado. Contar em dias úteis num processo
 *           criminal estica a data fatal e entrega o prazo perdido com
 *           aparência de folga.
 *
 *   Trabalhista — CLT, art. 775 (Lei 13.467/2017): conta-se em dias úteis
 *           como no CPC, mas por base legal própria. O modo é o mesmo; a
 *           fundamentação exibida ao advogado não pode citar o artigo errado.
 *
 * E há um caso que ninguém resolve por dedução: o Juizado Especial. A
 * aplicação do art. 219 do CPC aos Juizados é controversa, com entendimento
 * dividido. Aqui ele não é adivinhado — sai marcado com confiança baixa e
 * aviso, para o advogado confirmar.
 *
 * Nada nesta decisão é definitivo. O prazo continua editável e continua
 * rotulado como sugerido, conforme a regra do módulo. O resolver serve para
 * que o palpite inicial seja o melhor possível, e para que a incerteza
 * apareça em vez de ficar escondida atrás de um número.
 *
 * Módulo puro: sem importações, sem rede, sem banco.
 */

/** Dias úteis (CPC 219, CLT 775) ou contínuos (CPP 798). */
export type CountingMode = "uteis" | "corridos";

/** De qual diploma saiu a regra. Decide o texto do fundamento. */
export type RuleSource = "cpc" | "clt" | "cpp" | "jec" | "padrao";

/**
 * `baixa` não bloqueia nada — apenas obriga a interface a pedir conferência
 * antes de tratar a data como boa.
 */
export type RuleConfidence = "alta" | "baixa";

export interface ProcessRuleInput {
  /** `processos.area`, texto livre preenchido no cadastro. */
  area?: string | null;
  /** `processos.vara` — é aqui que "Juizado Especial" costuma aparecer. */
  vara?: string | null;
  tribunal?: string | null;
  /** `processos.adjudicating_body`, quando veio do tribunal. */
  adjudicatingBody?: string | null;
}

export interface CountingRule {
  modo: CountingMode;
  fonte: RuleSource;
  confianca: RuleConfidence;
  /** Base legal, no formato usado por `fundamentos[]` do motor. */
  fundamento: string;
  /** Presente só quando algo precisa da atenção de quem assina. */
  aviso?: string;
}

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */

/**
 * Remove acentos e caixa para comparar texto digitado à mão.
 *
 * O cadastro aceita área livre e as telas oferecem listas diferentes
 * ("Criminal" no CRM, "Penal" no processo), então comparar string crua
 * erraria em metade dos casos reais.
 */
function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Junta os campos que podem revelar o juízo, para uma varredura só. */
function juizoText(input: ProcessRuleInput): string {
  return [input.vara, input.adjudicatingBody, input.tribunal]
    .map(normalize)
    .filter(Boolean)
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Detecção                                                            */
/* ------------------------------------------------------------------ */

/**
 * Juizado Especial — cível, federal ou da fazenda.
 *
 * Procurado no juízo, não na área, porque não existe área "Juizado": o
 * processo é cadastrado como Cível e só a vara denuncia o rito.
 */
const JEC_PATTERNS = [
  /juizado especial/,
  /\bjec\b/,
  /\bjef\b/,
  /\bjecc\b/,
  /turma recursal/,
  /pequenas causas/,
];

/** Varas e órgãos criminais, quando a área não foi preenchida direito. */
const CRIMINAL_JUIZO_PATTERNS = [
  /\bcriminal\b/,
  /\bcrime\b/,
  /execucao penal/,
  /\bjuri\b/,
  /violencia domestica/,
];

const CRIMINAL_AREAS = [
  "penal",
  "criminal",
  "execucao penal",
  "direito penal",
  "processo penal",
];

const LABOR_AREAS = [
  "trabalhista",
  "trabalho",
  "direito do trabalho",
];

/** Varas e tribunais trabalhistas — TRT, vara do trabalho. */
const LABOR_JUIZO_PATTERNS = [
  /vara do trabalho/,
  /\btrt\b/,
  /\btst\b/,
  /justica do trabalho/,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function areaMatches(area: string, candidates: string[]): boolean {
  return candidates.some((candidate) => area.includes(candidate));
}

/* ------------------------------------------------------------------ */
/* Resolver                                                            */
/* ------------------------------------------------------------------ */

/**
 * Decide o modo de contagem a partir do que se sabe do processo.
 *
 * A ordem importa e não é arbitrária. O penal vem primeiro porque é o único
 * que muda o modo de contagem, e errá-lo estica a data fatal — inclusive no
 * Juizado Especial Criminal, que casa com "juizado especial" e seria
 * classificado como Juizado cível por um teste genérico posto antes dele.
 * Depois vem o Juizado cível, que é o caso em que a resposta é "não sei" e
 * precisa sair marcado como tal. Trabalhista só troca a fundamentação. O
 * resto cai no CPC.
 *
 * Quando nada identifica o ramo, o retorno é o padrão do CPC com confiança
 * baixa: é o palpite certo na maioria dos casos, mas quem assina precisa
 * saber que foi palpite.
 */
export function resolverRegraContagem(
  input: ProcessRuleInput,
): CountingRule {
  const area = normalize(input.area);
  const juizo = juizoText(input);

  const ehCriminal = areaMatches(area, CRIMINAL_AREAS) ||
    matchesAny(juizo, CRIMINAL_JUIZO_PATTERNS);
  const ehJuizado = matchesAny(juizo, JEC_PATTERNS);

  // Penal — prazos contínuos. É o ramo em que errar estica a data, então ele
  // é avaliado antes de tudo, inclusive antes do Juizado.
  //
  // O Juizado Especial Criminal existe, e a versão anterior desta função o
  // classificava como Juizado genérico porque a vara casa com "juizado
  // especial" antes de qualquer teste criminal. O resultado era dias úteis
  // num processo criminal — exatamente a data fatal esticada que o resolver
  // foi escrito para evitar.
  if (ehCriminal) {
    return {
      modo: "corridos",
      fonte: "cpp",
      // No JECrim somam-se duas incertezas: o rito da Lei 9.099 e a
      // contagem criminal. Corridos é o padrão mais seguro, porque adianta
      // a data fatal em vez de atrasá-la — mas quem assina precisa conferir.
      confianca: ehJuizado ? "baixa" : "alta",
      fundamento: ehJuizado
        ? "CPP, art. 798 — prazos contínuos, aplicados ao rito criminal da " +
          "Lei 9.099/1995."
        : "CPP, art. 798 — os prazos são contínuos e peremptórios, não se " +
          "interrompendo por férias, domingo ou dia feriado.",
      aviso: ehJuizado
        ? "Processo criminal em Juizado Especial: a contagem foi feita em " +
          "dias corridos pelo CPP, que adianta a data fatal em relação aos " +
          "dias úteis. A regra aplicável ao rito da Lei 9.099 é " +
          "controvertida — confirme antes de usar como prazo fatal."
        : "Prazo criminal contado em dias corridos. Se este ato seguir rito " +
          "cível, ajuste o modo de contagem.",
    };
  }

  // Juizado Especial cível — rito próprio, contagem controvertida.
  if (ehJuizado) {
    return {
      modo: "uteis",
      fonte: "jec",
      confianca: "baixa",
      fundamento:
        "Lei 9.099/1995 — rito dos Juizados Especiais; contagem em dias " +
        "úteis por aplicação subsidiária do CPC, art. 219.",
      aviso:
        "Processo em Juizado Especial: a aplicação da contagem em dias " +
        "úteis do CPC ao rito da Lei 9.099 é controvertida. Confirme a " +
        "data antes de usá-la como prazo fatal.",
    };
  }

  // Trabalhista — dias úteis, mas por diploma próprio.
  if (
    areaMatches(area, LABOR_AREAS) ||
    matchesAny(juizo, LABOR_JUIZO_PATTERNS)
  ) {
    return {
      modo: "uteis",
      fonte: "clt",
      confianca: "alta",
      fundamento:
        "CLT, art. 775 — prazos contados em dias úteis, na redação da Lei " +
        "13.467/2017.",
    };
  }

  // Cível e demais ramos identificados.
  if (area) {
    return {
      modo: "uteis",
      fonte: "cpc",
      confianca: "alta",
      fundamento: "CPC, art. 219 — computados somente os dias úteis.",
    };
  }

  // Nada identificado: padrão do CPC, assumido como palpite.
  return {
    modo: "uteis",
    fonte: "padrao",
    confianca: "baixa",
    fundamento: "CPC, art. 219 — computados somente os dias úteis.",
    aviso:
      "Ramo do processo não identificado; aplicada a regra geral do CPC. " +
      "Confirme se a contagem deste processo é em dias úteis.",
  };
}

/**
 * Ponte para o motor, que fala em `diasCorridos`.
 *
 * A leitura da publicação tem a palavra final, nos dois sentidos. Um booleano
 * sozinho não dava conta disso: "5 dias úteis" escrito com todas as letras e
 * "5 dias" sem qualificador chegavam aqui os dois como `false`, e a regra do
 * ramo passava por cima dos dois igualmente.
 *
 * O caso que isso quebrava é real: num processo criminal em que o juiz
 * determinou "prazo de 5 dias úteis", o CPP diria corridos, mas o que foi
 * expressamente ordenado são dias úteis — e a data fatal calculada saía
 * diferente da devida.
 *
 * Por isso a ponte recebe o qualificador, e não o booleano. Quando o ato se
 * pronunciou, ele decide. Quando calou, decide o ramo.
 */
export function aplicarRegraAoMotor(
  regra: CountingRule,
  qualificadorDaPublicacao: "uteis" | "corridos" | null,
): boolean {
  if (qualificadorDaPublicacao === "corridos") return true;
  if (qualificadorDaPublicacao === "uteis") return false;
  return regra.modo === "corridos";
}
