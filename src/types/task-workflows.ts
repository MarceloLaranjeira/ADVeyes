import type { Database } from "@/integrations/supabase/types";

export type TaskType = Database["public"]["Tables"]["tipos_tarefa"]["Row"];
export type TaskWorkflowRow = Database["public"]["Tables"]["workflows_tarefa"]["Row"];
export type TaskWorkflowStep = Database["public"]["Tables"]["workflow_tarefa_etapas"]["Row"];

export interface TaskWorkflow extends TaskWorkflowRow {
  steps: TaskWorkflowStep[];
}

export interface TaskTypeInput {
  nome: string;
  categoria: string | null;
  pontos: number;
  prazo_padrao_dias: number | null;
}

export interface TaskWorkflowStepInput {
  tipoTarefaId: string;
  prazoOffsetDias: number;
}
