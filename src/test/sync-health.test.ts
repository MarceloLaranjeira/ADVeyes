import { describe, expect, it } from "vitest";
import {
  classifySyncSource,
  isPartialSyncCode,
  partialSyncLabel,
  summarizeSyncHealth,
  type SyncSourceState,
} from "@/lib/sync-health";

function source(overrides: Partial<SyncSourceState> = {}): SyncSourceState {
  return {
    active: true,
    last_error_code: null,
    paused_reason: null,
    ...overrides,
  };
}

describe("classifySyncSource", () => {
  it("considera saudável a fonte ativa sem erro", () => {
    expect(classifySyncSource(source())).toBe("healthy");
  });

  it("NÃO classifica busca incompleta como falha", () => {
    // Este é o ponto central: o DJEN respondeu, as publicações baixadas estão
    // no painel e o restante vem sozinho. Marcar como falha faria o advogado
    // caçar um problema inexistente.
    expect(
      classifySyncSource(source({ last_error_code: "djen_rate_limited" })),
    ).toBe("partial");
    expect(
      classifySyncSource(source({ last_error_code: "djen_max_pages" })),
    ).toBe("partial");
  });

  it("mantém como falha o erro que exige atenção", () => {
    expect(
      classifySyncSource(source({ last_error_code: "djen_request_failed" })),
    ).toBe("failing");
    expect(
      classifySyncSource(source({ last_error_code: "datajud_unauthorized" })),
    ).toBe("failing");
  });

  it("separa credencial ausente de falha de operação", () => {
    expect(
      classifySyncSource(
        source({ last_error_code: "integration_not_configured" }),
      ),
    ).toBe("pending");
  });

  it("prioriza fonte interrompida sobre qualquer outro estado", () => {
    // Interrompida exige ação humana: nunca pode ser escondida por um código
    // de erro mais brando gravado na mesma linha.
    expect(
      classifySyncSource(
        source({ active: false, last_error_code: "djen_rate_limited" }),
      ),
    ).toBe("stopped");
    expect(
      classifySyncSource(source({ active: false, paused_reason: "max_retries" })),
    ).toBe("stopped");
  });

  it("ignora a fonte desativada por já estar coberta pela OAB", () => {
    // Não é problema: a OAB do advogado já cobre esse processo.
    expect(
      classifySyncSource(
        source({ active: false, paused_reason: "covered_by_oab" }),
      ),
    ).toBe("healthy");
  });
});

describe("rótulos de busca incompleta", () => {
  it("reconhece os códigos de truncamento do DJEN e do DataJud", () => {
    expect(isPartialSyncCode("djen_rate_limited")).toBe(true);
    expect(isPartialSyncCode("datajud_max_pages_reached")).toBe(true);
    expect(isPartialSyncCode("djen_request_failed")).toBe(false);
    expect(isPartialSyncCode(null)).toBe(false);
  });

  it("explica em linguagem de advogado, sem jargão de API", () => {
    const label = partialSyncLabel("djen_rate_limited");
    expect(label).toContain("próxima execução");
    expect(label).not.toMatch(/rate.?limit|HTTP|429/i);
  });
});

describe("summarizeSyncHealth", () => {
  it("conta cada fonte em exatamente um estado", () => {
    const summary = summarizeSyncHealth([
      source(),
      source(),
      source({ last_error_code: "djen_rate_limited" }),
      source({ last_error_code: "djen_request_failed" }),
      source({ last_error_code: "integration_not_configured" }),
      source({ active: false, paused_reason: "max_retries" }),
    ]);

    expect(summary).toEqual({
      healthy: 2,
      partial: 1,
      failing: 1,
      pending: 1,
      stopped: 1,
    });

    // Soma fechada: nenhuma fonte contada duas vezes nem esquecida.
    const total = Object.values(summary).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(6);
  });
});
