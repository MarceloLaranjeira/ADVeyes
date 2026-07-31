import { describe, expect, it } from "vitest";
import { resolveDataJudEndpoint } from "../../supabase/functions/_shared/datajud-client.ts";

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
