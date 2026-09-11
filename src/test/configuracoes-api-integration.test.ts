import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { describeInvokeError, publicApiErrorMessage } from "@/services/public-api-admin";

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

describe("Configurações — mensagens de erro da API pública", () => {
  it("explica que a Conta Geral precisa ativar o suporte antes de emitir credencial", () => {
    const message = publicApiErrorMessage("support_session_required");

    expect(message).toContain("Ativar suporte");
    expect(message).not.toContain("support_session_required");
  });

  it("explica que a conta não administra o escritório", () => {
    expect(publicApiErrorMessage("permission_denied")).toContain("administra");
  });

  it("mantém o código quando a falha não tem tradução", () => {
    expect(publicApiErrorMessage("falha_desconhecida")).toBe("falha_desconhecida");
  });

  it("lê o código de erro do corpo da resposta em vez do FunctionsHttpError opaco", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "support_session_required" }), { status: 403 }),
    });

    expect(await describeInvokeError(error)).toContain("Ativar suporte");
  });

  it("preserva a mensagem original quando o corpo não é JSON", async () => {
    const error = Object.assign(new Error("Failed to fetch"), {
      context: new Response("gateway timeout", { status: 504 }),
    });

    expect(await describeInvokeError(error)).toBe("Failed to fetch");
  });
});

describe("public-api-admin — autorização", () => {
  const source = readFileSync("supabase/functions/public-api-admin/index.ts", "utf8");

  it("resolve o acesso pelo mesmo helper das demais funções administrativas", () => {
    expect(source).toContain("resolveTenantLegalAccess");
    expect(source).not.toContain('.from("tenant_memberships")');
  });

  it("exige sessão de suporte ativa para qualquer ação que altere credenciais", () => {
    expect(source).toContain('action !== "list" && !access.canMutate');
    expect(source).toContain('error: "support_session_required"');
  });
});
