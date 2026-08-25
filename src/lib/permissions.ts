import type { TeamRole } from "@/types/team-management";

/**
 * Espelho legível da matriz que vive no banco
 * (`private.has_tenant_permission`). A tela mostra estas regras; quem decide
 * continua sendo o banco, então alterar o navegador não muda nada.
 */

export type PermissionLevel = "sempre" | "excecao" | "nunca";

export interface PermissionRow {
  module: string;
  action: string;
  label: string;
  description: string;
  /** Perfis que já têm o acesso pela regra base. */
  base: TeamRole[];
  /** Perfis que podem receber o acesso como exceção individual. */
  exception: TeamRole[];
}

export const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  lawyer: "Advogado",
  assistant: "Assistente",
  finance: "Financeiro",
};

export const ROLE_ORDER: TeamRole[] = [
  "owner",
  "admin",
  "lawyer",
  "assistant",
  "finance",
];

export const PERMISSION_GROUPS: Array<{
  title: string;
  rows: PermissionRow[];
}> = [
  {
    title: "Escritório",
    rows: [
      {
        module: "brand",
        action: "manage",
        label: "Identidade visual",
        description: "Trocar logo, nome exibido e cores do escritório.",
        base: ["owner", "admin"],
        exception: [],
      },
      {
        module: "members",
        action: "manage",
        label: "Gestão de equipe",
        description: "Convidar, editar acesso, suspender e remover membros.",
        base: ["owner", "admin"],
        exception: [],
      },
      {
        module: "ownership",
        action: "transfer",
        label: "Transferir propriedade",
        description: "Passar a titularidade do escritório para outra pessoa.",
        base: ["owner"],
        exception: [],
      },
    ],
  },
  {
    title: "Assinatura",
    rows: [
      {
        module: "subscription",
        action: "read",
        label: "Ver plano e faturas",
        description: "Consultar assinatura, cobranças e situação de pagamento.",
        base: ["owner", "admin"],
        exception: ["finance"],
      },
      {
        module: "subscription",
        action: "manage",
        label: "Alterar plano",
        description: "Contratar, trocar ou cancelar o plano do escritório.",
        base: ["owner"],
        exception: ["finance"],
      },
    ],
  },
  {
    title: "Jurídico",
    rows: [
      {
        module: "legal",
        action: "read",
        label: "Consultar processos e publicações",
        description: "Abrir processos, andamentos, publicações e prazos.",
        base: ["owner", "admin", "lawyer", "assistant"],
        exception: [],
      },
      {
        module: "legal",
        action: "update",
        label: "Editar dados jurídicos",
        description: "Criar e alterar processos, prazos e tarefas.",
        base: ["owner", "admin", "lawyer", "assistant"],
        exception: [],
      },
      {
        module: "legal",
        action: "delete",
        label: "Excluir dados jurídicos",
        description: "Apagar processos, publicações e andamentos.",
        base: ["owner"],
        exception: ["admin"],
      },
    ],
  },
  {
    title: "Financeiro e contratos",
    rows: [
      {
        module: "finance",
        action: "read",
        label: "Consultar financeiro",
        description: "Ver lançamentos, honorários e relatórios financeiros.",
        base: ["owner", "admin", "finance"],
        exception: ["lawyer", "assistant"],
      },
      {
        module: "finance",
        action: "update",
        label: "Lançar e editar financeiro",
        description: "Criar e alterar lançamentos e honorários.",
        base: ["owner", "admin", "finance"],
        exception: ["lawyer", "assistant"],
      },
      {
        module: "finance",
        action: "delete",
        label: "Excluir lançamentos",
        description: "Apagar registros financeiros.",
        base: ["owner"],
        exception: ["admin", "finance"],
      },
      {
        module: "contracts",
        action: "update",
        label: "Editar contratos",
        description: "Criar e alterar contratos e modelos.",
        base: ["owner", "admin", "finance"],
        exception: ["lawyer", "assistant"],
      },
    ],
  },
  {
    title: "Solicitações e permissões",
    rows: [
      {
        module: "access_requests",
        action: "decide",
        label: "Aprovar ou recusar solicitações",
        description:
          "Decidir quem entra no escritório e com quais permissões.",
        base: ["owner"],
        exception: [],
      },
      {
        module: "permissions",
        action: "manage",
        label: "Administrar permissões individuais",
        description:
          "Alterar as exceções de acesso pessoa a pessoa.",
        base: ["owner"],
        exception: [],
      },
    ],
  },
  {
    title: "Operações críticas",
    rows: [
      {
        module: "reports",
        action: "read",
        label: "Ver indicadores",
        description: "Acessar relatórios e painéis do escritório.",
        base: ["owner", "admin", "lawyer", "assistant", "finance"],
        exception: [],
      },
      {
        module: "critical_delete",
        action: "execute",
        label: "Exclusões definitivas",
        description: "Remover registros em massa, sem possibilidade de desfazer.",
        base: ["owner"],
        exception: ["admin"],
      },
    ],
  },
];

