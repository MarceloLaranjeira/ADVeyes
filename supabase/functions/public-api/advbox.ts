import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  advboxDate,
  advboxPage,
  customerFromInput,
  customerToOutput,
  documentToOutput,
  transactionFromInput,
  transactionToOutput,
  historyToOutput,
  lawsuitFromInput,
  lawsuitToOutput,
  likePattern,
  movementFromInput,
  movementTimestamp,
  movementToOutput,
  postFromInput,
  postToOutput,
  publicationToOutput,
  type AdvboxRoute,
} from "../_shared/advbox-compat.ts";
import {
  PublicApiContractError,
  requireScope,
} from "../_shared/public-api-contract.ts";

interface AdvboxToken {
  tenantId: string;
  scopes: string[];
  actorUserId: string;
}

interface AdvboxResult {
  body: Record<string, unknown>;
  status: number;
}

type Row = Record<string, unknown>;

const ORIGINS = ["indicacao", "site", "redes_sociais", "whatsapp", "outro"];

const ok = (body: Row, status = 200): AdvboxResult => ({ body, status });
const notFound = (): AdvboxResult => ({ body: {}, status: 404 });

function envelope(rows: Row[], total: number, limit: number, offset: number, query: Row) {
  return ok({ offset, limit, totalCount: total, data: rows, query });
}

async function must<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

async function lawsuitsOf(admin: SupabaseClient, tenantId: string, customerIds: string[]) {
  if (customerIds.length === 0) return [] as Row[];
  return await must(admin.from("processos").select("id, numero, cliente_id")
    .eq("tenant_id", tenantId).in("cliente_id", customerIds)
    .is("deleted_at", null)) as Row[];
}

