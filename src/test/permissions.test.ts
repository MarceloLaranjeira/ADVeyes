import { describe, expect, it } from "vitest";
import {
  editablePermissions,
  exceptionsForRole,
  hasOverride,
  PERMISSION_GROUPS,
  permissionLevel,
  overrideState,
  setOverrideState,
  toggleOverride,
  type PermissionRow,
} from "@/lib/permissions";

const rows = PERMISSION_GROUPS.flatMap((group) => group.rows);
const findRow = (module: string, action: string): PermissionRow => {
  const row = rows.find((item) =>
    item.module === module && item.action === action
  );
  if (!row) throw new Error(`Regra ausente: ${module}.${action}`);
  return row;
};

describe("matriz de permissões", () => {
  it("dá acesso total ao proprietário nas ações críticas", () => {
    expect(permissionLevel(findRow("ownership", "transfer"), "owner"))
      .toBe("sempre");
    expect(permissionLevel(findRow("critical_delete", "execute"), "owner"))
      .toBe("sempre");
  });

  it("mantém a transferência de propriedade fora do alcance dos demais", () => {
    const row = findRow("ownership", "transfer");
    expect(permissionLevel(row, "admin")).toBe("nunca");
    expect(permissionLevel(row, "finance")).toBe("nunca");
    expect(row.exception).toHaveLength(0);
  });

  it("marca como exceção o que a regra base não concede", () => {
    expect(permissionLevel(findRow("subscription", "manage"), "finance"))
      .toBe("excecao");
    expect(permissionLevel(findRow("finance", "read"), "lawyer"))
      .toBe("excecao");
    expect(permissionLevel(findRow("legal", "delete"), "admin"))
      .toBe("excecao");
  });

  it("não oferece exceção a quem já tem o acesso pela regra base", () => {
    for (const row of rows) {
      for (const role of row.base) {
        expect(row.exception).not.toContain(role);
      }
    }
  });

  it("lista apenas as exceções aplicáveis a cada perfil", () => {
    const assistant = exceptionsForRole("assistant");
    expect(assistant.every((row) => row.exception.includes("assistant")))
      .toBe(true);
    expect(exceptionsForRole("owner")).toHaveLength(0);
  });
});

describe("edição de exceções", () => {
  const row = findRow("finance", "read");

  it("liga e desliga uma exceção", () => {
    const granted = toggleOverride({}, row, true);
    expect(hasOverride(granted, row)).toBe(true);

    const revoked = toggleOverride(granted, row, false);
    expect(hasOverride(revoked, row)).toBe(false);
  });

  it("remove o módulo quando não sobra nenhuma exceção", () => {
    const granted = toggleOverride({}, row, true);
    expect(Object.keys(granted)).toContain("finance");

    const revoked = toggleOverride(granted, row, false);
    expect(Object.keys(revoked)).not.toContain("finance");
  });

  it("preserva exceções de outros módulos", () => {
    const legal = findRow("legal", "delete");
    const state = toggleOverride(toggleOverride({}, row, true), legal, true);

    const afterRevoke = toggleOverride(state, row, false);
    expect(hasOverride(afterRevoke, legal)).toBe(true);
    expect(hasOverride(afterRevoke, row)).toBe(false);
  });

  it("trata ausência de exceções como acesso negado", () => {
    expect(hasOverride(null, row)).toBe(false);
    expect(hasOverride({}, row)).toBe(false);
  });
});

describe("permissões tri-state", () => {
  const row = findRow("brand", "manage");

  it("distingue herança, permissão e negação", () => {
    expect(overrideState({}, row)).toBe("inherit");
    const allowed = setOverrideState({}, row, "allow");
    expect(overrideState(allowed, row)).toBe("allow");
    const denied = setOverrideState(allowed, row, "deny");
    expect(overrideState(denied, row)).toBe("deny");
    expect(overrideState(setOverrideState(denied, row, "inherit"), row))
      .toBe("inherit");
  });

  it("não permite sobrescrever a transferência de propriedade", () => {
    expect(editablePermissions()).not.toContainEqual(
      findRow("ownership", "transfer"),
    );
  });
});
