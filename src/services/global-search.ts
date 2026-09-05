import { supabase } from "@/integrations/supabase/client";

export type GlobalSearchKind = "contact" | "process" | "task" | "hearing";

export interface GlobalSearchResult {
  id: string;
  kind: GlobalSearchKind;
  title: string;
  subtitle: string;
  href: string;
}

export interface GlobalSearchResponse {
  results: GlobalSearchResult[];
  failures: GlobalSearchKind[];
}

const compactQuery = (query: string) =>
  query.trim().replace(/\s+/g, " ").replace(/[%_,()"'\\]/g, " ").trim();

const orTerm = (columns: string[], query: string) =>
  columns.map((column) => `${column}.ilike.%${query}%`).join(",");

export async function searchGlobal(
  tenantId: string,
  rawQuery: string,
  perKind = 5,
): Promise<GlobalSearchResponse> {
  const query = compactQuery(rawQuery);
  if (!tenantId || query.length < 2) return { results: [], failures: [] };

  const requests = [
    supabase
      .from("clientes")
      .select("id,nome,cpf,email,telefone")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(orTerm(["nome", "cpf", "email", "telefone"], query))
      .order("nome")
      .limit(perKind),
    supabase
      .from("processos")
      .select("id,numero,cliente_nome,tribunal,status")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(orTerm(["numero", "cliente_nome", "tribunal", "status"], query))
      .order("updated_at", { ascending: false })
      .limit(perKind),
    supabase
      .from("tarefas")
      .select("id,titulo,descricao,status,data_limite")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(orTerm(["titulo", "descricao", "status"], query))
      .order("updated_at", { ascending: false })
      .limit(perKind),
    supabase
      .from("audiencias")
      .select("id,tipo,processo_numero,cliente_nome,vara,data_hora,status")
      .eq("tenant_id", tenantId)
      .or(orTerm(["tipo", "processo_numero", "cliente_nome", "vara", "status"], query))
      .order("data_hora", { ascending: true })
      .limit(perKind),
  ] as const;

  const [contacts, processes, tasks, hearings] = await Promise.all(requests);
  const failures: GlobalSearchKind[] = [];
  if (contacts.error) failures.push("contact");
  if (processes.error) failures.push("process");
  if (tasks.error) failures.push("task");
  if (hearings.error) failures.push("hearing");

  const results: GlobalSearchResult[] = [
    ...(contacts.data ?? []).map((item) => ({
      id: item.id,
      kind: "contact" as const,
      title: item.nome,
      subtitle: item.cpf || item.email || item.telefone || "Contato do escritório",
      href: `/clientes?q=${encodeURIComponent(item.nome)}&focus=${encodeURIComponent(item.id)}`,
    })),
    ...(processes.data ?? []).map((item) => ({
      id: item.id,
      kind: "process" as const,
      title: item.numero,
      subtitle: [item.cliente_nome, item.tribunal, item.status].filter(Boolean).join(" · "),
      href: `/processos/${encodeURIComponent(item.id)}`,
    })),
    ...(tasks.data ?? []).map((item) => ({
      id: item.id,
      kind: "task" as const,
      title: item.titulo,
      subtitle: [item.status, item.data_limite ? `Prazo ${item.data_limite}` : null].filter(Boolean).join(" · "),
      href: `/tarefas?task=${encodeURIComponent(item.id)}`,
    })),
    ...(hearings.data ?? []).map((item) => ({
      id: item.id,
      kind: "hearing" as const,
      title: item.tipo,
      subtitle: [item.processo_numero, item.cliente_nome, new Date(item.data_hora).toLocaleString("pt-BR")].filter(Boolean).join(" · "),
      href: `/audiencias?focus=${encodeURIComponent(item.id)}`,
    })),
  ];

  return { results, failures };
}

export const globalSearchKindLabel: Record<GlobalSearchKind, string> = {
  contact: "Contato",
  process: "Processo",
  task: "Atividade",
  hearing: "Audiência",
};
