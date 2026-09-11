/**
 * Conecta um escritório ao ClickUp em uma chamada.
 *
 * Cria o Space no workspace do próprio escritório, aplica a pasta modelo uma
 * vez por área (trazendo campos e statuses junto), descobre os ids gerados,
 * grava a conexão e enfileira a carteira existente. Do ponto de vista de quem
 * usa, conectar e ver os processos aparecerem é o mesmo gesto.
 *
 * Só quem administra o tenant pode chamar: a operação cria estrutura no
 * ClickUp do escritório e passa a exportar dado processual para lá.
 */

import {
  authenticateTenantRequest,
  corsHeaders,
  json,
  resolveTenantLegalAccess,
} from "../_shared/tenant-auth.ts";
import { ClickUpError } from "../_shared/clickup.ts";
import { backfillTenant, provisionTenant } from "../_shared/clickup-provision.ts";

interface ProvisionBody {
  tenantId?: string;
  token?: string;
  workspaceId?: string;
  folderTemplateId?: string;
  spaceName?: string;
  /** Deixe falso para conferir o Space antes de despejar a carteira. */
  backfill?: boolean;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticateTenantRequest(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({})) as ProvisionBody;
  const tenantId = body.tenantId?.trim();
  const token = body.token?.trim();
  const workspaceId = body.workspaceId?.trim();
  const folderTemplateId = body.folderTemplateId?.trim();

  if (!tenantId || !token || !workspaceId || !folderTemplateId) {
    return json({
      error: "tenantId, token, workspaceId e folderTemplateId são obrigatórios",
      code: "invalid_request",
    }, 400);
  }

  try {
    const access = await resolveTenantLegalAccess(auth.admin, auth.user.id, tenantId);
    if (!access || !access.canManageAll || !access.canMutate) {
      return json({ error: "forbidden", code: "insufficient_permission" }, 403);
    }

    const result = await provisionTenant(auth.admin, {
      tenantId,
      token,
      workspaceId,
      folderTemplateId,
      spaceName: body.spaceName,
      connectedBy: auth.user.id,
    });

    // Só depois da conexão gravada: o backfill checa conexão ativa e falharia
    // se corresse antes.
    const enqueued = body.backfill === false
      ? null
      : await backfillTenant(auth.admin, tenantId);

    await auth.admin.from("tenant_audit_events").insert({
      tenant_id: tenantId,
      actor_user_id: auth.user.id,
      action: "clickup.provisioned",
      target_type: "clickup_space",
      target_id: result.spaceId,
      metadata: {
        workspace_id: workspaceId,
        areas: Object.keys(result.listMap).length,
        fields: Object.keys(result.fieldMap).length,
        enqueued,
      },
    });

    return json({
      spaceId: result.spaceId,
      listMap: result.listMap,
      fieldMap: result.fieldMap,
      enqueued,
    });
  } catch (error) {
    const clickUpError = error instanceof ClickUpError
      ? error
      : new ClickUpError("Erro interno", "internal_error");
    console.error("clickup-provision", {
      code: clickUpError.code,
      status: clickUpError.status,
    });
    return json(
      { error: clickUpError.message, code: clickUpError.code },
      clickUpError.status,
    );
  }
});
