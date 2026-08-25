import { supabase } from "@/integrations/supabase/client";

export type ControladoriaTab =
  | "prazos"
  | "intimacoes"
  | "audiencias"
  | "protocolos"
  | "movimentacoes"
  | "documentos";

export interface TabQuery {
  tenantId: string;
  page: number;
  pageSize: number;
  assigneeId: string | null;
  status: string | null;
  processId: string | null;
  from: string | null;
  to: string | null;
}

export interface NormalizedTabQuery extends TabQuery {
  range: readonly [number, number];
}

export type TabRow = Record<string, unknown> & { id: string };

export interface TabPage {
  rows: TabRow[];
  page: number;
  pageSize: number;
  total: number;
}

const PAGE_SIZES = [10, 20, 50] as const;

export function normalizeTabQuery(query: TabQuery): NormalizedTabQuery {
  const page = Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
  const pageSize = PAGE_SIZES.includes(query.pageSize as typeof PAGE_SIZES[number])
    ? query.pageSize
    : 20;
  const start = (page - 1) * pageSize;
  return { ...query, page, pageSize, range: [start, start + pageSize - 1] };
}

type FilterableQuery = {
  eq(column: string, value: string): FilterableQuery;
  is(column: string, value: null): FilterableQuery;
  gte(column: string, value: string): FilterableQuery;
  lte(column: string, value: string): FilterableQuery;
  order(column: string, options?: { ascending?: boolean }): FilterableQuery;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; count: number | null; error: { message: string } | null }>;
};

export async function fetchTabPage(tab: ControladoriaTab, raw: TabQuery): Promise<TabPage> {
  const params = normalizeTabQuery(raw);
  let query: FilterableQuery;
  let dateColumn: string;

  switch (tab) {
    case "prazos":
      query = supabase.from("tarefas").select("id, titulo, data_limite, status, responsavel_id, processo_id, prioridade", { count: "exact" }).eq("tenant_id", params.tenantId).eq("tipo", "prazo") as unknown as FilterableQuery;
      dateColumn = "data_limite";
      if (params.assigneeId) query = query.eq("responsavel_id", params.assigneeId);
      if (params.status) query = query.eq("status", params.status);
      break;
    case "intimacoes":
      query = supabase.from("publicacoes").select("id, tipo, numero_processo, cliente_nome, data_publicacao, review_status, ciencia_em, process_id", { count: "exact" }).eq("tenant_id", params.tenantId) as unknown as FilterableQuery;
      dateColumn = "data_publicacao";
      if (params.status) query = params.status === "sem_ciencia" ? query.is("ciencia_em", null) : query.eq("review_status", params.status);
      break;
    case "audiencias":
      query = supabase.from("audiencias").select("id, tipo, data_hora, status, processo_id, processo_numero, cliente_nome, local", { count: "exact" }).eq("tenant_id", params.tenantId) as unknown as FilterableQuery;
      dateColumn = "data_hora";
      if (params.status) query = query.eq("status", params.status);
      break;
    case "protocolos":
      query = supabase.from("protocolos").select("id, tipo, protocolado_em, processo_id, numero_processo, protocolo_numero, descricao, responsavel_id, tarefa_id", { count: "exact" }).eq("tenant_id", params.tenantId) as unknown as FilterableQuery;
      dateColumn = "protocolado_em";
      if (params.assigneeId) query = query.eq("responsavel_id", params.assigneeId);
      break;
    case "movimentacoes":
      query = supabase.from("process_movements").select("id, title, content, movement_type, occurred_at, process_id, process_number, client_name, provider", { count: "exact" }).eq("tenant_id", params.tenantId) as unknown as FilterableQuery;
      dateColumn = "occurred_at";
      break;
    case "documentos":
      query = supabase.from("documentos").select("id, nome, tipo, created_at, processo_id, processo_numero, protocolo_id, tamanho", { count: "exact" }).eq("tenant_id", params.tenantId) as unknown as FilterableQuery;
      dateColumn = "created_at";
      break;
  }

  if (params.processId) query = query.eq("processo_id", params.processId);
  if (params.from) query = query.gte(dateColumn, params.from);
  if (params.to) query = query.lte(dateColumn, params.to);

  const { data, count, error } = await query
    .order(dateColumn, { ascending: false })
    .range(params.range[0], params.range[1]);

  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as TabRow[], page: params.page, pageSize: params.pageSize, total: count ?? 0 };
}
