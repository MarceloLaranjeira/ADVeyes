import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CatalogKind =
  | "grupo_acao" | "tipo_acao" | "etapa" | "origem_pessoa" | "termo_monitorado" | "meta";

export type CatalogItem = Tables<"catalogo_escritorio">;
export type Partner = Tables<"parceiros">;
export type PartnerProcess = Tables<"parceiro_processos">;
export type DocumentTemplate = Tables<"modelos_documento">;

export interface PartnerInput {
  nome: string;
  email: string | null;
  telefone: string | null;
  oab: string | null;
  observacoes: string | null;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const officeService = {
  async listCatalog(tenantId: string, tipo: CatalogKind): Promise<CatalogItem[]> {
    const result = await supabase.from("catalogo_escritorio").select("*")
      .eq("tenant_id", tenantId).eq("tipo", tipo).order("ordem").order("nome");
    fail(result.error);
    return result.data ?? [];
  },

  async createCatalogItem(
    tenantId: string, userId: string, tipo: CatalogKind, nome: string, valor: number | null,
  ): Promise<void> {
    const { error } = await supabase.from("catalogo_escritorio")
      .insert({ tenant_id: tenantId, tipo, nome: nome.trim(), valor, created_by: userId });
    fail(error);
  },

  async setCatalogActive(tenantId: string, id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase.from("catalogo_escritorio").update({ ativo })
      .eq("tenant_id", tenantId).eq("id", id).select("id").single();
    fail(error);
  },

  async listPartners(tenantId: string): Promise<Partner[]> {
    const result = await supabase.from("parceiros").select("*").eq("tenant_id", tenantId).order("nome");
    fail(result.error);
    return result.data ?? [];
  },

  async createPartner(tenantId: string, userId: string, input: PartnerInput): Promise<void> {
    const { error } = await supabase.from("parceiros")
      .insert({ ...input, nome: input.nome.trim(), tenant_id: tenantId, created_by: userId });
    fail(error);
  },

  async setPartnerActive(tenantId: string, id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase.from("parceiros").update({ ativo })
      .eq("tenant_id", tenantId).eq("id", id).select("id").single();
    fail(error);
  },

  async listSharedProcesses(tenantId: string): Promise<PartnerProcess[]> {
    const result = await supabase.from("parceiro_processos").select("*")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false });
    fail(result.error);
    return result.data ?? [];
  },

  async shareProcess(
    tenantId: string, userId: string,
    input: { parceiroId: string; processoId: string; tipoAcao: string | null; direcao: "compartilhado" | "recebido" },
  ): Promise<void> {
    const { error } = await supabase.from("parceiro_processos").insert({
      tenant_id: tenantId, parceiro_id: input.parceiroId, processo_id: input.processoId,
      tipo_acao: input.tipoAcao, direcao: input.direcao, created_by: userId,
    });
    fail(error);
  },

  async setDemand(tenantId: string, id: string, pendente: boolean, descricao: string | null): Promise<void> {
    const { error } = await supabase.from("parceiro_processos")
      .update({ demanda_pendente: pendente, demanda_descricao: pendente ? descricao : null })
      .eq("tenant_id", tenantId).eq("id", id).select("id").single();
    fail(error);
  },

  async listTemplates(tenantId: string): Promise<DocumentTemplate[]> {
    const result = await supabase.from("modelos_documento").select("*").eq("tenant_id", tenantId).order("nome");
    fail(result.error);
    return result.data ?? [];
  },

  async saveTemplate(
    tenantId: string, userId: string,
    input: { id: string | null; nome: string; categoria: string | null; conteudo: string },
  ): Promise<void> {
    const fields = { nome: input.nome.trim(), categoria: input.categoria, conteudo: input.conteudo };
    const { error } = input.id
      ? await supabase.from("modelos_documento").update(fields).eq("tenant_id", tenantId).eq("id", input.id)
      : await supabase.from("modelos_documento").insert({ ...fields, tenant_id: tenantId, created_by: userId });
    fail(error);
  },

  async setTemplateActive(tenantId: string, id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase.from("modelos_documento").update({ ativo })
      .eq("tenant_id", tenantId).eq("id", id).select("id").single();
    fail(error);
  },
};
