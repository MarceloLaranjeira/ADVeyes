import { describe, expect, it } from "vitest";
import {
  apenasCarteiraAtiva,
  carteiraAtiva,
  overrideParaStatus,
  FILTRO_CARTEIRA_ATIVA,
  estaArquivado,
  situacaoNaCarteira,
} from "@/lib/carteira";

describe("situacaoNaCarteira", () => {
  it("processo sem marca nenhuma está ativo", () => {
    const situacao = situacaoNaCarteira({ status: "Em andamento" });
    expect(situacao.arquivado).toBe(false);
    expect(situacao.origem).toBe("ativo");
    expect(situacao.divergente).toBe(false);
  });

  it("arquiva pelo tribunal quando o provedor marca a fonte", () => {
    const situacao = situacaoNaCarteira({ arquivadoNoTribunal: true });
    expect(situacao.arquivado).toBe(true);
    expect(situacao.origem).toBe("tribunal");
  });

  it("arquiva pela fase deduzida das movimentações", () => {
    const situacao = situacaoNaCarteira({ fase: "arquivado_encerrado" });
    expect(situacao.arquivado).toBe(true);
    expect(situacao.origem).toBe("tribunal");
  });

  it("a marcação manual do advogado vence o tribunal", () => {
    // O tribunal ainda não registrou a baixa; o escritório já sabe.
    const situacao = situacaoNaCarteira({
      arquivadoManual: true,
      arquivadoNoTribunal: false,
    });
    expect(situacao.arquivado).toBe(true);
    expect(situacao.origem).toBe("manual");
    expect(situacao.divergente).toBe(true);
  });

  it("o advogado pode desarquivar o que o tribunal arquivou", () => {
    const situacao = situacaoNaCarteira({
      arquivadoManual: false,
      arquivadoNoTribunal: true,
    });
    expect(situacao.arquivado).toBe(false);
    expect(situacao.origem).toBe("ativo");
    expect(situacao.divergente).toBe(true);
  });

  it("não aponta divergência quando os dois concordam", () => {
    const situacao = situacaoNaCarteira({
      arquivadoManual: true,
      arquivadoNoTribunal: true,
    });
    expect(situacao.divergente).toBe(false);
  });

  it("aceita o status textual legado como marcação manual", () => {
    expect(estaArquivado({ status: "Arquivado" })).toBe(true);
    expect(estaArquivado({ status: "arquivado" })).toBe(true);
    expect(estaArquivado({ status: "  ARQUIVADO  " })).toBe(true);
  });

  it("o campo dedicado vence o status textual legado", () => {
    const situacao = situacaoNaCarteira({
      status: "Arquivado",
      arquivadoManual: false,
    });
    expect(situacao.arquivado).toBe(false);
  });
});

describe("apenasCarteiraAtiva", () => {
  it("remove arquivados por qualquer uma das fontes", () => {
    const carteira = apenasCarteiraAtiva([
      { status: "Em andamento" },
      { status: "Arquivado" },
      { fase: "arquivado_encerrado" },
      { arquivadoNoTribunal: true },
      { arquivadoManual: false, arquivadoNoTribunal: true },
    ]);
    expect(carteira).toHaveLength(2);
  });
});

describe("carteiraAtiva", () => {
  /** Captura o predicado único que a função manda ao banco. */
  function filtroEnviado() {
    const filtros: string[] = [];
    const query = {
      or: (filtro: string) => {
        filtros.push(filtro);
        return query;
      },
    };
    carteiraAtiva(query);
    expect(filtros).toHaveLength(1);
    return filtros[0];
  }

  it("manda um predicado só, com o status aninhado sob o override nulo", () => {
    // Duas cláusulas separadas seriam unidas por AND, e aí o processo legado
    // gravado como "Arquivado" que o advogado reativou continuaria fora de
    // toda consulta — o botão "Reativar na carteira" não teria efeito. O
    // status legado só pode ser consultado quando não há decisão manual.
    expect(filtroEnviado()).toBe(
      "arquivado_manual.eq.false," +
        "and(arquivado_manual.is.null,status.not.ilike.Arquivado)",
    );
  });

  it("deixa o desarquivamento explícito vencer o status legado", () => {
    // A primeira alternativa do OR não menciona status: quem tem
    // `arquivado_manual = false` entra independentemente do que esteja
    // gravado ali.
    const [reativado] = filtroEnviado().split(",and(");
    expect(reativado).toBe("arquivado_manual.eq.false");
  });

  it("filtra sem depender da caixa gravada no banco", () => {
    // `situacaoNaCarteira` normaliza caixa antes de comparar. Se o filtro que
    // vai ao banco fosse sensível a caixa, a linha gravada como "arquivado"
    // passaria pela consulta e seria considerada arquivada pelo código — as
    // duas metades da mesma regra discordando.
    expect(filtroEnviado()).toContain("status.not.ilike.");
    expect(filtroEnviado()).not.toContain("status.neq.");
  });

  it("mantém o predicado e a constante exportada em sincronia", () => {
    expect(filtroEnviado()).toBe(FILTRO_CARTEIRA_ATIVA);
  });
});

