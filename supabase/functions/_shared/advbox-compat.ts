/**
 * Camada de compatibilidade com a API do ADVBOX (22 endpoints, Bearer token).
 *
 * Os identificadores do ADVeyes são UUID, não inteiros: eles trafegam como
 * strings opacas em todos os campos `*_id`. Campos que o ADVeyes não modela
 * saem como null para o contrato continuar com o mesmo formato.
 */
import { PublicApiContractError } from "./public-api-contract.ts";

export type AdvboxResource =
  | "customers" | "lawsuits" | "posts" | "movements" | "last_movements"
  | "history" | "publications" | "settings" | "transactions" | "documents";

export interface AdvboxRoute {
  resource: AdvboxResource;
  id: string | null;
  action: "birthdays" | "download" | null;
}

const RESOURCES = new Set<string>([
  "customers", "lawsuits", "posts", "movements", "last_movements", "history",
  "publications", "settings", "transactions", "documents",
]);
const ID_RESOURCES = new Set<string>([
  "customers", "lawsuits", "history", "movements", "publications",
  "transactions", "documents",
]);

export const ADVBOX_MAX_LIMIT = 1000;

export function parseAdvboxPath(pathname: string): AdvboxRoute | null {
  const marker = "/api/v1";
  const index = pathname.indexOf(marker);
  if (index < 0) return null;
  const segments = pathname.slice(index + marker.length).split("/")
    .filter(Boolean).map(decodeURIComponent);
  const [resource, second, third] = segments;
  if (!resource || !RESOURCES.has(resource) || segments.length > 3) return null;
  if (resource === "customers" && second === "birthdays" && !third) {
    return { resource, id: null, action: "birthdays" };
  }
  if (resource === "documents" && third === "download") {
    return { resource, id: second, action: "download" };
  }
  if (third) return null;
  if (second && !ID_RESOURCES.has(resource)) return null;
  return { resource: resource as AdvboxResource, id: second || null, action: null };
}

export function advboxPage(
  params: URLSearchParams,
  defaultLimit = ADVBOX_MAX_LIMIT,
): { limit: number; offset: number } {
  const rawLimit = params.get("limit");
  const rawOffset = params.get("offset");
  const limit = rawLimit === null ? defaultLimit : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > ADVBOX_MAX_LIMIT) {
    throw new PublicApiContractError("invalid_limit", 400, "limit");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new PublicApiContractError("invalid_offset", 400, "offset");
  }
  return { limit, offset };
}

/** DD/MM/YYYY ou YYYY-MM-DD para YYYY-MM-DD; vazio vira null. */
export function advboxDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new PublicApiContractError("invalid_date", 422, field);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : value;
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso) || Number.isNaN(Date.parse(iso))) {
    throw new PublicApiContractError("invalid_date", 422, field);
  }
  return iso.slice(0, 10);
}

function text(value: unknown, field: string, max = 4000): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new PublicApiContractError("invalid_field", 422, field);
  }
  const result = String(value).trim();
  if (result.length > max) throw new PublicApiContractError("field_too_long", 422, field);
  return result || null;
}

function body(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PublicApiContractError("invalid_body", 400);
  }
  return input as Record<string, unknown>;
}

function required(source: Record<string, unknown>, field: string): string {
  const value = text(source[field], field);
  if (!value) throw new PublicApiContractError("required_field", 422, field);
  return value;
}

export function customerFromInput(input: unknown, mode: "create" | "update") {
  const s = body(input);
  const patch: Record<string, unknown> = {};
  if (mode === "create") patch.nome = required(s, "name");
  else if ("name" in s) patch.nome = required(s, "name");
  const document = text(s.document ?? s.identification, "document", 40);
  if (document) patch.cpf = document;
  if ("email" in s) patch.email = text(s.email, "email", 254);
  const phone = text(s.cellphone ?? s.phone, "phone", 40);
  if (phone) patch.telefone = phone;
  if ("notes" in s) patch.observacoes = text(s.notes, "notes");
  const address = [s.street, s.number, s.region, s.city, s.state, s.postalcode]
    .map((part) => text(part, "address", 200)).filter(Boolean).join(", ");
  if (address) patch.endereco = address;
  return patch;
}

export function customerToOutput(
  row: Record<string, unknown>,
  lawsuits: Array<Record<string, unknown>> = [],
) {
  return {
    id: row.id,
    name: row.nome,
    email: row.email ?? null,
    document: row.cpf ?? null,
    identification: row.cpf ?? null,
    phone: row.telefone ?? null,
    cellphone: row.telefone ?? null,
    address: row.endereco ?? null,
    notes: row.observacoes ?? null,
    created_at: row.created_at,
    lawsuits: lawsuits.map((lawsuit) => ({
      lawsuit_id: lawsuit.id,
      process_number: lawsuit.numero,
      protocol_number: null,
    })),
  };
}

