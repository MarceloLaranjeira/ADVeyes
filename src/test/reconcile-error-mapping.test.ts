import { describe, expect, it } from "vitest";
import {
  asPostgrestError,
  describeError,
  postgrestErrorCode,
} from "../../supabase/functions/_shared/error-mapping.ts";

/**
 * O que se protege aqui: um erro do Supabase chega como objeto simples e
 * antes era achatado em "provider_error" / "operation_failed". Perder essa
 * mensagem significa uma fonte de sincronização pausada por `max_retries`
 * sem nenhuma pista do motivo — foi exatamente o que aconteceu com o
 * djen/oab 10099/AM.
 */

const erroDoBanco = {
  message: 'duplicate key value violates unique constraint "publicacoes_pkey"',
  details: "Key (id)=(abc) already exists.",
  hint: null,
  code: "23505",
};

describe("asPostgrestError", () => {
  it("reconhece o formato do Supabase", () => {
    expect(asPostgrestError(erroDoBanco)).not.toBeNull();
  });

  it("não confunde Error com erro do banco", () => {
    expect(asPostgrestError(new Error("boom"))).toBeNull();
  });

  it("ignora objeto sem mensagem", () => {
    expect(asPostgrestError({ code: "23505" })).toBeNull();
    expect(asPostgrestError(null)).toBeNull();
    expect(asPostgrestError("texto")).toBeNull();
  });
});

describe("postgrestErrorCode", () => {
  it("usa o SQLSTATE como código", () => {
    expect(postgrestErrorCode(erroDoBanco)).toBe("db_23505");
  });

  it("distingue as causas mais comuns", () => {
    expect(postgrestErrorCode({ message: "x", code: "23503" })).toBe("db_23503");
    expect(postgrestErrorCode({ message: "x", code: "42501" })).toBe("db_42501");
  });

  it("devolve nulo quando não é erro do banco", () => {
    expect(postgrestErrorCode(new Error("timeout"))).toBeNull();
    expect(postgrestErrorCode(null)).toBeNull();
  });
});

describe("describeError", () => {
  it("preserva mensagem e detalhes do banco", () => {
    const msg = describeError(erroDoBanco);
    expect(msg).toContain("duplicate key");
    expect(msg).toContain("already exists");
  });

  it("não achata mais em operation_failed", () => {
    expect(describeError(erroDoBanco)).not.toBe("operation_failed");
  });

  it("mantém o comportamento para Error comum", () => {
    expect(describeError(new Error("Signal timed out."))).toBe("Signal timed out.");
  });

  it("cai no genérico só quando não há forma reconhecível", () => {
    expect(describeError(null)).toBe("operation_failed");
    expect(describeError("texto solto")).toBe("operation_failed");
  });

  it("corta em 500 caracteres", () => {
    expect(describeError(new Error("x".repeat(900)))).toHaveLength(500);
    expect(describeError({ message: "y".repeat(900) })).toHaveLength(500);
  });

  it("omite campos nulos sem deixar separador solto", () => {
    expect(describeError({ message: "falhou", details: null, hint: null }))
      .toBe("falhou");
  });
});
