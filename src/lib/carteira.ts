/**
 * O que conta como carteira ativa.
 *
 * Antes disto, "arquivado" era decidido em cada tela por conta própria — e
 * quase nunca. Um levantamento das consultas a `processos` encontrava
 * `.neq("status", "Arquivado")` em dois lugares do painel operacional e em
 * nenhum outro: nem na listagem, nem nos indicadores, nem nos seletores de
 * processo dos formulários. Dentro do mesmo arquivo, duas consultas
 * filtravam e a terceira não.
 *
 * O efeito é o número inflado: o card do painel dizia um total, o relatório
 * dizia outro, e o advogado não tinha como saber qual dos dois era o certo.
 * Filtro espalhado por tela sempre diverge; o que não diverge é uma
 * definição só, aplicada por padrão, com a exceção explícita na chamada.
 *
 * Três fontes disputam o rótulo de arquivado no sistema:
 *
 *   1. `processos.status` — marcação manual do advogado.
 *   2. fase `arquivado_encerrado` — deduzida das movimentações do tribunal
 *      pela inteligência processual.
 *   3. `fontes_tribunais_estao_arquivadas` — flag cru do provedor, gravado
 *      na descoberta.
 *
 * A regra decidida: o tribunal é a fonte primária, e a marcação manual do
 * advogado vence a automática quando existir. Isso cobre os dois erros
 * reais — o tribunal que demora a registrar a baixa, e o tribunal que
 * arquiva um processo que o escritório ainda trabalha.
 */

/**
 * Valor gravado em `processos.status` quando o advogado arquiva à mão.
 *
 * Continua sendo texto livre no banco, então a comparação é normalizada:
 * "Arquivado", "arquivado" e "ARQUIVADO" são a mesma coisa para quem lê.
 */
export const STATUS_ARQUIVADO = "Arquivado";

/** Fase que a inteligência processual atribui a partir do tribunal. */
export const FASE_ARQUIVADA = "arquivado_encerrado";

