export const PUBLIC_API_VERSION = "v1" as const;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export const API_SCOPES = [
  "contacts:read",
  "contacts:write",
  "processes:read",
  "processes:write",
  "tasks:read",
  "tasks:write",
  "webhooks:manage",
] as const;

export type ApiScope = typeof API_SCOPES[number];
export type ApiResource = "contacts" | "processes" | "tasks";

export interface ResourceContract {
  table: "clientes" | "processos" | "tarefas";
  readScope: ApiScope;
  writeScope: ApiScope;
  requiredOnCreate: string[];
  fields: Record<string, string>;
  output: Record<string, string>;
}

export const RESOURCE_CONTRACTS: Record<ApiResource, ResourceContract> = {
  contacts: {
    table: "clientes",
    readScope: "contacts:read",
    writeScope: "contacts:write",
    requiredOnCreate: ["name"],
    fields: {
      name: "nome",
      document: "cpf",
      email: "email",
      phone: "telefone",
      address: "endereco",
      notes: "observacoes",
      person_type: "person_type",
      relationship_type: "relationship_type",
    },
    output: {
      id: "id",
      name: "nome",
      document: "cpf",
      email: "email",
      phone: "telefone",
      address: "endereco",
      notes: "observacoes",
      person_type: "person_type",
      relationship_type: "relationship_type",
      created_at: "created_at",
      updated_at: "updated_at",
      deleted_at: "deleted_at",
    },
  },
  processes: {
    table: "processos",
    readScope: "processes:read",
    writeScope: "processes:write",
    requiredOnCreate: ["number"],
    fields: {
      number: "numero",
      contact_id: "cliente_id",
      client_name: "cliente_nome",
      area: "area",
      status: "status",
      court: "tribunal",
      court_division: "vara",
      lawyer: "advogado",
      description: "descricao",
      plaintiffs: "polo_ativo",
      defendants: "polo_passivo",
      filed_at: "data_ajuizamento",
    },
    output: {
      id: "id",
      number: "numero",
      contact_id: "cliente_id",
      client_name: "cliente_nome",
      area: "area",
      status: "status",
      court: "tribunal",
      court_division: "vara",
      lawyer: "advogado",
      description: "descricao",
      plaintiffs: "polo_ativo",
      defendants: "polo_passivo",
      filed_at: "data_ajuizamento",
      last_movement: "ultimo_andamento",
      created_at: "created_at",
      updated_at: "updated_at",
      deleted_at: "deleted_at",
    },
  },
  tasks: {
    table: "tarefas",
    readScope: "tasks:read",
    writeScope: "tasks:write",
    requiredOnCreate: ["title"],
    fields: {
      title: "titulo",
      description: "descricao",
      type: "tipo",
      category: "categoria",
      status: "status",
      priority: "prioridade",
      due_at: "data_limite",
      process_id: "processo_id",
      assignee_id: "responsavel_id",
      points: "pontos",
      tags: "tags",
    },
    output: {
      id: "id",
      title: "titulo",
      description: "descricao",
      type: "tipo",
      category: "categoria",
      status: "status",
      priority: "prioridade",
      due_at: "data_limite",
      process_id: "processo_id",
      assignee_id: "responsavel_id",
      points: "pontos",
      tags: "tags",
      completed_at: "concluida_em",
      created_at: "created_at",
      updated_at: "updated_at",
      deleted_at: "deleted_at",
    },
  },
};

export interface ParsedApiRoute {
  resource: ApiResource | "webhook-endpoints" | "health";
  id: string | null;
}

export class PublicApiContractError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly field?: string,
  ) {
    super(code);
  }
}

export function parsePublicApiPath(pathname: string): ParsedApiRoute | null {
  const marker = "/api/v1";
  const index = pathname.indexOf(marker);
  if (index < 0) return null;
  const segments = pathname
    .slice(index + marker.length)
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (segments.length === 0) return { resource: "health", id: null };
  const [resource, id, extra] = segments;
  if (extra) return null;
  if (
    resource !== "contacts" && resource !== "processes" &&
    resource !== "tasks" && resource !== "webhook-endpoints" &&
    resource !== "health"
  ) return null;
  if (resource === "health" && id) return null;
  return { resource, id: id || null };
}

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

export function requireScope(scopes: readonly string[], required: ApiScope): void {
  if (!scopes.includes(required)) {
    throw new PublicApiContractError("insufficient_scope", 403);
  }
}

export function normalizePageSize(raw: string | null): number {
  if (!raw) return DEFAULT_PAGE_SIZE;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new PublicApiContractError("invalid_limit", 400, "limit");
  }
  return value;
}

export interface ApiCursor {
  created_at: string;
  id: string;
}

export function encodeCursor(cursor: ApiCursor): string {
  const encoded = btoa(JSON.stringify(cursor));
  return encoded.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeCursor(value: string | null): ApiCursor | null {
  if (!value) return null;
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as Partial<ApiCursor>;
    if (
      typeof parsed.created_at !== "string" ||
      Number.isNaN(Date.parse(parsed.created_at)) ||
      typeof parsed.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)
    ) throw new Error("invalid_cursor");
    return { created_at: parsed.created_at, id: parsed.id };
  } catch {
    throw new PublicApiContractError("invalid_cursor", 400, "cursor");
  }
}

export function mapApiInput(
  resource: ApiResource,
  input: unknown,
  mode: "create" | "update",
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PublicApiContractError("invalid_body", 400);
  }
  const contract = RESOURCE_CONTRACTS[resource];
  const source = input as Record<string, unknown>;
  const mapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    const column = contract.fields[key];
    if (!column) {
      throw new PublicApiContractError("unknown_field", 400, key);
    }
    mapped[column] = value;
  }

  if (mode === "create") {
    for (const required of contract.requiredOnCreate) {
      const value = source[required];
      if (typeof value !== "string" || !value.trim()) {
        throw new PublicApiContractError("required_field", 422, required);
      }
    }
  } else if (Object.keys(mapped).length === 0) {
    throw new PublicApiContractError("empty_update", 400);
  }

  return mapped;
}

export function mapApiOutput(
  resource: ApiResource,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [external, column] of Object.entries(RESOURCE_CONTRACTS[resource].output)) {
    result[external] = row[column] ?? null;
  }
  return result;
}

export function eventTypeForChange(input: {
  resource: ApiResource;
  operation: "INSERT" | "UPDATE" | "DELETE";
  oldStatus?: string | null;
  newStatus?: string | null;
  oldDeletedAt?: string | null;
  newDeletedAt?: string | null;
}): string {
  const singular = input.resource === "contacts"
    ? "contact"
    : input.resource === "processes" ? "process" : "task";
  if (
    input.operation === "DELETE" ||
    (!input.oldDeletedAt && Boolean(input.newDeletedAt))
  ) return `${singular}.deleted`;
  if (input.operation === "INSERT") return `${singular}.created`;
  if (
    input.resource === "tasks" && input.oldStatus !== "concluída" &&
    input.newStatus === "concluída"
  ) return "task.completed";
  return `${singular}.updated`;
}
