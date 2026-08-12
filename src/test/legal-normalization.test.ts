import { describe, expect, it } from "vitest";
import {
  buildContentFingerprint,
  buildPartyIdentityFingerprint,
  detectPossibleDeadline,
  formatCnj,
  nextAttemptDelayMs,
  normalizeDataJudParties,
  normalizeDataJudProcessMetadata,
  normalizeDataJudMovements,
  normalizeDjenPublication,
  normalizeEscavadorPublication,
  normalizeEscavadorPublicDocument,
  normalizeEscavadorProcessParties,
  resolveOriginSystem,
  RETRY_DELAYS_MS,
} from "../../supabase/functions/_shared/legal-normalization.ts";

describe("normalizeEscavadorPublicDocument", () => {
  it("preserva metadados e cria identidade separada dos andamentos", () => {
    const document = normalizeEscavadorPublicDocument({
      id: 91,
      titulo: "Sentença",
      descricao: "Pedido julgado procedente.",
      data: "2026-08-10 13:45:00",
      tipo: "PUBLICO",
      extensao_arquivo: "pdf",
      quantidade_paginas: 7,
      links: { api: "https://api.escavador.com/api/v2/documentos/91" },
    });

    expect(document.externalId).toBe("document:91");
    expect(document.movementType).toBe("DOCUMENTO");
    expect(document.title).toBe("Sentença");
    expect(document.documentType).toBe("PUBLICO");
    expect(document.documentUrl).toContain("/documentos/91");
    expect(document.complements).toEqual(expect.arrayContaining([
      { key: "extensao", label: "Extensão", value: "PDF" },
      { key: "paginas", label: "Páginas", value: "7 página(s)" },
    ]));
  });
});

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
    expect(formatCnj(Number("8001234520238040001"))).toBe("");
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

