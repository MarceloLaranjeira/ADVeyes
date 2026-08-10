import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("segurança das integrações com tribunais", () => {
  it("não acessa credenciais pessoais no frontend", () => {
    const settings = readSource("src/pages/Configuracoes.tsx");
    const search = readSource("src/pages/BuscaJurisprudencia.tsx");

    expect(settings).not.toContain('from("tribunal_credenciais")');
    expect(settings).not.toContain("token_acesso");
    expect(settings).not.toContain("Token JWT para peticionamento");
    expect(search).not.toContain('action: "peticionar"');
    expect(search).toContain('action: "portal_oficial"');
  });

  it("não lê credenciais nem simula peticionamento na Edge Function", () => {
    const tribunalApi = readSource("supabase/functions/tribunal-api/index.ts");

    expect(tribunalApi).not.toContain('from("tribunal_credenciais")');
    expect(tribunalApi).not.toContain('case "peticionar"');
    expect(tribunalApi).not.toContain("Petição preparada");
    expect(tribunalApi).toContain('case "portal_oficial"');
  });
});
