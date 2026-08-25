import { supabase } from "@/integrations/supabase/client";
import { EdgeFunctionError, readEdgeError } from "@/lib/edge-errors";
import { buildTenantDocumentPath } from "@/lib/tenant-storage";
import type { ActivityStatus } from "@/types/activities";
import type { ProtocoloTipo } from "@/types/controladoria";

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

const protocolMessages: Record<string, string> = {
  unauthorized: "Faça login novamente para registrar o protocolo.",
  permission_denied: "Seu acesso não permite esta ação neste escritório.",
  invalid_tipo: "Escolha um ato válido para o protocolo.",
  processo_not_identified: "Informe o processo ou o número do processo.",
  processo_not_found: "O processo informado não pertence a este escritório.",
  tarefa_not_found: "O prazo deste protocolo não está mais disponível. Atualize a tela.",
  responsavel_not_found: "O responsável escolhido não está ativo neste escritório.",
  prazo_com_responsavel_inativo:
    "O responsável do prazo não está mais ativo. Troque o responsável antes de protocolar.",
};

/** Traduz os erros nomeados que `register_protocol` levanta. */
export function describeProtocolError(error: { code?: string; message?: string } | null): string {
  const named = Object.keys(protocolMessages).find(key => error?.message?.includes(key));
  return named ? protocolMessages[named] : describePostgrestError(error);
}

export interface RegisterProtocolInput {
  tenantId: string;
  tipo: ProtocoloTipo;
  protocoladoEm: string;
  processoId: string | null;
  numeroProcesso: string | null;
  protocoloNumero: string | null;
  descricao: string | null;
  observacoes: string | null;
  responsavelId: string | null;
  tarefaId: string | null;
}

export async function registerProtocol(input: RegisterProtocolInput): Promise<{ id: string }> {
  // Os parâmetros opcionais já nascem `null` na função; omiti-los diz a mesma
  // coisa e respeita a assinatura gerada, que não aceita `null` explícito.
  const omitNull = (value: string | null) => value ?? undefined;
  const { data, error } = await supabase.rpc("register_protocol", {
    p_tenant_id: input.tenantId,
    p_tipo: input.tipo,
    p_protocolado_em: input.protocoladoEm,
    p_processo_id: omitNull(input.processoId),
    p_numero_processo: omitNull(input.numeroProcesso),
    p_protocolo_numero: omitNull(input.protocoloNumero),
    p_descricao: omitNull(input.descricao),
    p_observacoes: omitNull(input.observacoes),
    p_responsavel_id: omitNull(input.responsavelId),
    p_tarefa_id: omitNull(input.tarefaId),
  });
  if (error) throw new Error(describeProtocolError(error));
  const registered = Array.isArray(data) ? data[0] : data;
  if (!registered?.id) throw new Error("Não foi possível concluir a operação. Tente novamente.");
  return { id: registered.id };
}

export interface AttachProtocolDocumentsInput {
  tenantId: string;
  protocolId: string;
  processId: string | null;
  processNumber: string | null;
  userId: string;
  files: File[];
}

/**
 * Roda depois do protocolo já gravado, de propósito: uma falha aqui não desfaz
 * o ato registrado. Quem chama mostra o protocolo como persistido e oferece
 * tentar o anexo de novo.
 */
export async function attachProtocolDocuments(input: AttachProtocolDocumentsInput): Promise<void> {
  for (const file of input.files) {
    const documentId = crypto.randomUUID();
    const path = buildTenantDocumentPath({ tenantId: input.tenantId, documentId, fileName: file.name });
    const upload = await supabase.storage.from("documentos").upload(path, file);
    if (upload.error) throw new Error(`Não foi possível enviar o comprovante "${file.name}".`);

    const { error } = await supabase.from("documentos").insert({
      id: documentId,
      nome: file.name,
      tipo: "Comprovante de protocolo",
      arquivo_path: path,
      tamanho: file.size,
      processo_id: input.processId,
      processo_numero: input.processNumber,
      protocolo_id: input.protocolId,
      tenant_id: input.tenantId,
      user_id: input.userId,
    });
    if (error) {
      await supabase.storage.from("documentos").remove([path]);
      throw new Error(`Não foi possível anexar o comprovante "${file.name}".`);
    }
  }
}
