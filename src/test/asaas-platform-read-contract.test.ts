import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contrato de leitura da assinatura pela Conta Geral", () => {
  it("usa a autorização multitenant compartilhada e mantém cobrança restrita a membros", () => {
    const source = readFileSync(
      "supabase/functions/asaas/index.ts",
      "utf8",
    );

    expect(source).toContain("resolveTenantLegalAccess");
    expect(source).toContain('access.kind === "membership"');
    expect(source).toContain('body.action === "get_subscription"');
  });
});
