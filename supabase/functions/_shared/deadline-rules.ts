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
export type RuleSource =
  | "cpc"
  | "clt"
  | "cpp"
  | "jec"
  | "padrao"
  /** O próprio ato determinou o modo, com todas as letras. */
  | "ato"
  /** O advogado sobrepôs o modo de contagem. */
  | "manual";

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
/**
 * Vocabulário de área que identifica o ramo cível e afins.
 *
 * Esta lista já foi o inverso — uma relação de valores que *não* identificam
 * ramo ("A definir", "Recurso", "Outros"), com tudo o mais tratado como
 * cível confirmado. A inversão foi forçada por como a área é realmente
 * preenchida, que não é por um advogado escolhendo um ramo:
 *
 *   - `confirm_legal_process_candidate` grava `'A definir'` na importação.
 *   - `ProcessoForm.tsx` e `CRM.tsx` oferecem listas diferentes, misturando
 *     ramo e fase processual ("Recurso" ao lado de "Penal").
 *   - `legal-ingestion.ts` grava `metadata.className` cru, que é a classe
 *     processual do tribunal. Aí entram "Habeas Corpus", "Inquérito
 *     Policial", "Ação Penal" — texto que nenhuma lista de exclusões
 *     prevê, porque o conjunto de classes CNJ é aberto.
 *
 * Enquanto a lista era de exclusões, cada valor não previsto virava cível
 * com confiança alta e sem aviso: um habeas corpus contado em dias úteis,
 * com a data fatal esticada e nada na tela sinalizando. Era a quinta vez que
 * o mesmo campo produzia o mesmo defeito por uma porta diferente.
 *
 * Com a lista de inclusões, o desconhecido cai no ramo não identificado —
 * mesmo modo de contagem, mas com confiança baixa e aviso. O palpite não
 * muda; o que muda é o sistema admitir que é palpite.
 *
 * Penal e trabalhista não estão aqui: têm listas próprias, avaliadas antes.
 */
const CIVIL_AREAS = [
  "civel",
  "civil",
  "familia",
  "sucessoes",
  "inventario",
  "consumidor",
  "empresarial",
  "societario",
  "falencia",
  "recuperacao judicial",
  "tributario",
  "fiscal",
  "previdenciario",
  "administrativo",
  "ambiental",
  "imobiliario",
  "locacao",
  "contratual",
  "contratos",
  "indenizatoria",
  "responsabilidade civil",
  "bancario",
  "saude",
  "eleitoral",
  "fazenda publica",
];

function areaIdentificada(area: string): boolean {
  return areaMatches(area, CIVIL_AREAS);
}

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

// "penal" já casa por substring com "ação penal", "execução penal" e
// "direito penal", então a lista só precisa nomear o que não contém a
// palavra. As últimas entradas são classes processuais do CNJ, que chegam
// cruas em `processos.area` pela importação (`legal-ingestion.ts` grava
// `metadata.className`) — reconhecê-las aqui é melhor do que deixá-las
// caírem no ramo não identificado, porque o modo de contagem muda.
const CRIMINAL_AREAS = [
  "penal",
  "criminal",
  "crime",
  "inquerito",
  "habeas corpus",
  "termo circunstanciado",
  "juri",
];

const LABOR_AREAS = [
  "trabalhista",
  "trabalho",
  "direito do trabalho",
];

/** Varas e tribunais trabalhistas — TRT, vara do trabalho. */
//
// O dígito é caractere de palavra, então `\btrt\b` NÃO casa com "TRT11" —
// e "TRT11" é justamente o formato que a tela de configurações oferece.
// Sem `\d*`, o processo caía no ramo genérico com confiança alta e exibia
// fundamento do CPC onde deveria citar a CLT.
const LABOR_JUIZO_PATTERNS = [
  /vara do trabalho/,
  /\btrt\s?\d*\b/,
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

  // Cível e ramos afins, reconhecidos pelo vocabulário conhecido.
  //
  // Só entra aqui quem foi nomeado. Área não reconhecida — classe processual
  // importada do tribunal, "A definir", fase processual no lugar de ramo —
  // cai no bloco seguinte, com o mesmo modo de contagem mas com aviso.
  if (areaIdentificada(area)) {
    return {
      modo: "uteis",
      fonte: "cpc",
      confianca: "alta",
      fundamento: "CPC, art. 219 — computados somente os dias úteis.",
    };
  }

  // Ramo não reconhecido: padrão do CPC, assumido como palpite.
  //
  // Este é o destino de tudo que não foi nomeado, e é para cá que passou a
  // vir a maior parte da carteira importada. O modo de contagem é o mesmo do
  // cível — continua sendo o palpite certo na maioria dos casos —, mas sai
  // com confiança baixa e aviso, para a tela pedir conferência em vez de
  // apresentar a data como calculada.
  return {
    modo: "uteis",
    fonte: "padrao",
    confianca: "baixa",
    fundamento: "CPC, art. 219 — computados somente os dias úteis.",
    aviso:
      "Ramo do processo não identificado a partir da área cadastrada; " +
      "aplicada a regra geral do CPC. Se este processo for criminal, a " +
      "contagem correta é em dias corridos (CPP, art. 798) e a data " +
      "sugerida está mais longa que a real. Confirme antes de usá-la como " +
      "prazo fatal.",
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

/**
 * A regra que de fato governou o cálculo, para a trilha de auditoria.
 *
 * `resolverRegraContagem` devolve o que o RAMO diz. Mas o ramo nem sempre
 * decide: o qualificador escrito no ato vence, e a sobreposição do advogado
 * vence os dois. Exibir a regra do ramo nesses casos produz trilha
 * contraditória — o cartão afirmaria "CPP, prazos contínuos" ao lado de uma
 * contagem em dias úteis que o juiz determinou.
 *
 * Esta função devolve quem realmente decidiu, para que a tela mostre isso.
 */
export function regraEfetiva(
  regraDoRamo: CountingRule,
  qualificadorDaPublicacao: "uteis" | "corridos" | null,
  overrideDoAdvogado: boolean | undefined,
): CountingRule {
  if (overrideDoAdvogado !== undefined) {
    return {
      modo: overrideDoAdvogado ? "corridos" : "uteis",
      fonte: "manual",
      confianca: "alta",
      fundamento: overrideDoAdvogado
        ? "Contagem em dias corridos informada pelo advogado."
        : "Contagem em dias úteis informada pelo advogado.",
    };
  }

  if (qualificadorDaPublicacao !== null) {
    return {
      modo: qualificadorDaPublicacao === "corridos" ? "corridos" : "uteis",
      fonte: "ato",
      confianca: "alta",
      fundamento: qualificadorDaPublicacao === "corridos"
        ? "Contagem em dias corridos declarada na própria publicação."
        : "Contagem em dias úteis declarada na própria publicação.",
    };
  }

  return regraDoRamo;
}
