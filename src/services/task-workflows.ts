import { supabase } from "@/integrations/supabase/client";
import type { TaskType, TaskTypeInput, TaskWorkflow, TaskWorkflowStep, TaskWorkflowStepInput } from "@/types/task-workflows";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const taskWorkflowsService = {
  async listTypes(tenantId: string): Promise<TaskType[]> {
    const result = await supabase.from("tipos_tarefa").select("*").eq("tenant_id", tenantId).order("nome");
    fail(result.error);
    return result.data ?? [];
  },

  async createType(tenantId: string, userId: string, input: TaskTypeInput): Promise<void> {
    const { error } = await supabase.from("tipos_tarefa").insert({ ...input, tenant_id: tenantId, created_by: userId });
    fail(error);
  },

  async setTypeActive(tenantId: string, typeId: string, ativo: boolean): Promise<void> {
    const result = await supabase.from("tipos_tarefa").update({ ativo }).eq("tenant_id", tenantId).eq("id", typeId).select("id").single();
    fail(result.error);
  },

  async listWorkflows(tenantId: string): Promise<TaskWorkflow[]> {
    const workflows = await supabase.from("workflows_tarefa").select("*").eq("tenant_id", tenantId).order("nome");
    fail(workflows.error);
    const steps = await supabase.from("workflow_tarefa_etapas").select("*").eq("tenant_id", tenantId).order("ordem");
    fail(steps.error);
    const grouped = new Map<string, TaskWorkflowStep[]>();
    for (const step of steps.data ?? []) grouped.set(step.workflow_id, [...(grouped.get(step.workflow_id) ?? []), step]);
    return (workflows.data ?? []).map((workflow) => ({ ...workflow, steps: grouped.get(workflow.id) ?? [] }));
  },

  async createWorkflow(tenantId: string, nome: string, descricao: string | null, etapas: TaskWorkflowStepInput[]): Promise<string> {
    const { data, error } = await supabase.rpc("create_task_workflow", {
      p_tenant_id: tenantId,
      p_nome: nome,
      p_descricao: descricao,
      p_etapas: etapas.map((etapa) => ({ tipo_tarefa_id: etapa.tipoTarefaId, prazo_offset_dias: etapa.prazoOffsetDias })),
    });
    fail(error);
    if (!data) throw new Error("Não foi possível criar o workflow.");
    return data;
  },

  async setWorkflowActive(tenantId: string, workflowId: string, ativo: boolean): Promise<void> {
    const result = await supabase.from("workflows_tarefa").update({ ativo }).eq("tenant_id", tenantId).eq("id", workflowId).select("id").single();
    fail(result.error);
  },

  async apply(tenantId: string, workflowId: string, processId: string | null, assigneeId: string | null, startDate: string): Promise<number> {
    const { data, error } = await supabase.rpc("apply_task_workflow", {
      p_tenant_id: tenantId,
      p_workflow_id: workflowId,
      p_processo_id: processId,
      p_responsavel_id: assigneeId,
      p_inicio: startDate,
    });
    fail(error);
    return data ?? 0;
  },
};
