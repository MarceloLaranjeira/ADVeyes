import { supabase } from "@/integrations/supabase/client";
import { EdgeFunctionError, readEdgeError } from "@/lib/edge-errors";
import type { ActivityStatus } from "@/types/activities";

const edgeMessages: Record<string, string> = {
  invalid_payload: "Revise os dados do prazo e tente novamente.",
  invalid_deadline: "Informe uma data válida para o prazo.",
  permission_denied: "Seu acesso não permite esta ação neste escritório.",
  publication_not_found: "A intimação não está mais disponível. Atualize a tela.",
  operation_failed: "Não foi possível concluir a operação.",
};

export function describePostgrestError(error: { code?: string; message?: string } | null): string {
  if (error?.code === "42501") return "Seu acesso não permite esta ação neste escritório.";
  if (error?.code === "PGRST116") return "Este registro não está mais disponível. Atualize a tela.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

async function ensureUpdated(result: { error: { code?: string; message?: string } | null }): Promise<void> {
  if (result.error) throw new Error(describePostgrestError(result.error));
}

export async function acknowledgePublication(tenantId: string, publicationId: string, userId: string): Promise<void> {
  await ensureUpdated(await supabase.from("publicacoes").update({
    ciencia_em: new Date().toISOString(),
    ciencia_por: userId,
  }).eq("tenant_id", tenantId).eq("id", publicationId).select("id").single());
}

export async function assignDeadline(tenantId: string, taskId: string, assigneeId: string | null): Promise<void> {
  await ensureUpdated(await supabase.from("tarefas").update({ responsavel_id: assigneeId })
    .eq("tenant_id", tenantId).eq("id", taskId).eq("tipo", "prazo").select("id").single());
}

export async function changeDeadlineStatus(tenantId: string, taskId: string, status: ActivityStatus): Promise<void> {
  await ensureUpdated(await supabase.from("tarefas").update({
    status,
    concluida_em: status === "concluída" ? new Date().toISOString() : null,
  }).eq("tenant_id", tenantId).eq("id", taskId).eq("tipo", "prazo").select("id").single());
}

export interface ReviewPublicationDeadlineInput {
  tenantId: string;
  publicationId: string;
  proposedDate: string;
  proposedDays: number | null;
  reason: string;
  taskTitle: string;
}

export async function reviewPublicationDeadline(input: ReviewPublicationDeadlineInput): Promise<void> {
  const { error } = await supabase.functions.invoke("review-publication-deadline", {
    body: {
      tenantId: input.tenantId,
      publicationId: input.publicationId,
      decision: "confirm",
      proposedDate: new Date(`${input.proposedDate}T12:00:00`).toISOString(),
      proposedDays: input.proposedDays,
      reason: input.reason,
      taskTitle: input.taskTitle,
    },
  });
  if (!error) return;
  const { code, diagnosticId } = await readEdgeError(error);
  throw new EdgeFunctionError(code, edgeMessages, diagnosticId);
}
