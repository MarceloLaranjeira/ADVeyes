import { supabase } from "@/integrations/supabase/client";
import type { CRMLead, CRMLeadInput } from "@/types/crm";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const crmService = {
  async list(tenantId: string): Promise<CRMLead[]> {
    const result = await supabase
      .from("leads")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    fail(result.error);
    return result.data ?? [];
  },

  async create(tenantId: string, userId: string, input: CRMLeadInput): Promise<void> {
    const { error } = await supabase.from("leads").insert({
      ...input,
      tenant_id: tenantId,
      user_id: userId,
    });
    fail(error);
  },

  async update(tenantId: string, leadId: string, input: Partial<CRMLeadInput>): Promise<void> {
    const result = await supabase
      .from("leads")
      .update(input)
      .eq("tenant_id", tenantId)
      .eq("id", leadId)
      .select("id")
      .single();
    fail(result.error);
  },

  async convert(tenantId: string, leadId: string): Promise<string> {
    const { data, error } = await supabase.rpc("convert_lead_to_client", {
      p_tenant_id: tenantId,
      p_lead_id: leadId,
    });
    fail(error);
    if (!data) throw new Error("Não foi possível converter o lead em cliente.");
    return data;
  },
};
