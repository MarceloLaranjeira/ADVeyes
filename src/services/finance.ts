import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type FinanceInput = Pick<Database["public"]["Tables"]["financeiro"]["Insert"], "tipo" | "descricao" | "valor" | "data_vencimento" | "status">;
type ExpenseInput = Pick<Database["public"]["Tables"]["despesas_escritorio"]["Insert"], "descricao" | "categoria" | "valor" | "data_competencia" | "data_pagamento" | "status" | "recorrente">;
type GoalInput = Pick<Database["public"]["Tables"]["metas_financeiras"]["Insert"], "mes" | "ano" | "meta_receita" | "meta_novos_clientes" | "meta_horas">;

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const financeService = {
  async list(tenantId: string) {
    const [financial, expenses, goals] = await Promise.all([
      supabase.from("financeiro").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("despesas_escritorio").select("*").eq("tenant_id", tenantId).order("data_competencia", { ascending: false }),
      supabase.from("metas_financeiras").select("*").eq("tenant_id", tenantId).order("ano", { ascending: false }).order("mes", { ascending: false }),
    ]);
    fail(financial.error); fail(expenses.error); fail(goals.error);
    return { financial: financial.data ?? [], expenses: expenses.data ?? [], goals: goals.data ?? [] };
  },

  async createEntry(tenantId: string, userId: string, input: FinanceInput): Promise<void> {
    const { error } = await supabase.from("financeiro").insert({ ...input, tenant_id: tenantId, user_id: userId });
    fail(error);
  },

  async updateEntry(tenantId: string, entryId: string, input: FinanceInput): Promise<void> {
    const result = await supabase.from("financeiro").update(input).eq("tenant_id", tenantId).eq("id", entryId).select("id").single();
    fail(result.error);
  },

  async markEntryPaid(tenantId: string, entryId: string): Promise<void> {
    const result = await supabase.from("financeiro").update({ status: "pago", data_pagamento: new Date().toISOString().slice(0, 10) }).eq("tenant_id", tenantId).eq("id", entryId).select("id").single();
    fail(result.error);
  },

  async removeEntry(tenantId: string, entryId: string): Promise<void> {
    const result = await supabase.from("financeiro").delete().eq("tenant_id", tenantId).eq("id", entryId).select("id").single();
    fail(result.error);
  },

  async createExpense(tenantId: string, userId: string, input: ExpenseInput): Promise<void> {
    const { error } = await supabase.from("despesas_escritorio").insert({ ...input, tenant_id: tenantId, user_id: userId });
    fail(error);
  },

  async upsertGoal(tenantId: string, userId: string, input: GoalInput): Promise<void> {
    const { error } = await supabase.from("metas_financeiras").upsert({ ...input, tenant_id: tenantId, user_id: userId }, { onConflict: "user_id,mes,ano" });
    fail(error);
  },
};
