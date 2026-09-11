import { describe, expect, it } from "vitest";
import { isLegalPortalConnected, type LegalPortalConnection } from "@/services/legal-portal";

function connection(
  overrides: Partial<LegalPortalConnection> = {},
): LegalPortalConnection {
  return {
    id: "connection-1",
    provider: "projudi_tjam",
    courtCode: "TJAM",
    loginMasked: "AM•••78",
    status: "active",
    capabilities: {},
    lastValidatedAt: "2026-09-05T22:00:00.000Z",
    lastSuccessAt: null,
    lastErrorCode: null,
    lastErrorAt: null,
    lastResult: {},
    configured: true,
    ...overrides,
  };
}

describe("isLegalPortalConnected", () => {
  it("aceita somente conexão ativa, configurada e validada", () => {
    expect(isLegalPortalConnected(connection())).toBe(true);
  });

  it("não mostra conectado quando não há segredo armazenado", () => {
    expect(isLegalPortalConnected(connection({ configured: false }))).toBe(false);
  });

  it("não mostra conectado antes da primeira validação", () => {
    expect(isLegalPortalConnected(connection({ lastValidatedAt: null }))).toBe(false);
  });

  it("não mostra conectado para estado pendente", () => {
    expect(isLegalPortalConnected(connection({ status: "pending" }))).toBe(false);
  });
});
