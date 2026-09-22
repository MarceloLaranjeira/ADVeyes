import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260921200000_notifications_persist_read_state.sql",
  ),
  "utf8",
);

/** Remove comentários SQL para testar somente o que o banco executa. */
const executable = MIGRATION
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("contrato de segurança das notificações", () => {
  it("não cria policy FOR ALL que contorne tenant_v2_insert", () => {
    // Policies permissivas são ORadas. Uma FOR ALL por membership ativa faria
    // INSERT passar sem `private.has_tenant_permission(... legal, create)`.
    expect(executable).not.toMatch(/create\s+policy[\s\S]*?for\s+all/i);
    expect(executable).not.toMatch(
      /create\s+policy\s+"notificacoes_scoped_to_user_and_tenant"/i,
    );
  });

  it("compatibilidade legada é só SELECT e UPDATE do próprio usuário", () => {
    expect(executable).toContain('create policy "notificacoes_legacy_select"');
    expect(executable).toContain('create policy "notificacoes_legacy_update"');
    expect(executable).toContain("auth.uid() = user_id");
    expect(executable).toContain("tenant_id is null");
    expect(executable).not.toContain('create policy "notificacoes_legacy_insert"');
    expect(executable).not.toContain('create policy "notificacoes_legacy_delete"');
  });

  it("remove a policy ampla caso a primeira versão tenha sido aplicada", () => {
    expect(executable).toContain(
      'drop policy if exists "notificacoes_scoped_to_user_and_tenant"',
    );
  });
});
