import { describe, expect, it } from "vitest";
import {
  buildOabQuery,
  courtsForOabState,
  resolveDataJudEndpoint,
} from "../../supabase/functions/_shared/datajud-client.ts";

describe("resolveDataJudEndpoint", () => {
  it("prioriza o tribunal informado no cadastro do processo", () => {
    expect(
      resolveDataJudEndpoint({
        cnj: "0800123-45.2023.8.04.0001",
        tribunal: "TJSP",
      }),
    ).toBe("https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search");
  });

  it("deriva a justiça estadual pelo segmento e código do número CNJ", () => {
    expect(resolveDataJudEndpoint({ cnj: "0800123-45.2023.8.04.0001" })).toBe(
      "https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search",
    );
    expect(resolveDataJudEndpoint({ cnj: "1000123-45.2024.8.26.0100" })).toBe(
      "https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search",
    );
  });

  it("deriva justiça do trabalho e federal", () => {
    expect(resolveDataJudEndpoint({ cnj: "0000123-45.2024.5.11.0001" })).toBe(
      "https://api-publica.datajud.cnj.jus.br/api_publica_trt11/_search",
    );
    expect(resolveDataJudEndpoint({ cnj: "0000123-45.2024.4.01.3400" })).toBe(
      "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
    );
  });

  it("ignora tribunal inválido e usa o número como fonte de verdade", () => {
    expect(
      resolveDataJudEndpoint({
        cnj: "0800123-45.2023.8.04.0001",
        tribunal: "Projudi",
      }),
    ).toBe("https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search");
  });

  it("retorna null quando o DataJud não cobre a origem", () => {
    expect(resolveDataJudEndpoint({ cnj: "0000123-45.2024.6.11.0001" })).toBeNull();
    expect(resolveDataJudEndpoint({ cnj: "123" })).toBeNull();
  });
});

describe("courtsForOabState", () => {
  it("cobre a justiça estadual, federal e trabalhista da seccional", () => {
    expect(courtsForOabState("AM")).toEqual(["tjam", "trf1", "trt11"]);
    expect(courtsForOabState("sp")).toEqual(["tjsp", "trf3", "trt2"]);
  });

  it("retorna vazio para seccional desconhecida", () => {
    expect(courtsForOabState("XX")).toEqual([]);
    expect(courtsForOabState("")).toEqual([]);
  });
});

describe("buildOabQuery", () => {
  it("procura as grafias conhecidas do campo de advogado", () => {
    const query = buildOabQuery("10099", "AM") as {
      bool: {
        should: Array<Record<string, Record<string, string>>>;
        minimum_should_match: number;
      };
    };

    const values = query.bool.should.map((clause) =>
      Object.values(clause.match)[0]
    );
    expect(new Set(values)).toEqual(
      new Set(["10099", "10099/AM", "AM10099", "AM 10099"]),
    );

    const fields = new Set(
      query.bool.should.map((clause) => Object.keys(clause.match)[0]),
    );
    expect(fields).toEqual(
      new Set(["partes.advogados.inscricaoOab", "partes.advogados.oab"]),
    );
    expect(query.bool.minimum_should_match).toBe(1);
  });

  it("ignora pontuação do número e caixa da seccional", () => {
    const query = buildOabQuery("10.099", "am") as {
      bool: { should: Array<Record<string, Record<string, string>>> };
    };
    const values = query.bool.should.map((clause) =>
      Object.values(clause.match)[0]
    );
    expect(values).toContain("10099/AM");
  });
});
