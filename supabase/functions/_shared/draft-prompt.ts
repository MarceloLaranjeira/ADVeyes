/**
 * Construção do pedido de minuta.
 *
 * O risco central de IA em direito não é escrever mal — é **inventar**.
 * Jurisprudência fabricada já rendeu sanção a advogado em vários tribunais,
 * e um modelo pedindo para "redigir uma petição" preenche lacunas com
 * plausibilidade quando não tem fato. Por isso a instrução de sistema aqui
 * é construída em torno de duas regras acima de qualquer outra: não citar
 * o que não foi fornecido, e marcar o que falta em vez de imaginar.
 *
 * A minuta é sempre um rascunho para revisão. Nada aqui grava, protocola ou
 * assina — o produto é texto que o advogado corrige.
 *
 * Módulo puro de propósito: sem importações, para ser testado pelo vitest.
 */

export type TipoPeca =
  | "contestacao"
  | "embargos_declaracao"
  | "apelacao"
  | "replica"
  | "manifestacao"
  | "peticao_simples";

export interface ContextoMinuta {
  tipo: TipoPeca;
  numeroProcesso: string | null;
  tribunal: string | null;
  vara: string | null;
  parteAtiva: string | null;
  partePassiva: string | null;
  clienteRepresentado: string | null;
  /** Texto da publicação ou do ato que motivou a peça. */
  atoOrigem: string | null;
  /** Andamentos relevantes, do mais recente para o mais antigo. */
  andamentos: string[];
  /** Data fatal já confirmada, quando houver. */
  prazoFatal: string | null;
  /** Orientação livre do advogado — a tese, o que enfatizar. */
  orientacao: string | null;
}

const NOMES: Record<TipoPeca, string> = {
  contestacao: "contestação",
  embargos_declaracao: "embargos de declaração",
  apelacao: "apelação",
  replica: "réplica",
  manifestacao: "manifestação",
  peticao_simples: "petição simples",
};

/**
 * Estrutura esperada por tipo de peça. Serve de esqueleto, não de camisa de
 * força — o modelo adapta ao caso, mas parte de uma forma reconhecível para
 * quem vai revisar.
 */
const ESTRUTURAS: Record<TipoPeca, string[]> = {
  contestacao: [
    "Endereçamento e qualificação das partes",
    "Tempestividade",
    "Preliminares, se houver fundamento no material fornecido",
    "Mérito: impugnação específica de cada fato alegado (CPC, art. 341)",
    "Pedidos",
    "Provas que pretende produzir",
    "Valor da causa, se houver impugnação",
  ],
  embargos_declaracao: [
    "Endereçamento",
    "Tempestividade",
    "Identificação precisa do vício: omissão, contradição, obscuridade ou erro material (CPC, art. 1.022)",
    "Demonstração do vício apontando o trecho exato da decisão",
    "Pedido de saneamento",
  ],
  apelacao: [
    "Endereçamento ao juízo a quo",
    "Tempestividade e preparo",
    "Breve síntese da demanda",
    "Razões de reforma, ponto a ponto contra os fundamentos da sentença",
    "Pedidos",
  ],
  replica: [
    "Endereçamento",
    "Refutação das preliminares arguidas",
    "Impugnação dos fatos novos trazidos na contestação",
    "Reafirmação dos pedidos iniciais",
  ],
  manifestacao: [
    "Endereçamento",
    "Referência ao despacho ou à intimação que motivou a manifestação",
    "Conteúdo da manifestação",
    "Pedido",
  ],
  peticao_simples: [
    "Endereçamento",
    "Breve exposição",
    "Pedido",
  ],
};

/**
 * Instrução de sistema. As proibições vêm primeiro e são específicas —
 * "não invente" genérico não segura um modelo tão bem quanto dizer
 * exatamente o que não pode ser produzido.
 */