export type PermissionOverrideValue = "allow" | "deny";
export type PermissionOverrideState = "inherit" | PermissionOverrideValue;
export type PermissionOverrides = Record<
  string,
  Record<string, PermissionOverrideValue>
>;

export function permissionLevel(
  row: PermissionRow,
  role: TeamRole,
): PermissionLevel {
  if (row.base.includes(role)) return "sempre";
  if (row.exception.includes(role)) return "excecao";
  return "nunca";
}

export function overrideState(
  overrides: PermissionOverrides | null | undefined,
  row: PermissionRow,
): PermissionOverrideState {
  const value = overrides?.[row.module]?.[row.action];
  return value === "allow" || value === "deny" ? value : "inherit";
}

export function setOverrideState(
  overrides: PermissionOverrides,
  row: PermissionRow,
  state: PermissionOverrideState,
): PermissionOverrides {
  const next: PermissionOverrides = { ...overrides };
  const moduleActions = { ...(next[row.module] ?? {}) };

  if (state === "inherit") delete moduleActions[row.action];
  else moduleActions[row.action] = state;

  if (Object.keys(moduleActions).length === 0) delete next[row.module];
  else next[row.module] = moduleActions;

  return next;
}

/**
 * Autoridades que pertencem ao proprietário e não podem ser delegadas por
 * exceção individual. O banco recusa qualquer override nestes módulos.
 */
const OWNER_ONLY_MODULES = new Set([
  "ownership",
  "access_requests",
  "permissions",
]);

/** Somente o proprietário administra a matriz individual. */
export function canManagePermissions(role: TeamRole): boolean {
  return role === "owner";
}

/** Somente o proprietário decide quem entra no escritório. */
export function canDecideAccessRequests(role: TeamRole): boolean {
  return role === "owner";
}

/** Permissões editáveis individualmente; as do proprietário ficam de fora. */
export function editablePermissions(): PermissionRow[] {
  return PERMISSION_GROUPS.flatMap((group) => group.rows).filter(
    (row) => !OWNER_ONLY_MODULES.has(row.module),
  );
}

/** Compatibilidade com a primeira versão da tela de exceções. */
export function exceptionsForRole(role: TeamRole): PermissionRow[] {
  return PERMISSION_GROUPS.flatMap((group) => group.rows).filter((row) =>
    row.exception.includes(role)
  );
}

/** @deprecated Use overrideState para distinguir herança, permissão e negação. */
export function hasOverride(
  overrides: PermissionOverrides | null | undefined,
  row: PermissionRow,
): boolean {
  return overrideState(overrides, row) === "allow";
}

/** @deprecated Use setOverrideState. Mantido para migração e testes legados. */
export function toggleOverride(
  overrides: PermissionOverrides,
  row: PermissionRow,
  granted: boolean,
): PermissionOverrides {
  return setOverrideState(overrides, row, granted ? "allow" : "inherit");
}