function normalizar(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export interface ProcessoArquivavel {
  /** `processos.status`, texto livre. */
  status?: string | null;
  /**
   * Marcação explícita do advogado, quando o escritório já usa o campo
   * dedicado. Tem precedência sobre tudo: `true` arquiva, `false`
   * desarquiva mesmo com o tribunal dizendo o contrário.
   */
  arquivadoManual?: boolean | null;
  /** Fase vinda de `process_intelligence_current`. */
  fase?: string | null;
  /** Flag do provedor, materializado na descoberta. */
  arquivadoNoTribunal?: boolean | null;
}

/** Por que este processo está (ou não) fora da carteira ativa. */
export type OrigemArquivamento = "manual" | "tribunal" | "ativo";

export interface SituacaoCarteira {
  arquivado: boolean;
  origem: OrigemArquivamento;
  /**
   * Verdadeiro quando advogado e tribunal discordam. A tela do processo
   * deve mostrar os dois lados em vez de escolher um em silêncio —
   * divergência escondida é como se perde processo.
   */
  divergente: boolean;
}

/**
 * Resolve a situação do processo com a precedência acordada.
 *
 * A marcação manual, quando existe, decide sozinha. Sem ela, vale o
 * tribunal: a flag do provedor ou a fase deduzida das movimentações. O
 * `status` textual entra como marcação manual legada, porque é o que os
 * escritórios usaram até aqui e ainda é a única marca em boa parte da base.
 */
export function situacaoNaCarteira(
  processo: ProcessoArquivavel,
): SituacaoCarteira {
  // O tribunal tem três respostas, não duas, e a diferença aparece na tela.
  //
  // Colapsar "não sei" em "não arquivado" fazia o controle do processo
  // afirmar que o tribunal ainda mostra o processo em andamento — para um
  // processo que o tribunal nunca classificou, porque a análise ainda não
  // rodou. Divergência inventada gasta a atenção que o aviso existe para
  // capturar, e ensina o advogado a ignorá-lo.
  const tribunal: boolean | null = typeof processo.arquivadoNoTribunal === "boolean"
    ? processo.arquivadoNoTribunal
    : normalizar(processo.fase).length > 0
      ? normalizar(processo.fase) === FASE_ARQUIVADA
      : null;

  const manual =
    typeof processo.arquivadoManual === "boolean"
      ? processo.arquivadoManual
      : normalizar(processo.status) === normalizar(STATUS_ARQUIVADO)
        ? true
        : null;

  if (manual !== null) {
    return {
      arquivado: manual,
      origem: manual ? "manual" : "ativo",
      // Só há discordância quando existe alguém do outro lado discordando.
      divergente: tribunal !== null && manual !== tribunal,
    };
  }

  return {
    arquivado: tribunal === true,
    origem: tribunal === true ? "tribunal" : "ativo",
    divergente: false,
  };
}

/** Atalho para quando só interessa entrar ou não na carteira ativa. */
export function estaArquivado(processo: ProcessoArquivavel): boolean {
  return situacaoNaCarteira(processo).arquivado;
}

/** Filtra uma lista já carregada. Use quando a consulta não pôde filtrar. */
export function apenasCarteiraAtiva<T extends ProcessoArquivavel>(
  processos: T[],
): T[] {
  return processos.filter((processo) => !estaArquivado(processo));
}

/* ------------------------------------------------------------------ */
/* Aplicação na consulta                                               */
/* ------------------------------------------------------------------ */

/**
 * Restringe uma consulta a `processos` à carteira ativa.
 *
 * Aplicar no banco, e não depois de carregar, é o que mantém os contadores
 * corretos: `count: "exact", head: true` não traz linha nenhuma para
 * filtrar em memória, então um total sem esta cláusula sai inflado e não
 * há como consertar do lado do cliente.
 *
 * Cobre hoje a marcação manual, que é a única gravada em `processos`. A
 * parte do tribunal mora em outras tabelas e entra por `situacaoNaCarteira`
 * depois do join — por isso a listagem, que já carrega a inteligência
 * processual, deve passar também por `apenasCarteiraAtiva`.
 *
 * @example
 *   const { count } = await carteiraAtiva(
 *     supabase.from("processos").select("id", { count: "exact", head: true })
 *   ).eq("tenant_id", tenantId);
 */
/**
 * A view que aplica a carteira ativa inteira no banco.
 *
 * `carteiraAtiva()` alcança só o que está em `processos`. O arquivamento
 * deduzido das movimentações mora em outra tabela, e numa consulta de
 * contagem (`head: true`) não vem linha para cruzar em memória — era por aí
 * que o contador do painel divergia da listagem. Quem precisa da regra
 * completa do lado do servidor lê desta view.
 */
export const VIEW_CARTEIRA_ATIVA = "processos_carteira_ativa";

/**
 * O predicado PostgREST da carteira ativa, aninhado.
 *
 * Fica separado da função para poder ser exercitado em teste sem montar um
 * query builder — é a metade da regra que mais silenciosamente pode divergir
 * de `situacaoNaCarteira`.
 */
export const FILTRO_CARTEIRA_ATIVA =
  `arquivado_manual.eq.false,` +
  `and(arquivado_manual.is.null,status.not.ilike.${STATUS_ARQUIVADO})`;

export function carteiraAtiva<T>(query: T): T {
  // Uma cláusula só, e ela precisa ser aninhada.
  //
  // A regra é hierárquica: a decisão do advogado vence, e o status legado só
  // é consultado quando ele não decidiu. Escrever as duas metades como
  // filtros separados as junta com AND, e aí um processo legado gravado como
  // "Arquivado" que o advogado reativou continuaria fora de toda consulta —
  // o botão "Reativar na carteira" não teria efeito nenhum. Por isso:
  //
  //   arquivado_manual = false                       → dentro, sempre.
  //   arquivado_manual is null AND status ≠ Arquivado → dentro.
  //   arquivado_manual = true                        → fora, sempre.
  //
  // O arquivamento vindo do tribunal continua fora daqui: mora em outra
  // tabela e entra por `situacaoNaCarteira` depois do join — por isso a
  // listagem, que já carrega a inteligência processual, deve passar também
  // por `apenasCarteiraAtiva`.
  //
  // `not.ilike` e nao `neq`: `situacaoNaCarteira` normaliza caixa antes de
  // comparar, e um filtro SQL sensivel a caixa deixaria passar a linha
  // gravada como "arquivado" que o codigo considera arquivada — as duas
  // metades da mesma regra discordando. O espaco em volta e resolvido na
  // migration, que canoniza o valor gravado.
  //
  // O tipo do query builder do Supabase é grande o bastante para estourar o
  // limite de recursão do TypeScript se `T` for restringido pela estrutura
  // (`T extends { or: ... }`). O genérico fica livre e a chamada vai por uma
  // asserção estreita, que preserva o tipo do retorno para quem chama.
  const encadeavel = query as unknown as {
    or: (filtro: string) => typeof encadeavel;
  };

  return encadeavel.or(FILTRO_CARTEIRA_ATIVA) as unknown as T;
}

/**
 * Mantém a escolha de status coerente com a sobreposição manual.
 *
 * O cadastro do processo continua oferecendo "Arquivado" na lista de status,
 * e depois que a sobreposição passou a vencer o status, essas duas metades
 * podiam discordar: um processo reativado (`arquivado_manual = false`) que o
 * advogado voltasse a marcar como "Arquivado" no formulário continuaria na
 * carteira, porque `false` vence o texto. O salvamento dizia que deu certo e
 * nada acontecia.
 *
 * Em vez de tirar a opção da lista — é assim que boa parte da base arquiva
 * hoje —, a escolha passa a alimentar a sobreposição:
 *
 *   escolheu "Arquivado"            → `true`, arquiva de fato.
 *   escolheu outro, havia `true`    → `null`, o arquivamento manual foi
 *                                     retirado e o tribunal volta a decidir.
 *   escolheu outro, havia `false`   → mantém `false`; a reativação foi uma
 *                                     decisão explícita e "Em andamento" é o
 *                                     valor padrão do cadastro, não uma
 *                                     decisão de desarquivar.
 *
 * @param status o valor escolhido no formulário
 * @param atual `processos.arquivado_manual` como está gravado hoje
 */
export function overrideParaStatus(
  status: string | null | undefined,
  atual: boolean | null | undefined,
): boolean | null {
  if (normalizar(status) === normalizar(STATUS_ARQUIVADO)) return true;
  return atual === true ? null : (atual ?? null);
}
