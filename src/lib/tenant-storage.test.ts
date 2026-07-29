import { describe, expect, it } from "vitest";
import { buildTenantDocumentPath } from "./tenant-storage";

describe("buildTenantDocumentPath", () => {
  it("cria caminho isolado por tenant e documento", () => {
    expect(
      buildTenantDocumentPath({
        tenantId: "81000000-0000-4000-8000-000000000001",
        documentId: "81000000-0000-4000-8000-000000000002",
        fileName: "Petição inicial (João).pdf",
      }),
    ).toBe(
      "81000000-0000-4000-8000-000000000001/documentos/81000000-0000-4000-8000-000000000002/Peticao-inicial-Joao.pdf",
    );
  });

  it("rejeita tenant que não seja UUID", () => {
    expect(() =>
      buildTenantDocumentPath({
        tenantId: "../outro-tenant",
        documentId: "81000000-0000-4000-8000-000000000002",
        fileName: "arquivo.pdf",
      }),
    ).toThrow("Tenant inválido");
  });
});