export function lawsuitFromInput(input: unknown, mode: "create" | "update") {
  const s = body(input);
  const patch: Record<string, unknown> = {};
  if (mode === "create") patch.numero = required(s, "process_number");
  else if ("process_number" in s) patch.numero = required(s, "process_number");
  if ("type_lawsuits_id" in s) patch.area = text(s.type_lawsuits_id, "type_lawsuits_id", 80);
  if ("stages_id" in s) patch.status = text(s.stages_id, "stages_id", 80);
  if ("notes" in s) patch.descricao = text(s.notes, "notes");
  if ("date" in s) patch.data_ajuizamento = advboxDate(s.date, "date");
  let customerId: string | null = null;
  if ("customers_id" in s) {
    if (!Array.isArray(s.customers_id) || s.customers_id.length < 1) {
      throw new PublicApiContractError("invalid_customers_id", 422, "customers_id");
    }
    customerId = text(s.customers_id[0], "customers_id", 80);
  } else if (mode === "create") {
    throw new PublicApiContractError("required_field", 422, "customers_id");
  }
  if (mode === "update" && Object.keys(patch).length === 0 && !customerId) {
    throw new PublicApiContractError("empty_update", 400);
  }
  return { patch, customerId };
}

export function lawsuitToOutput(row: Record<string, unknown>) {
  const customers = row.cliente_id
    ? [{ customer_id: row.cliente_id, name: row.cliente_nome ?? null }]
    : [];
  return {
    id: row.id,
    process_number: row.numero,
    protocol_number: null,
    folder: null,
    process_date: row.data_ajuizamento ?? null,
    fees_expec: null,
    fees_money: null,
    contingency: row.percentual_exito ?? null,
    type_lawsuit_id: row.area ?? null,
    type: row.area ?? null,
    group_id: row.area ?? null,
    group: row.area ?? null,
    created_at: row.created_at,
    status_closure: null,
    exit_production: null,
    exit_execution: null,
    responsible_id: null,
    responsible: row.advogado ?? null,
    stages_id: row.status ?? null,
    stage: row.status ?? null,
    steps_id: null,
    step: null,
    notes: row.descricao ?? null,
    customers,
  };
}

/** Dia do andamento em UTC (AAAA-MM-DD); o banco devolve o instante no fuso da sessão. */
export function utcDay(value: unknown): string | null {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString().slice(0, 10);
}

/** Andamento manual só tem data: o meio-dia UTC mantém o mesmo dia em qualquer fuso do Brasil. */
export const movementTimestamp = (day: string | null) => (day ? `${day}T12:00:00Z` : null);

export function movementFromInput(input: unknown) {
  const s = body(input);
  const description = required(s, "description");
  if (description.length < 10) {
    throw new PublicApiContractError("description_too_short", 422, "description");
  }
  const date = advboxDate(required(s, "date"), "date");
  return { lawsuitId: required(s, "lawsuit_id"), date, description };
}

export function movementToOutput(
  row: Record<string, unknown>,
  lawsuitId: unknown,
  customers: unknown[] = [],
) {
  return {
    lawsuit_id: lawsuitId,
    date: utcDay(row.data_andamento),
    title: row.tipo ?? null,
    header: row.descricao,
    process_number: row.numero_processo,
    protocol_number: null,
    customers,
  };
}

export function postFromInput(input: unknown) {
  const s = body(input);
  if (!Array.isArray(s.guests) || s.guests.length < 1) {
    throw new PublicApiContractError("required_field", 422, "guests");
  }
  const start = advboxDate(required(s, "start_date"), "start_date");
  const deadline = advboxDate(s.date_deadline, "date_deadline");
  return {
    taskTypeId: required(s, "tasks_id"),
    lawsuitId: required(s, "lawsuits_id"),
    assigneeId: required({ guest: s.guests[0] }, "guest"),
    dueDate: deadline ?? start,
    description: text(s.comments, "comments"),
    urgent: s.urgent === true || s.urgent === 1 || s.urgent === "1",
  };
}

export function postToOutput(
  row: Record<string, unknown>,
  lawsuit: Record<string, unknown> | null,
) {
  return {
    id: row.id,
    date: row.created_at,
    date_deadline: row.data_limite ?? null,
    task: row.titulo,
    reward: row.pontos ?? 0,
    notes: row.descricao ?? null,
    local: null,
    lawsuits_id: row.processo_id ?? null,
    created_at: row.created_at,
    lawsuit: lawsuit
      ? { id: lawsuit.id, process_number: lawsuit.numero, protocol_number: null }
      : null,
    users: row.responsavel_id ? [{ id: row.responsavel_id }] : [],
  };
}

export function historyToOutput(
  row: Record<string, unknown>,
  lawsuit: Record<string, unknown> | null,
) {
  return {
    process_number: lawsuit?.numero ?? null,
    protocol_number: null,
    task: row.titulo,
    reward: row.pontos ?? 0,
    start: row.created_at,
    date_deadline: row.data_limite ?? null,
    comments: row.descricao ?? null,
    local: null,
    created_at: row.created_at,
    author: null,
    responsible: row.responsavel_id ?? null,
    customers: lawsuit?.cliente_nome ?? null,
  };
}