describe("normalização entre código e banco", () => {
  it("considera arquivado o status com tabulação ou quebra de linha", () => {
    // O `trim()` do JavaScript remove todo espaço em branco. A migration usa
    // a classe [[:space:]] para casar com isso — `btrim` sozinho removeria
    // só o caractere espaço, e um status com tabulação ficaria arquivado
    // para o código e ativo para a consulta.
    expect(estaArquivado({ status: "\tArquivado" })).toBe(true);
    expect(estaArquivado({ status: "Arquivado\n" })).toBe(true);
    expect(estaArquivado({ status: " \t arquivado \n " })).toBe(true);
  });

  it("não confunde status que apenas contém a palavra", () => {
    expect(estaArquivado({ status: "Arquivado provisoriamente" })).toBe(false);
    expect(estaArquivado({ status: "Aguardando arquivamento" })).toBe(false);
  });
});

describe("estado desconhecido do tribunal", () => {
  it("não inventa divergência quando o tribunal não se pronunciou", () => {
    // Sem registro em `process_intelligence_current` não existe
    // classificação do tribunal. Tratar essa ausência como "em andamento"
    // fazia a tela afirmar que o tribunal discorda do escritório — sobre um
    // processo que o tribunal nunca classificou. Aviso inventado gasta a
    // atenção que ele existe para capturar.
    const situacao = situacaoNaCarteira({ arquivadoManual: true });
    expect(situacao.arquivado).toBe(true);
    expect(situacao.origem).toBe("manual");
    expect(situacao.divergente).toBe(false);
  });

  it("continua apontando divergência quando o tribunal se pronunciou", () => {
    expect(
      situacaoNaCarteira({ arquivadoManual: true, fase: "conhecimento" })
        .divergente,
    ).toBe(true);
    expect(
      situacaoNaCarteira({ arquivadoManual: false, arquivadoNoTribunal: true })
        .divergente,
    ).toBe(true);
  });

  it("trata fase vazia como ausência de classificação, não como ativo", () => {
    expect(situacaoNaCarteira({ arquivadoManual: true, fase: "" }).divergente)
      .toBe(false);
    expect(situacaoNaCarteira({ arquivadoManual: true, fase: null }).divergente)
      .toBe(false);
  });
});

describe("overrideParaStatus", () => {
  it("faz o status Arquivado do formulário arquivar de fato", () => {
    // Sem isto, marcar "Arquivado" num processo reativado não fazia nada: a
    // sobreposição vence o texto, e o salvamento dizia que deu certo.
    expect(overrideParaStatus("Arquivado", false)).toBe(true);
    expect(overrideParaStatus("Arquivado", null)).toBe(true);
    expect(overrideParaStatus("arquivado", null)).toBe(true);
  });

  it("retira a sobreposição quando o status deixa de ser Arquivado", () => {
    expect(overrideParaStatus("Em andamento", true)).toBe(null);
  });

  it("não desfaz uma reativação explícita", () => {
    // "Em andamento" é o valor padrão do cadastro, não uma decisão de
    // desarquivar. Tratá-lo como decisão apagaria a reativação sem querer.
    expect(overrideParaStatus("Em andamento", false)).toBe(false);
    expect(overrideParaStatus("Sentença proferida", false)).toBe(false);
  });

  it("não inventa decisão em processo sem sobreposição", () => {
    expect(overrideParaStatus("Em andamento", null)).toBe(null);
    expect(overrideParaStatus("Em andamento", undefined)).toBe(null);
  });
});
