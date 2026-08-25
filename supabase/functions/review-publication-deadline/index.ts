import {
  authenticateTenantRequest,
  corsHeaders,
  json,
} from "../_shared/tenant-auth.ts";

interface ReviewRequest {
  tenantId?: string;
  publicationId?: string;
  decision?: "confirm" | "reject";
  proposedDate?: string | null;
  proposedDays?: number | null;
  reason?: string;
  taskTitle?: string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  let body: ReviewRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }

  const tenantId = body.tenantId?.trim();
  const publicationId = body.publicationId?.trim();
  const decision = body.decision;
  const reason = body.reason?.trim();
  if (
    !tenantId || !publicationId || !reason ||
    !decision || !["confirm", "reject"].includes(decision)
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  const { data: membership, error: membershipError } = await auth.admin
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "operation_failed" }, 500);
  if (!membership) return json({ error: "permission_denied" }, 403);

  const { data: publication, error: publicationError } = await auth.admin
    .from("publicacoes")
    .select("id, numero_processo, tribunal, conteudo")
    .eq("tenant_id", tenantId)
    .eq("id", publicationId)
    .maybeSingle();
  if (publicationError) return json({ error: "operation_failed" }, 500);
  if (!publication) return json({ error: "publication_not_found" }, 404);

  if (decision === "reject") {
    const now = new Date().toISOString();
    const { error: suggestionError } = await auth.admin
      .from("deadline_suggestions")
      .upsert({
        tenant_id: tenantId,
        publication_id: publicationId,
        reason,
        status: "rejected",
        reviewed_by: auth.user.id,
        reviewed_at: now,
      }, { onConflict: "tenant_id,publication_id" });
    if (suggestionError) return json({ error: "operation_failed" }, 500);

    const { error: updateError } = await auth.admin.from("publicacoes").update({
      review_status: "no_deadline",
      possible_deadline: false,
      status: "lida",
    }).eq("tenant_id", tenantId).eq("id", publicationId);
    if (updateError) {
      await auth.admin.from("deadline_suggestions").delete()
        .eq("tenant_id", tenantId)
        .eq("publication_id", publicationId);
      return json({ error: "operation_failed" }, 500);
    }
    return json({ reviewed: true, taskCreated: false });
  }

  const parsedDate = body.proposedDate ? new Date(body.proposedDate) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return json({ error: "invalid_deadline" }, 400);
  }
  const proposedDays = typeof body.proposedDays === "number" &&
      body.proposedDays > 0
    ? Math.trunc(body.proposedDays)
    : null;
  const title = body.taskTitle?.trim() ||
    `Revisar prazo — ${publication.numero_processo ?? publication.tribunal}`;

  const { data: task, error: taskError } = await auth.admin.from("tarefas")
    .insert({
      tenant_id: tenantId,
      user_id: auth.user.id,
      titulo: title,
      descricao:
        `Prazo confirmado manualmente a partir da publicação ${publication.tribunal}` +
        `${publication.numero_processo ? ` — processo ${publication.numero_processo}` : ""}.\n\n` +
        `Motivo da revisão: ${reason}\n\n` +
        `Trecho original:\n${publication.conteudo.slice(0, 1200)}`,
      prioridade: "alta",
      status: "pendente",
      data_limite: parsedDate.toISOString(),
      tipo: "prazo",
      source_type: "publicacao",
      source_id: publicationId,
    })
    .select("id")
    .single();
  if (taskError || !task) return json({ error: "operation_failed" }, 500);

  const reviewedAt = new Date().toISOString();
  const { error: suggestionError } = await auth.admin
    .from("deadline_suggestions")
    .upsert({
      tenant_id: tenantId,
      publication_id: publicationId,
      proposed_date: parsedDate.toISOString(),
      proposed_days: proposedDays,
      reason,
      status: "confirmed",
      confirmed_task_id: task.id,
      reviewed_by: auth.user.id,
      reviewed_at: reviewedAt,
    }, { onConflict: "tenant_id,publication_id" });
  if (suggestionError) {
    await auth.admin.from("tarefas").delete()
      .eq("tenant_id", tenantId)
      .eq("id", task.id);
    return json({ error: "operation_failed" }, 500);
  }

  const { error: updateError } = await auth.admin.from("publicacoes").update({
    prazo_dias: proposedDays,
    data_prazo: parsedDate.toISOString(),
    tarefa_gerada: true,
    status: "processada",
    review_status: "reviewed",
    possible_deadline: false,
  }).eq("tenant_id", tenantId).eq("id", publicationId);
  if (updateError) {
    await auth.admin.from("deadline_suggestions").delete()
      .eq("tenant_id", tenantId)
      .eq("publication_id", publicationId);
    await auth.admin.from("tarefas").delete()
      .eq("tenant_id", tenantId)
      .eq("id", task.id);
    return json({ error: "operation_failed" }, 500);
  }

  return json({ reviewed: true, taskCreated: true, taskId: task.id });
});