export function publicationToOutput(
  row: Record<string, unknown>,
  lawsuit: Record<string, unknown> | null,
) {
  return {
    process_number: row.numero_processo ?? lawsuit?.numero ?? null,
    protocol_number: null,
    start: row.data_publicacao ?? null,
    date_deadline: row.data_prazo ?? null,
    local: row.court_body ?? null,
    created_at: row.created_at,
    author: null,
    responsible: null,
    customers: row.cliente_nome ?? lawsuit?.cliente_nome ?? null,
    publication: row.conteudo,
    date: row.data_publicacao ?? null,
  };
}

/** Escapa curingas do LIKE para a busca parcial `name`. */
export function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

/** "250,50", "1.250,50" ou 250.5 viram número; zero e negativos são recusados. */
export function parseAmount(value: unknown, field = "amount"): number {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized);
  if (!normalized || !Number.isFinite(amount) || amount <= 0) {
    throw new PublicApiContractError("invalid_amount", 422, field);
  }
  return Math.round(amount * 100) / 100;
}

const STATUS_IN: Record<string, string> = { paid: "pago", pending: "pendente", overdue: "atrasado" };
const STATUS_OUT: Record<string, string> = { pago: "paid", pendente: "pending", atrasado: "overdue" };

export function transactionFromInput(input: unknown, mode: "create" | "update") {
  const s = body(input);
  const patch: Record<string, unknown> = {};
  const refs: { categoryId: string | null; costCenterId: string | null; accountId: string | null; lawsuitId: string | null; customerId: string | null } =
    { categoryId: null, costCenterId: null, accountId: null, lawsuitId: null, customerId: null };

  if (mode === "create" || "entry_type" in s) {
    const type = required(s, "entry_type");
    if (type !== "income" && type !== "expense") {
      throw new PublicApiContractError("invalid_entry_type", 422, "entry_type");
    }
    patch.tipo = type === "income" ? "honorario" : "despesa";
  }
  if (mode === "create" || "amount" in s) patch.valor = parseAmount(s.amount);
  if (mode === "create" || "date_due" in s) {
    const due = advboxDate(mode === "create" ? required(s, "date_due") : s.date_due, "date_due");
    if (!due) throw new PublicApiContractError("required_field", 422, "date_due");
    patch.data_vencimento = due;
  }
  if (mode === "create") {
    refs.accountId = required(s, "debit_account");
    refs.categoryId = required(s, "categories_id");
    refs.costCenterId = required(s, "cost_centers_id");
    patch.descricao = text(s.description ?? s.notes ?? s.comments, "description", 300) ?? "Lançamento via API";
    refs.lawsuitId = text(s.lawsuits_id, "lawsuits_id", 80);
    refs.customerId = text(s.customers_id, "customers_id", 80);
    if (refs.lawsuitId && !refs.customerId) {
      throw new PublicApiContractError("customers_id_required", 422, "customers_id");
    }
  }
  if ("status" in s) {
    const status = STATUS_IN[String(s.status)];
    if (!status) throw new PublicApiContractError("invalid_status", 422, "status");
    patch.status = status;
    if (status === "pago" && !("date_payment" in s)) patch.data_pagamento = new Date().toISOString().slice(0, 10);
    if (status !== "pago") patch.data_pagamento = null;
  }
  if ("date_payment" in s) patch.data_pagamento = advboxDate(s.date_payment, "date_payment");
  if (mode === "update" && Object.keys(patch).length === 0) {
    throw new PublicApiContractError("empty_update", 400);
  }
  return { patch, refs };
}

export function transactionToOutput(row: Record<string, unknown>) {
  return {
    id: row.id,
    entry_type: row.tipo === "honorario" ? "income" : "expense",
    amount: row.valor,
    date_due: row.data_vencimento ?? null,
    date_payment: row.data_pagamento ?? null,
    status: STATUS_OUT[String(row.status)] ?? row.status,
    description: row.descricao,
    lawsuits_id: row.processo_id ?? null,
    customers_id: row.cliente_id ?? null,
    categories_id: row.categoria_id ?? null,
    cost_centers_id: row.centro_custo_id ?? null,
    debit_account: row.conta_id ?? null,
    created_at: row.created_at,
  };
}

export function documentToOutput(row: Record<string, unknown>, lawsuit: Record<string, unknown> | null) {
  return {
    id: row.id,
    name: row.nome,
    size: row.tamanho ?? null,
    links: { download: `/api/v1/documents/${row.id}/download` },
    attached_to: row.processo_id
      ? { type: "lawsuit", id: row.processo_id, label: lawsuit?.numero ?? row.processo_numero ?? null }
      : null,
    uploaded_at: row.created_at,
  };
}
