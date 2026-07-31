import { describe, expect, it } from "vitest";
import {
  buildContentFingerprint,
  detectPossibleDeadline,
  formatCnj,
  nextAttemptDelayMs,
  normalizeDataJudMovements,
  normalizeEscavadorPublication,
  resolveOriginSystem,
  RETRY_DELAYS_MS,
} from "../../supabase/functions/_shared/legal-normalization.ts";

describe("formatCnj", () => {
  it("formata um número CNJ com 20 dígitos", () => {
    expect(formatCnj("08001234520238040001")).toBe(
      "0800123-45.2023.8.04.0001",
    );
  });

  it("mantém a formatação já aplicada", () => {
    expect(formatCnj("0800123-45.2023.8.04.0001")).toBe(
      "0800123-45.2023.8.04.0001",
    );
  });

  it("retorna vazio quando o número não é válido", () => {
    expect(formatCnj("123")).toBe("");
    expect(formatCnj(null)).toBe("");
  });

  it("aceita número entregue como valor não textual", () => {
    expect(formatCnj(8001234520238040001)).toBe("");
    expect(formatCnj({ numero: "x" })).toBe("");
  });
});

describe("resolveOriginSystem", () => {
  it("usa o campo explícito do provedor antes de qualquer outra pista", () => {
    expect(
      resolveOriginSystem({
        systemField: "PROJUDI",
        sourceName: "Diário da Justiça Eletrônico",
        content: "Processo tramitando no PJe",
      }),
    ).toBe("projudi");
  });

  it("aceita evidência vinda do nome da fonte", () => {
    expect(resolveOriginSystem({ sourceName: "SEEU - Execução Penal" }))
      .toBe("seeu");
  });

  it("aceita evidência vinda do domínio da fonte", () => {
    expect(
      resolveOriginSystem({ sourceUrl: "https://pje.tjam.jus.br/consulta/123" }),
    ).toBe("pje");
  });

  it("classifica diário de justiça quando não há sistema processual", () => {
    expect(
      resolveOriginSystem({ sourceName: "Diário de Justiça Eletrônico" }),
    ).toBe("dje");
  });

  it("aceita menção explícita no conteúdo do provedor", () => {
    expect(
      resolveOriginSystem({ content: "Intimação disponibilizada no PJe." }),
    ).toBe("pje");
  });

  it("não classifica por semelhança parcial de palavra", () => {
    expect(resolveOriginSystem({ content: "Empresa Pjean Ltda" })).toBe(
      "unknown",
    );
    expect(resolveOriginSystem({ sourceName: "Tribunal de Justiça" })).toBe(
      "unknown",
    );
  });

  it("retorna não identificado quando não há evidência", () => {
    expect(resolveOriginSystem({})).toBe("unknown");
    expect(resolveOriginSystem({ sourceName: null, content: "" })).toBe(
      "unknown",
    );
  });
});

describe("detectPossibleDeadline", () => {
  it("sinaliza expressões típicas de prazo", () => {
    expect(detectPossibleDeadline("Fica intimado para, no prazo de 15 dias"))
      .toBe(true);
    expect(detectPossibleDeadline("Manifeste-se em 5 dias úteis")).toBe(true);
    expect(detectPossibleDeadline("sob pena de preclusão")).toBe(true);
  });

  it("não sinaliza texto sem indício de prazo", () => {
    expect(detectPossibleDeadline("Autos conclusos ao magistrado")).toBe(false);
    expect(detectPossibleDeadline("")).toBe(false);
  });
});