describe("buildPartyIdentityFingerprint", () => {
  it("não depende do identificador externo do provedor", async () => {
    const canonicalParty = {
      documentHash: null,
      normalizedName: "MARIA DA SILVA",
      personType: "pessoa_fisica" as const,
      side: "ativo" as const,
    };
    const fromDataJud = await buildPartyIdentityFingerprint({
      tenantId: "tenant-a",
      processId: "processo-a",
      party: canonicalParty,
    });
    const fromComplementaryProvider = await buildPartyIdentityFingerprint({
      tenantId: "tenant-a",
      processId: "processo-a",
      party: { ...canonicalParty },
    });

    expect(fromDataJud).toBe(fromComplementaryProvider);
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

describe("normalizeDjenPublication", () => {
  const receivedAt = "2026-08-01T12:00:00.000Z";

  it("converte a comunicação oficial do CNJ e remove marcação HTML", () => {
    const normalized = normalizeDjenPublication({
      id: 651169325,
      hash: "hash-oficial",
      data_disponibilizacao: "2026-07-31",
      siglaTribunal: "TJMG",
      tipoComunicacao: "Intimação",
      nomeOrgao: "TJMG - 5ª Câmara Criminal",
      texto: "Fica a parte <b>intimada</b><br />no prazo de cinco dias.",
      numero_processo: "00128291820248130686",
      link: "https://www4.tjmg.jus.br/consulta",
      tipoDocumento: "Apelação",
      nomeClasse: "Apelação Criminal",
    }, { receivedAt });

    expect(normalized.externalId).toBe("651169325");
    expect(normalized.numeroProcesso).toBe("0012829-18.2024.8.13.0686");
    expect(normalized.content).toBe(
      "Fica a parte intimada no prazo de cinco dias.",
    );
    expect(normalized.publishedAt).toBe("2026-07-31T00:00:00.000Z");
    expect(normalized.tribunal).toBe("TJMG");
    expect(normalized.possibleDeadline).toBe(true);
    expect(normalized.sourceName).toBe("TJMG - 5ª Câmara Criminal");
  });

  it("usa o hash como identidade e mantém origem desconhecida sem evidência", () => {
    const normalized = normalizeDjenPublication({
      hash: "hash-sem-id",
      texto: "Autos conclusos ao magistrado.",
      siglaTribunal: "TJAM",
    }, { receivedAt });

    expect(normalized.externalId).toBe("hash-sem-id");
    expect(normalized.publishedAt).toBe(receivedAt);
    expect(normalized.originSystem).toBe("unknown");
    expect(normalized.possibleDeadline).toBe(false);
  });

  it("decodifica entidades HTML nomeadas e numéricas do DJEN", () => {
    const normalized = normalizeDjenPublication({
      texto:
          "PODER JUDICI&amp;Aacute;RIO — Intima&amp;ccedil;&amp;atilde;o da parte &#193; autora.",
      siglaTribunal: "TJGO",
    }, { receivedAt });

    expect(normalized.content).toBe(
      "PODER JUDICIÁRIO — Intimação da parte Á autora.",
    );
  });

  it("preserva destinatários, advogados, órgão e evidência de audiência", () => {
    const normalized = normalizeDjenPublication({
      tipoComunicacao: "Intimação",
      nomeOrgao: "2ª Vara Cível de Manaus",
      texto: "Audiência de conciliação designada para 20/08/2026 às 09:30.",
      destinatarios: [{ nome: "Maria da Silva", polo: "A" }],
      destinatarioadvogados: [{ nome: "João Souza", numero_oab: "10099" }],
    }, { receivedAt });

    expect(normalized.communicationType).toBe("Intimação");
    expect(normalized.courtBody).toBe("2ª Vara Cível de Manaus");
    expect(normalized.recipients).toEqual([
      { nome: "Maria da Silva", polo: "A" },
    ]);
    expect(normalized.recipientLawyers).toEqual([
      { nome: "João Souza", numero_oab: "10099" },
    ]);
    expect(normalized.hearingEvidence).toContain("Audiência de conciliação");
  });
});

describe("normalizeDataJudProcessMetadata", () => {
  it("preserva metadados oficiais de capa sem inferir campos ausentes", () => {
    const normalized = normalizeDataJudProcessMetadata({
      numeroProcesso: "08001234520238040001",
      tribunal: "TJAM",
      classe: { codigo: 1116, nome: "Execução Fiscal" },
      assuntos: [
        { codigo: 5952, nome: "IPTU" },
        { codigo: 6017, nome: "Taxas" },
      ],
      orgaoJulgador: { codigo: 987, nome: "3ª Vara da Fazenda Pública" },
      sistema: { codigo: 1, nome: "PROJUDI" },
      grau: "G1",
      nivelSigilo: 0,
      dataAjuizamento: "2026-01-10T10:30:00Z",
      dataHoraUltimaAtualizacao: "2026-08-09T12:00:00Z",
    });

    expect(normalized.processNumber).toBe("0800123-45.2023.8.04.0001");
    expect(normalized.classCode).toBe("1116");
    expect(normalized.className).toBe("Execução Fiscal");
    expect(normalized.subjects).toEqual([
      { code: "5952", name: "IPTU" },
      { code: "6017", name: "Taxas" },
    ]);
    expect(normalized.adjudicatingBody).toBe("3ª Vara da Fazenda Pública");
    expect(normalized.proceduralSystem).toBe("PROJUDI");
    expect(normalized.publicSecrecyLevel).toBe(0);
  });
});

describe("normalizeDataJudParties", () => {
  it("normaliza partes e advogados sem presumir quem é cliente", () => {
    const parties = normalizeDataJudParties({
      partes: [
        {
          id: 31,
          nome: "José da Conceição",
          polo: "ATIVO",
          tipoPessoa: "Pessoa Física",
          tipoParte: "AUTOR",
          telefone: "(92) 99999-0000",
          email: "jose@example.com",
          endereco: {
            logradouro: "Rua das Flores",
            numero: "10",
            cidade: "Manaus",
            uf: "AM",
          },
          advogados: [{ nome: "Ana Lima", oab: "AM10099" }],
        },
        {
          id: 32,
          nomeParte: "Empresa Ré Ltda.",
          polo: "PASSIVO",
          tipoPessoa: "Pessoa Jurídica",
          papel: "RÉU",
        },
      ],
    });

    expect(parties).toHaveLength(2);
    expect(parties[0]).toMatchObject({
      normalizedName: "JOSE DA CONCEICAO",
      side: "ativo",
      personType: "pessoa_fisica",
      internalClassification: "terceiro",
    });
    expect(parties[0].relatedLawyers).toEqual([
      { nome: "Ana Lima", oab: "AM10099" },
    ]);
    expect(parties[0].contact).toEqual({
      phone: "(92) 99999-0000",
      email: "jose@example.com",
      address: "Rua das Flores, 10 · Manaus - AM",
    });
    expect(parties[1]).toMatchObject({
      normalizedName: "EMPRESA RE LTDA",
      side: "passivo",
      personType: "pessoa_juridica",
      internalClassification: "parte_contraria",
    });
  });
});

describe("normalizeEscavadorProcessParties", () => {
  it("une fontes e remove documentos pessoais do payload persistido", () => {
    const parties = normalizeEscavadorProcessParties({
      fontes: [{
        id: 3,
        envolvidos: [{
          nome: "Maria da Conceição",
          tipo_pessoa: "FISICA",
          polo: "ATIVO",
          tipo_normalizado: "Requerente",
          telefones: [{ valor: "92988887777" }],
          emails: ["maria@example.com"],
          cpf: "12345678900",
          advogados: [{
            nome: "Ana Lima",
            cpf: "98765432100",
            oabs: [{ uf: "AM", numero: 10099 }],
          }],
        }],
      }, {
        id: 4,
        envolvidos: [{
          nome: "Maria da Conceição",
          tipo_pessoa: "FISICA",
          polo: "ATIVO",
        }],
      }],
    });

    expect(parties).toHaveLength(1);
    expect(parties[0]).toMatchObject({
      normalizedName: "MARIA DA CONCEICAO",
      personType: "pessoa_fisica",
      side: "ativo",
      provider: "escavador",
    });
    expect(JSON.stringify(parties[0].payload)).not.toContain("12345678900");
    expect(JSON.stringify(parties[0].payload)).not.toContain("98765432100");
    expect(parties[0].relatedLawyers).toEqual([{
      nome: "Ana Lima",
      oabs: [{ uf: "AM", numero: 10099 }],
    }]);
    expect(parties[0].contact).toEqual({
      phone: "92988887777",
      email: "maria@example.com",
      address: null,
    });
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
    expect(movements[0].title).toBe("Distribuição");
    expect(movements[0].content).toContain("Tipo: sorteio");
    expect(movements[0].tpuCode).toBe("26");
    expect(movements[0].complements).toEqual([
      { key: "tipo", label: "Tipo", value: "sorteio" },
    ]);
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
    expect(movements[0].title).toBe("Juntada");
    expect(movements[0].movementType).toBe("DOCUMENTO");
    expect(movements[0].content).toContain("Tipo de documento: Certidão");
    expect(movements[0].content).toContain("Quantidade: 2");
    expect(movements[0].documentType).toBe("Certidão");
  });

  it("substitui o título genérico Documento pelo tipo legível", () => {
    const [movement] = normalizeDataJudMovements({
      tribunal: "TJGO",
      movimentos: [{
        codigo: 60,
        nome: "Documento",
        dataHora: "2026-07-03T05:28:00.000Z",
        complementosTabelados: [
          { descricao: "tipo_de_documento", nome: "Certidão", valor: 24 },
        ],
      }],
    });

    expect(movement.title).toBe("Certidão");
    expect(movement.movementType).toBe("DOCUMENTO");
    expect(movement.content).toBe("Documento registrado: Certidão.");
  });

  it("corrige complementos entregues com chave e valor invertidos", () => {
    const [movement] = normalizeDataJudMovements({
      tribunal: "TJGO",
      movimentos: [{
        codigo: 85,
        nome: "Mandado",
        dataHora: "2026-05-12T09:52:00.000Z",
        complementosTabelados: [
          { descricao: "Entregue ao destinatário", nome: "resultado" },
        ],
      }],
    });

    expect(movement.title).toBe("Mandado");
    expect(movement.content).toBe("Resultado: Entregue ao destinatário");
  });

  it("não quebra quando o provedor envia número no lugar de texto", () => {
    const movements = normalizeDataJudMovements({
      numeroProcesso: Number("8001234520238040001") as never,
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
