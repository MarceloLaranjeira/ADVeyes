import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Configurações — integração da API pública", () => {
  it("resolve currentTenant no escopo do componente Configuracoes", () => {
    const source = readFileSync("src/pages/Configuracoes.tsx", "utf8");
    const helperStart = source.indexOf("const ImportarProcessos");
    const settingsStart = source.indexOf("const Configuracoes");
    const tenantDeclaration = source.indexOf("const { currentTenant } = useTenant()");
    const tenantUsage = source.indexOf("{currentTenant ? (");

    expect(helperStart).toBeGreaterThan(-1);
    expect(settingsStart).toBeGreaterThan(helperStart);
    expect(tenantDeclaration).toBeGreaterThan(settingsStart);
    expect(tenantDeclaration).toBeLessThan(tenantUsage);
    expect(source).toContain("API pública v1 operacional");
    expect(source).toContain("Cadastrar ou selecionar escritório");
  });
});