describe("buildContentFingerprint", () => {
  it("é determinístico para o mesmo conteúdo", async () => {
    const first = await buildContentFingerprint([
      "tenant",
      "0800123-45.2023.8.04.0001",
      "conteúdo",
    ]);
    const second = await buildContentFingerprint([
      "tenant",
      "0800123-45.2023.8.04.0001",
      "conteúdo",
    ]);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it("ignora espaçamento irrelevante para não duplicar o mesmo evento", async () => {
    const spaced = await buildContentFingerprint(["tenant", " conteúdo  A "]);
    const tight = await buildContentFingerprint(["tenant", "conteúdo A"]);
    expect(spaced).toBe(tight);
  });

  it("muda quando o escritório muda", async () => {
    const first = await buildContentFingerprint(["tenant-a", "conteúdo"]);
    const second = await buildContentFingerprint(["tenant-b", "conteúdo"]);
    expect(first).not.toBe(second);
  });
});

describe("normalizeEscavadorPublication", () => {
  const receivedAt = "2026-07-30T12:00:00.000Z";

  it("converte a resposta do provedor no contrato interno", () => {
    const normalized = normalizeEscavadorPublication({
      id: 991,
      tipo: "Intimação",
      data_publicacao: "2026-07-29T00:00:00.000Z",
      conteudo: "Fica a parte intimada para se manifestar no prazo de 15 dias.",
      conteudo_simplificado: "Manifestação em 15 dias",
      numero_processo: "08001234520238040001",
      tribunal: { sigla: "TJAM", nome: "Tribunal de Justiça do Amazonas" },
      fonte: { nome: "Diário da Justiça Eletrônico", sistema: "PJE" },
    }, { receivedAt });

    expect(normalized.externalId).toBe("991");
    expect(normalized.numeroProcesso).toBe("0800123-45.2023.8.04.0001");
    expect(normalized.originSystem).toBe("pje");
    expect(normalized.possibleDeadline).toBe(true);
    expect(normalized.publishedAt).toBe("2026-07-29T00:00:00.000Z");
    expect(normalized.tribunal).toBe("TJAM");
    expect(normalized.sourceName).toBe("Diário da Justiça Eletrônico");
  });

  it("usa a data de recebimento quando o provedor não informa data", () => {
    const normalized = normalizeEscavadorPublication({
      conteudo: "Publicação sem data",
    }, { receivedAt });

    expect(normalized.publishedAt).toBe(receivedAt);
    expect(normalized.externalId).toBeNull();
    expect(normalized.originSystem).toBe("unknown");
    expect(normalized.numeroProcesso).toBeNull();
  });
});

describe("normalizeDataJudMovements", () => {
  it("converte movimentos oficiais em andamentos, nunca em publicações", () => {
    const movements = normalizeDataJudMovements({
      numeroProcesso: "08001234520238040001",
      tribunal: "TJAM",
      movimentos: [
        {
          codigo: 26,
          nome: "Distribuição",
          dataHora: "2026-07-02T10:00:00.000Z",
          complementosTabelados: [
            { descricao: "tipo", nome: "sorteio", valor: 1 },
          ],
        },
        {
          nome: "Juntada de petição",
          dataHora: "2026-07-01T09:30:00.000Z",
        },
      ],
    });

    expect(movements).toHaveLength(2);
    expect(movements.every((item) => item.movementType === "ANDAMENTO")).toBe(
      true,
    );
    expect(movements[0].externalId).toBe("26:2026-07-02T10:00:00.000Z");
    expect(movements[0].content).toContain("Distribuição");
    expect(movements[0].content).toContain("tipo: sorteio");
    expect(movements[1].externalId).toBe(
      "juntada-de-peticao:2026-07-01T09:30:00.000Z",
    );
    expect(movements[0].sourceName).toBe("DataJud/CNJ — TJAM");
  });

  it("ordena do mais recente para o mais antigo e ignora movimentos vazios", () => {
    const movements = normalizeDataJudMovements({
      numeroProcesso: "08001234520238040001",
      tribunal: "TJAM",
      movimentos: [
        { nome: "Antigo", dataHora: "2026-01-01T00:00:00.000Z" },
        { nome: "", dataHora: "2026-02-01T00:00:00.000Z" },
        { nome: "Recente", dataHora: "2026-03-01T00:00:00.000Z" },
      ],
    });

    expect(movements.map((item) => item.title)).toEqual(["Recente", "Antigo"]);
  });

  it("aceita complementos com valores numéricos do DataJud", () => {
    const movements = normalizeDataJudMovements({
      numeroProcesso: "08001234520238040001",
      tribunal: "TJAM",
      movimentos: [
        {
          codigo: 123,
          nome: "Juntada",
          dataHora: "2026-07-02T09:30:00.000Z",
          // Formato real do DataJud: `descricao` nomeia o complemento e
          // `nome` traz o valor legível; `valor` é o código.
          complementosTabelados: [
            { codigo: 7, nome: "Certidão", valor: 24, descricao: "tipo_de_documento" },
            { codigo: 9, valor: 2, descricao: "quantidade" },
          ],
        } as never,
      ],
    });

    expect(movements).toHaveLength(1);
    expect(movements[0].content).toContain("tipo_de_documento: Certidão");
    expect(movements[0].content).toContain("quantidade: 2");
  });

  it("não quebra quando o provedor envia número no lugar de texto", () => {
    const movements = normalizeDataJudMovements({
      numeroProcesso: 8001234520238040001 as never,
      tribunal: 4 as never,
      movimentos: [
        { nome: 987 as never, dataHora: "2026-07-02T09:30:00.000Z" },
      ],
    });

    expect(movements).toHaveLength(1);
    expect(movements[0].title).toBe("987");
  });

  it("não deduz sistema de origem a partir do tribunal", () => {
    const [movement] = normalizeDataJudMovements({
      numeroProcesso: "08001234520238040001",
      tribunal: "TJAM",
      movimentos: [{ nome: "Conclusão", dataHora: "2026-03-01T00:00:00.000Z" }],
    });

    expect(movement.originSystem).toBe("unknown");
  });
});

describe("nextAttemptDelayMs", () => {
  it("aplica a escala aprovada de retentativas", () => {
    expect(RETRY_DELAYS_MS).toEqual([
      60_000,
      300_000,
      1_800_000,
      7_200_000,
      21_600_000,
    ]);
    expect(nextAttemptDelayMs(0)).toBe(60_000);
    expect(nextAttemptDelayMs(3)).toBe(7_200_000);
    expect(nextAttemptDelayMs(4)).toBe(21_600_000);
  });

  it("interrompe após cinco falhas consecutivas", () => {
    expect(nextAttemptDelayMs(5)).toBeNull();
    expect(nextAttemptDelayMs(9)).toBeNull();
  });
});
