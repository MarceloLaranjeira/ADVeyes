import { describe, expect, it } from "vitest";
import {
  apenasCarteiraAtiva,
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