async function customers(
  admin: SupabaseClient, token: AdvboxToken, method: string, route: AdvboxRoute,
  url: URL, input: unknown,
): Promise<AdvboxResult> {
  const write = method === "POST";
  requireScope(token.scopes, write ? "contacts:write" : "contacts:read");
  const t = token.tenantId;
  if (write) {
    const patch = customerFromInput(input, "create");
    const data = await must(admin.from("clientes").insert({
      ...patch, tenant_id: t, user_id: token.actorUserId, source_provider: "advbox_api",
    }).select("id").single()) as Row;
    return ok({ success: true, customers_id: data.id }, 201);
  }
  if (route.id) {
    const row = await must(admin.from("clientes").select("*").eq("tenant_id", t)
      .eq("id", route.id).is("deleted_at", null).maybeSingle()) as Row | null;
    if (!row) return notFound();
    return ok(customerToOutput(row, await lawsuitsOf(admin, t, [route.id])));
  }
  const { limit, offset } = advboxPage(url.searchParams);
  let query = admin.from("clientes").select("*", { count: "exact" })
    .eq("tenant_id", t).is("deleted_at", null)
    .order("nome", { ascending: true }).range(offset, offset + limit - 1);
  const p = url.searchParams;
  if (p.get("name")) query = query.ilike("nome", likePattern(p.get("name")!));
  if (p.get("email")) query = query.ilike("email", likePattern(p.get("email")!));
  if (p.get("phone")) query = query.ilike("telefone", likePattern(p.get("phone")!));
  const doc = p.get("document") ?? p.get("identification");
  if (doc) query = query.ilike("cpf", likePattern(doc));
  if (p.get("created_start") && p.get("created_end")) {
    query = query.gte("created_at", p.get("created_start")!).lte("created_at", `${p.get("created_end")}T23:59:59Z`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const lawsuits = await lawsuitsOf(admin, t, rows.map((row) => String(row.id)));
  return envelope(
    rows.map((row) => customerToOutput(row, lawsuits.filter((l) => l.cliente_id === row.id))),
    count ?? rows.length, limit, offset, Object.fromEntries(p),
  );
}

async function lawsuits(
  admin: SupabaseClient, token: AdvboxToken, method: string, route: AdvboxRoute,
  url: URL, input: unknown,
): Promise<AdvboxResult> {
  const write = method === "POST" || method === "PUT";
  requireScope(token.scopes, write ? "processes:write" : "processes:read");
  const t = token.tenantId;
  if (write) {
    const { patch, customerId } = lawsuitFromInput(input, method === "POST" ? "create" : "update");
    if (customerId) {
      const customer = await must(admin.from("clientes").select("id, nome").eq("tenant_id", t)
        .eq("id", customerId).is("deleted_at", null).maybeSingle()) as Row | null;
      if (!customer) throw new PublicApiContractError("invalid_relationship", 422, "customers_id");
      patch.cliente_id = customer.id;
      patch.cliente_nome = customer.nome;
    }
    if (method === "POST") {
      const data = await must(admin.from("processos").insert({
        ...patch, tenant_id: t, user_id: token.actorUserId, fonte: "advbox_api",
      }).select("id").single()) as Row;
      return ok({ success: true, lawsuits_id: data.id }, 201);
    }
    if (!route.id) throw new PublicApiContractError("resource_id_required", 400);
    const data = await must(admin.from("processos").update({ ...patch, updated_at: new Date().toISOString() })
      .eq("tenant_id", t).eq("id", route.id).is("deleted_at", null)
      .select("id").maybeSingle()) as Row | null;
    return data ? ok({ success: true, lawsuits_id: data.id }) : notFound();
  }
  if (route.id) {
    const row = await must(admin.from("processos").select("*").eq("tenant_id", t)
      .eq("id", route.id).is("deleted_at", null).maybeSingle()) as Row | null;
    return row ? ok(lawsuitToOutput(row)) : notFound();
  }
  const { limit, offset } = advboxPage(url.searchParams);
  const p = url.searchParams;
  let query = admin.from("processos").select("*", { count: "exact" })
    .eq("tenant_id", t).is("deleted_at", null)
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (p.get("process_number")) query = query.ilike("numero", likePattern(p.get("process_number")!));
  if (p.get("customer_id")) query = query.eq("cliente_id", p.get("customer_id")!);
  if (p.get("name")) query = query.ilike("cliente_nome", likePattern(p.get("name")!));
  if (p.get("stage")) query = query.eq("status", p.get("stage")!);
  if (p.get("type") || p.get("group")) query = query.eq("area", (p.get("type") ?? p.get("group"))!);
  if (p.get("notes")) query = query.ilike("descricao", likePattern(p.get("notes")!));
  if (p.get("created_start") && p.get("created_end")) {
    query = query.gte("created_at", p.get("created_start")!).lte("created_at", `${p.get("created_end")}T23:59:59Z`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return envelope(((data ?? []) as Row[]).map(lawsuitToOutput), count ?? 0, limit, offset, Object.fromEntries(p));
}

/** Tipos de tarefa do escritório; vazio se o catálogo ainda não existe no banco. */
async function taskTypes(admin: SupabaseClient, tenantId: string): Promise<Row[]> {
  const { data, error } = await admin.from("tipos_tarefa").select("id, nome, categoria, pontos")
    .eq("tenant_id", tenantId).eq("ativo", true).order("nome");
  return error ? [] : (data ?? []) as Row[];
}

async function lawsuitById(admin: SupabaseClient, tenantId: string, id: string) {
  return await must(admin.from("processos").select("id, numero, cliente_id, cliente_nome")
    .eq("tenant_id", tenantId).eq("id", id).is("deleted_at", null)
    .maybeSingle()) as Row | null;
}

async function movements(
  admin: SupabaseClient, token: AdvboxToken, method: string, route: AdvboxRoute,
  url: URL, input: unknown,
): Promise<AdvboxResult> {
  const t = token.tenantId;
  if (method === "POST") {
    requireScope(token.scopes, "processes:write");
    const data = movementFromInput(input);
    const lawsuit = await lawsuitById(admin, t, data.lawsuitId);
    if (!lawsuit) throw new PublicApiContractError("invalid_relationship", 422, "lawsuit_id");
    await must(admin.from("andamentos").insert({
      tenant_id: t, user_id: token.actorUserId, processo_id: lawsuit.id,
      numero_processo: lawsuit.numero, data_andamento: movementTimestamp(data.date),
      descricao: data.description, origem: "manual", tipo: "manual",
    }).select("id").single());
    return ok({ success: true, lawsuits_id: lawsuit.id }, 201);
  }
  requireScope(token.scopes, "processes:read");
  const customersOf = (lawsuit: Row | null) => lawsuit?.cliente_id
    ? [{ customer_id: lawsuit.cliente_id, name: lawsuit.cliente_nome ?? null }] : [];
  const p = url.searchParams;
  if (route.resource === "movements") {
    const lawsuit = await lawsuitById(admin, t, route.id ?? "");
    if (!lawsuit) return notFound();
    let query = admin.from("andamentos").select("*").eq("tenant_id", t)
      .eq("processo_id", lawsuit.id).order("data_andamento", { ascending: false });
    const origin = p.get("origin");
    if (origin === "MANUAL") query = query.eq("origem", "manual");
    else if (origin === "TRIBUNAL") query = query.neq("origem", "manual");
    const rows = (await must(query)) as Row[];
    if (rows.length === 0) return { body: {}, status: 204 };
    return ok({ data: rows.map((row) => movementToOutput(row, lawsuit.id, customersOf(lawsuit))) });
  }
  const { limit, offset } = advboxPage(p, 100);
  let query = admin.from("andamentos").select("*", { count: "exact" }).eq("tenant_id", t)
    .not("processo_id", "is", null).order("data_andamento", { ascending: false })
    .range(offset, offset + limit - 1);
  if (p.get("lawsuit_id")) query = query.eq("processo_id", p.get("lawsuit_id")!);
  if (p.get("process_number")) query = query.eq("numero_processo", p.get("process_number")!);
  if (p.get("date_start")) query = query.gte("data_andamento", p.get("date_start")!);
  if (p.get("date_end")) query = query.lte("data_andamento", p.get("date_end")!);
  const { data, error, count } = await query;
  if (error) throw error;
  // Um andamento por processo: a lista já vem do mais recente para o mais antigo.
  const seen = new Set<string>();
  const latest = ((data ?? []) as Row[]).filter((row) => {
    const key = String(row.processo_id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return envelope(latest.map((row) => movementToOutput(row, row.processo_id)), count ?? latest.length, limit, offset, Object.fromEntries(p));
}

async function posts(
  admin: SupabaseClient, token: AdvboxToken, method: string, url: URL, input: unknown,
): Promise<AdvboxResult> {
  const t = token.tenantId;
  if (method === "POST") {
    requireScope(token.scopes, "tasks:write");
    const data = postFromInput(input);
    const lawsuit = await lawsuitById(admin, t, data.lawsuitId);
    if (!lawsuit) throw new PublicApiContractError("invalid_relationship", 422, "lawsuits_id");
    const member = await must(admin.from("tenant_memberships").select("user_id")
      .eq("tenant_id", t).eq("user_id", data.assigneeId).eq("status", "active")
      .maybeSingle()) as Row | null;
    if (!member) throw new PublicApiContractError("invalid_relationship", 422, "guests");
    // tasks_id aponta para um tipo do catálogo; sem correspondência, a tarefa
    // nasce com o texto do comentário como título.
    const type = (await taskTypes(admin, t)).find((item) => item.id === data.taskTypeId) ?? null;
    const created = await must(admin.from("tarefas").insert({
      tenant_id: t, user_id: token.actorUserId,
      titulo: (type?.nome as string | undefined) ?? data.description?.slice(0, 120) ?? "Tarefa",
      descricao: data.description,
      tipo: "tarefa", categoria: type?.categoria ?? null, pontos: type?.pontos ?? 0,
      prioridade: data.urgent ? "alta" : "média", data_limite: data.dueDate,
      processo_id: lawsuit.id, responsavel_id: member.user_id,
    }).select("id").single()) as Row;
    return ok({ success: true, posts_id: created.id });
  }
  requireScope(token.scopes, "tasks:read");
  const { limit, offset } = advboxPage(url.searchParams);
  const p = url.searchParams;
  let query = admin.from("tarefas").select("*", { count: "exact" }).eq("tenant_id", t)
    .is("deleted_at", null).order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (p.get("id")) query = query.eq("id", p.get("id")!);
  if (p.get("user_id")) query = query.eq("responsavel_id", p.get("user_id")!);
  if (p.get("lawsuit_id")) query = query.eq("processo_id", p.get("lawsuit_id")!);
  if (p.get("deadline_start") && p.get("deadline_end")) {
    query = query.gte("data_limite", p.get("deadline_start")!).lte("data_limite", `${p.get("deadline_end")}T23:59:59Z`);
  }
  if (p.get("created_start") && p.get("created_end")) {
    query = query.gte("created_at", p.get("created_start")!).lte("created_at", `${p.get("created_end")}T23:59:59Z`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.map((row) => row.processo_id).filter(Boolean))] as string[];
  const related = ids.length
    ? (await must(admin.from("processos").select("id, numero, cliente_nome").eq("tenant_id", t).in("id", ids))) as Row[]
    : [];
  return envelope(
    rows.map((row) => postToOutput(row, related.find((l) => l.id === row.processo_id) ?? null)),
    count ?? rows.length, limit, offset, Object.fromEntries(p),
  );
}

async function history(
  admin: SupabaseClient, token: AdvboxToken, route: AdvboxRoute, url: URL,
): Promise<AdvboxResult> {
  requireScope(token.scopes, "tasks:read");
  const lawsuit = await lawsuitById(admin, token.tenantId, route.id ?? "");
  if (!lawsuit) return notFound();
  const status = url.searchParams.get("status") ?? "all";
  let query = admin.from("tarefas").select("*").eq("tenant_id", token.tenantId)
    .eq("processo_id", lawsuit.id).is("deleted_at", null).order("created_at", { ascending: false });
  if (status === "completed") query = query.eq("status", "concluída");
  else if (status === "pending") query = query.neq("status", "concluída");
  const rows = (await must(query)) as Row[];
  return ok({ status, data: rows.map((row) => historyToOutput(row, lawsuit)) });
}

async function publications(
  admin: SupabaseClient, token: AdvboxToken, route: AdvboxRoute,
): Promise<AdvboxResult> {
  requireScope(token.scopes, "processes:read");
  const lawsuit = await lawsuitById(admin, token.tenantId, route.id ?? "");
  if (!lawsuit) return notFound();
  const rows = (await must(admin.from("publicacoes").select("*").eq("tenant_id", token.tenantId)
    .eq("process_id", lawsuit.id).order("data_publicacao", { ascending: false }))) as Row[];
  return ok({ data: rows.map((row) => publicationToOutput(row, lawsuit)) });
}

async function settings(admin: SupabaseClient, token: AdvboxToken): Promise<AdvboxResult> {
  requireScope(token.scopes, "processes:read");
  const t = token.tenantId;
  const members = (await must(admin.from("tenant_memberships").select("user_id, role")
    .eq("tenant_id", t).eq("status", "active"))) as Row[];
  const profiles = members.length
    ? (await must(admin.from("profiles").select("id, email")
      .in("id", members.map((m) => String(m.user_id))))) as Row[]
    : [];
  const types = await taskTypes(admin, t);
  // status e area são texto livre: o catálogo é o que o escritório já usa.
  const used = (await must(admin.from("processos").select("status, area")
    .eq("tenant_id", t).is("deleted_at", null).limit(5000))) as Row[];
  const distinct = (key: string) => [...new Set(used.map((row) => row[key]).filter(Boolean))] as string[];
  const named = (items: string[]) => items.map((name) => ({ id: name, name }));
  return ok({
    users: members.map((m) => ({
      id: m.user_id, name: profiles.find((p) => p.id === m.user_id)?.email ?? null, role: m.role,
    })),
    origins: named(ORIGINS),
    tasks: types.map((type) => ({ id: type.id, name: type.nome, reward: type.pontos })),
    stages: named(distinct("status")),
    lawsuit_types: named(distinct("area")),
    financial: {
      banks: await financeCatalog(admin, t, "conta_bancaria"),
      categories: await financeCatalog(admin, t, "categoria_financeira"),
      cost_centers: await financeCatalog(admin, t, "centro_custo"),
      departments: await financeCatalog(admin, t, "departamento"),
    },
  });
}

async function financeCatalog(admin: SupabaseClient, tenantId: string, tipo: string) {
  const rows = (await must(admin.from("catalogo_escritorio").select("id, nome")
    .eq("tenant_id", tenantId).eq("tipo", tipo).eq("ativo", true).order("nome"))) as Row[];
  return rows.map((row) => ({ id: row.id, name: row.nome }));
}

/** Confere que o item do catálogo existe no escritório e é do tipo esperado. */
async function catalogRef(admin: SupabaseClient, tenantId: string, tipo: string, id: string, field: string) {
  const row = await must(admin.from("catalogo_escritorio").select("id").eq("tenant_id", tenantId)
    .eq("tipo", tipo).eq("ativo", true).eq("id", id).maybeSingle()) as Row | null;
  if (!row) throw new PublicApiContractError("invalid_relationship", 422, field);
  return row.id as string;
}

async function transactions(
  admin: SupabaseClient, token: AdvboxToken, method: string, route: AdvboxRoute,
  url: URL, input: unknown,
): Promise<AdvboxResult> {
  const t = token.tenantId;
  if (method === "POST") {
    requireScope(token.scopes, "finance:write");
    const { patch, refs } = transactionFromInput(input, "create");
    patch.categoria_id = await catalogRef(admin, t, "categoria_financeira", refs.categoryId as string, "categories_id");
    patch.centro_custo_id = await catalogRef(admin, t, "centro_custo", refs.costCenterId as string, "cost_centers_id");
    patch.conta_id = await catalogRef(admin, t, "conta_bancaria", refs.accountId as string, "debit_account");
    if (refs.customerId) {
      const customer = await must(admin.from("clientes").select("id").eq("tenant_id", t)
        .eq("id", refs.customerId).is("deleted_at", null).maybeSingle()) as Row | null;
      if (!customer) throw new PublicApiContractError("invalid_relationship", 422, "customers_id");
      patch.cliente_id = customer.id;
    }
    if (refs.lawsuitId) {
      const lawsuit = await lawsuitById(admin, t, refs.lawsuitId);
      if (!lawsuit) throw new PublicApiContractError("invalid_relationship", 422, "lawsuits_id");
      patch.processo_id = lawsuit.id;
    }
    const data = await must(admin.from("financeiro").insert({ ...patch, tenant_id: t, user_id: token.actorUserId })
      .select("id").single()) as Row;
    return ok({ success: true, transactions_id: data.id }, 201);
  }
  if (method === "PUT") {
    requireScope(token.scopes, "finance:write");
    if (!route.id) throw new PublicApiContractError("resource_id_required", 400);
    const { patch } = transactionFromInput(input, "update");
    const data = await must(admin.from("financeiro").update(patch).eq("tenant_id", t).eq("id", route.id)
      .select("id").maybeSingle()) as Row | null;
    return data ? ok({ success: true, transactions_id: data.id }) : notFound();
  }
  requireScope(token.scopes, "finance:read");
  if (route.id) {
    const row = await must(admin.from("financeiro").select("*").eq("tenant_id", t).eq("id", route.id)
      .maybeSingle()) as Row | null;
    return row ? ok(transactionToOutput(row)) : notFound();
  }
  const { limit, offset } = advboxPage(url.searchParams);
  const p = url.searchParams;
  let query = admin.from("financeiro").select("*", { count: "exact" }).eq("tenant_id", t)
    .order("data_vencimento", { ascending: false }).range(offset, offset + limit - 1);
  const type = p.get("entry_type") ?? p.get("type");
  if (type === "income") query = query.eq("tipo", "honorario");
  else if (type === "expense") query = query.neq("tipo", "honorario");
  const status = p.get("status");
  if (status) query = query.eq("status", status === "paid" ? "pago" : status === "pending" ? "pendente" : status === "overdue" ? "atrasado" : status);
  if (p.get("date_start")) query = query.gte("data_vencimento", advboxDate(p.get("date_start"), "date_start") as string);
  if (p.get("date_end")) query = query.lte("data_vencimento", advboxDate(p.get("date_end"), "date_end") as string);
  const { data, error, count } = await query;
  if (error) throw error;
  return envelope(((data ?? []) as Row[]).map(transactionToOutput), count ?? 0, limit, offset, Object.fromEntries(p));
}

const DOCUMENT_URL_SECONDS = 300;

async function documents(
  admin: SupabaseClient, token: AdvboxToken, route: AdvboxRoute, url: URL,
): Promise<AdvboxResult> {
  requireScope(token.scopes, "processes:read");
  const t = token.tenantId;
  if (route.id) {
    const row = await must(admin.from("documentos").select("id, nome, arquivo_path")
      .eq("tenant_id", t).eq("id", route.id).maybeSingle()) as Row | null;
    if (!row) return notFound();
    const signed = await admin.storage.from("documentos").createSignedUrl(row.arquivo_path as string, DOCUMENT_URL_SECONDS);
    if (signed.error || !signed.data) throw new PublicApiContractError("document_unavailable", 502);
    return ok({ data: { id: row.id, name: row.nome, temporary_url: signed.data.signedUrl, expires_in_seconds: DOCUMENT_URL_SECONDS } });
  }
  const p = url.searchParams;
  const name = p.get("name");
  const customerId = p.get("customer_id");
  const lawsuitId = p.get("lawsuit_id");
  if (!name && !customerId && !lawsuitId) {
    throw new PublicApiContractError("filter_required", 422, "name");
  }
  if (name && name.trim().length < 3) throw new PublicApiContractError("name_too_short", 422, "name");
  const { limit, offset } = advboxPage(p);
  let query = admin.from("documentos").select("*", { count: "exact" }).eq("tenant_id", t)
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (name) query = query.ilike("nome", likePattern(name.trim()));
  if (lawsuitId) query = query.eq("processo_id", lawsuitId);
  if (customerId) {
    const ids = ((await must(admin.from("processos").select("id").eq("tenant_id", t)
      .eq("cliente_id", customerId).is("deleted_at", null))) as Row[]).map((row) => row.id as string);
    if (ids.length === 0) return envelope([], 0, limit, offset, Object.fromEntries(p));
    query = query.in("processo_id", ids);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const lawsuitIds = [...new Set(rows.map((row) => row.processo_id).filter(Boolean))] as string[];
  const related = lawsuitIds.length
    ? (await must(admin.from("processos").select("id, numero").eq("tenant_id", t).in("id", lawsuitIds))) as Row[]
    : [];
  return envelope(
    rows.map((row) => documentToOutput(row, related.find((item) => item.id === row.processo_id) ?? null)),
    count ?? rows.length, limit, offset, Object.fromEntries(p),
  );
}

/**
 * O banco só aceita gravar em nome de um membro ativo do escritório. Um token
 * emitido em modo suporte nasce de quem não é membro; nesse caso a gravação
 * é atribuída ao proprietário do escritório.
 */
async function writerOf(admin: SupabaseClient, token: AdvboxToken): Promise<string> {
  const members = (await must(admin.from("tenant_memberships").select("user_id, role")
    .eq("tenant_id", token.tenantId).eq("status", "active"))) as Row[];
  if (members.some((member) => member.user_id === token.actorUserId)) return token.actorUserId;
  const owner = members.find((member) => member.role === "owner") ?? members[0];
  if (!owner) throw new PublicApiContractError("tenant_without_members", 409);
  return owner.user_id as string;
}

export async function handleAdvbox(
  admin: SupabaseClient, original: AdvboxToken, method: string, route: AdvboxRoute,
  url: URL, input: unknown,
): Promise<AdvboxResult> {
  const read = method === "GET";
  const token = read ? original : { ...original, actorUserId: await writerOf(admin, original) };
  switch (route.resource) {
    case "customers":
      if ((read && !route.action) || method === "POST" || route.action === "birthdays") {
        if (route.action === "birthdays") return ok({ offset: 0, limit: 0, totalCount: 0, data: [], query: {} });
        if (read || !route.id) return await customers(admin, token, method, route, url, input);
      }
      break;
    case "lawsuits":
      if (read || method === "POST" || (method === "PUT" && route.id)) {
        return await lawsuits(admin, token, method, route, url, input);
      }
      break;
    case "movements":
      if ((read && route.id) || (method === "POST" && !route.id)) {
        return await movements(admin, token, method, route, url, input);
      }
      break;
    case "last_movements":
      if (read) return await movements(admin, token, method, route, url, input);
      break;
    case "posts":
      if (read || method === "POST") return await posts(admin, token, method, url, input);
      break;
    case "history":
      if (read && route.id) return await history(admin, token, route, url);
      break;
    case "publications":
      if (read && route.id) return await publications(admin, token, route);
      break;
    case "settings":
      if (read && !route.id) return await settings(admin, token);
      break;
    case "transactions":
      if (read || method === "POST" || (method === "PUT" && route.id)) {
        return await transactions(admin, token, method, route, url, input);
      }
      break;
    case "documents":
      if (read) return await documents(admin, token, route, url);
      break;
  }
  throw new PublicApiContractError("method_not_allowed", 405);
}