export function buildSystemPrompt(): string {
  return [
    "Você redige minutas para um advogado brasileiro revisar. O texto que",
    "você produz é um rascunho: será corrigido, assinado e protocolado por",
    "uma pessoa que responde profissionalmente por ele.",
    "",
    "Regras que não admitem exceção:",
    "",
    "1. Não cite jurisprudência, súmula, precedente ou número de acórdão que",
    "   não esteja no material fornecido. Se um argumento se beneficiaria de",
    "   precedente, escreva [BUSCAR PRECEDENTE: tese a sustentar] e siga.",
    "2. Não invente fato, data, valor, nome ou documento. O que faltar vira",
    "   [PREENCHER: o que falta], no lugar exato onde entraria.",
    "3. Cite dispositivo de lei apenas quando tiver certeza do conteúdo do",
    "   artigo. Na dúvida, descreva a regra sem o número.",
    "4. Não afirme ter examinado documento que não foi fornecido.",
    "",
    "Sobre a forma: linguagem jurídica corrente, sem arcaísmo e sem",
    "adjetivação. Frases curtas. Impugne fato por fato quando a peça exigir.",
    "Não abra com saudação nem feche com comentário sobre o próprio texto —",
    "devolva apenas a peça.",
    "",
    "Ao final, acrescente uma seção '## Pontos de atenção' listando o que o",
    "advogado precisa conferir ou completar antes de protocolar. Se não",
    "houver nada, escreva 'Nenhum'.",
  ].join("\n");
}

/** Inclui a linha apenas quando há valor, para não poluir com campos vazios. */
function linha(rotulo: string, valor: string | null): string | null {
  const limpo = valor?.trim();
  return limpo ? `${rotulo}: ${limpo}` : null;
}

/**
 * Monta o pedido com o material do processo.
 *
 * O que não existe simplesmente não aparece — enviar "Vara: não informada"
 * convida o modelo a preencher, enquanto a ausência do campo deixa claro
 * que ele não foi dado.
 */
export function buildUserPrompt(contexto: ContextoMinuta): string {
  const nome = NOMES[contexto.tipo];
  const partes: string[] = [`Redija uma ${nome}.`, ""];

  const identificacao = [
    linha("Processo", contexto.numeroProcesso),
    linha("Tribunal", contexto.tribunal),
    linha("Vara", contexto.vara),
    linha("Polo ativo", contexto.parteAtiva),
    linha("Polo passivo", contexto.partePassiva),
    linha("Cliente representado", contexto.clienteRepresentado),
    linha("Prazo fatal", contexto.prazoFatal),
  ].filter((item): item is string => item !== null);

  if (identificacao.length > 0) {
    partes.push("## Processo", ...identificacao, "");
  }

  if (contexto.atoOrigem?.trim()) {
    partes.push(
      "## Ato que motivou a peça",
      contexto.atoOrigem.trim(),
      "",
    );
  }

  const andamentos = contexto.andamentos
    .map((item) => item.trim())
    .filter(Boolean);
  if (andamentos.length > 0) {
    partes.push(
      "## Andamentos",
      ...andamentos.map((item) => `- ${item}`),
      "",
    );
  }

  if (contexto.orientacao?.trim()) {
    partes.push(
      "## Orientação do advogado",
      contexto.orientacao.trim(),
      "",
    );
  }

  partes.push(
    "## Estrutura esperada",
    ...ESTRUTURAS[contexto.tipo].map((item, i) => `${i + 1}. ${item}`),
  );

  // Quando não há material nenhum, o risco de invenção é máximo — o aviso
  // final é o último anteparo.
  if (!contexto.atoOrigem?.trim() && andamentos.length === 0) {
    partes.push(
      "",
      "Nenhum documento do processo foi fornecido. Produza o esqueleto da",
      "peça com [PREENCHER: ...] em todos os pontos que dependem dos autos.",
    );
  }

  return partes.join("\n");
}

/** Nome legível do tipo, para a interface. */
export function nomeDaPeca(tipo: TipoPeca): string {
  return NOMES[tipo];
}
