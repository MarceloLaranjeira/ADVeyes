/**
 * Onboarding automático de um escritório no ClickUp.
 *
 * O que a API do ClickUp permite e o que não permite decide a forma deste
 * módulo, então vale registrar o levantamento (agosto/2026):
 *
 *   POST /team/{team}/space                          cria Space        ✓
 *   POST /space/{space}/folder_template/{template}   pasta de template ✓
 *   POST /space/{space}/list_template/{template}     lista de template ✓
 *   criar definição de custom field                                    ✗
 *   criar Space a partir de template                                   ✗
 *   definir statuses customizados no POST de Space                     ✗
 *
 * As duas últimas ausências parecem fatais para automação — mas não são, e a
 * saída é a pasta. Um *folder template* carrega consigo as listas, os statuses
 * (`options.old_statuses`) e as definições de custom field
 * (`options.custom_fields`). Então:
 *
 *   1. Monta-se UMA pasta modelo à mão, uma única vez, com os campos e os
 *      statuses do ADVeyes, e salva-se como folder template.
 *   2. Para cada escritório novo, o código cria o Space vazio e aplica esse
 *      template uma vez por área. Campos e statuses vêm junto, com ids novos.
 *   3. Os ids novos são descobertos por GET e viram o `field_map` do tenant.
 *
 * É por isso que `field_map` é coluna por tenant e não constante no código:
 * cada aplicação do template gera ids diferentes.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { ClickUpError, cuFetch, encryptToken } from "./clickup.ts";

/** Áreas do ADVeyes — espelham src/components/processos/ProcessoForm.tsx. */
export const AREAS = [
  "Penal",
  "Cível",
  "Família",
  "Execução Penal",
  "Recurso",
  "Trabalhista",
] as const;

/**
 * Nome do campo no ClickUp -> chave lógica lida pelo worker.
 *
 * A comparação é feita sobre o nome normalizado (minúsculo, sem acento), para
 * que "Nº CNJ", "N CNJ" e "nº cnj" resolvam para a mesma chave. Se alguém
 * renomear um campo na interface, ele deixa de ser encontrado e o
 * provisionamento acusa — que é melhor do que sincronizar com campo faltando.
 */
const FIELD_ALIASES: Record<string, string> = {
  "n cnj": "numero_cnj",
  "numero cnj": "numero_cnj",
  "vara": "vara",
  "area": "area",
  "cliente": "cliente",
  "polo ativo": "polo_ativo",
  "polo passivo": "polo_passivo",
  "prob de exito": "percentual_exito",
  "probabilidade de exito": "percentual_exito",
  "ultima movimentacao": "ultima_movimentacao",
  "abrir no adveyes": "link_adveyes",
  "adveyes id": "adveyes_id",
  "disponibilizacao": "disponibilizacao",
  "publicacao cpc 224 2": "publicacao_cpc",
  "publicacao": "publicacao_cpc",
  "dias": "dias",
  "base do calculo": "base_calculo",
  "conferencia": "conferencia",
  "publicacao id": "publicacao_id",
};

/** Campos sem os quais o espelhamento não faz sentido. */
const REQUIRED_KEYS = ["numero_cnj", "adveyes_id", "conferencia"];

function normalizeFieldName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface ProvisionRequest {
  tenantId: string;
  /** Token do escritório: OAuth ou pessoal. Nunca é persistido em claro. */
  token: string;
  /** Workspace (team) de destino — o do próprio escritório. */
  workspaceId: string;
  /** Folder template previamente salvo na conta que hospeda o modelo. */
  folderTemplateId: string;
  /** Nome do Space a criar. */
  spaceName?: string;
  connectedBy?: string;
}

export interface ProvisionResult {
  spaceId: string;
  listMap: Record<string, string>;
  fieldMap: Record<string, string>;
  missingFields: string[];
}

/**
 * Cria o Space e aplica o template por área.
 *
 * `return_immediately: false` faz o ClickUp responder só depois de materializar
 * a pasta. É mais lento, mas sem isso o GET seguinte encontra a pasta pela
 * metade e o field_map sai incompleto — falha silenciosa, a pior espécie.
 */
async function createSpaceWithFolders(
  token: string,
  workspaceId: string,
  folderTemplateId: string,
  spaceName: string,
): Promise<{ spaceId: string; folderIds: Record<string, string> }> {
  const space = await cuFetch(token, `/team/${workspaceId}/space`, {
    method: "POST",
    body: JSON.stringify({
      name: spaceName,
      multiple_assignees: true,
      features: {
        due_dates: { enabled: true, start_date: true, remap_due_dates: false },
        time_tracking: { enabled: true },
        tags: { enabled: true },
        checklists: { enabled: true },
        custom_fields: { enabled: true },
        dependency_warning: { enabled: true },
      },
    }),
  });

  const spaceId = String(space.id ?? "");
  if (!spaceId) {
    throw new ClickUpError("ClickUp não devolveu o id do Space", "space_create_failed");
  }

  const folderIds: Record<string, string> = {};
  for (const area of AREAS) {
    const folder = await cuFetch(token, `/space/${spaceId}/folder_template/${folderTemplateId}`, {
      method: "POST",
      body: JSON.stringify({
        name: area,
        options: {
          return_immediately: false,
          // O que precisa vir junto do modelo.
          custom_fields: true,
          old_statuses: true,
          include_views: true,
          // O que não pode vir: o modelo tem cards de exemplo, e carteira de
          // escritório não começa com processo fictício dentro.
          subtasks: false,
          comment: false,
          attachments: false,
          old_assignees: false,
          old_due_date: false,
          old_followers: false,
        },
      }),
    });

    const folderId = String(
      (folder.folder as Record<string, unknown> | undefined)?.id ?? folder.id ?? "",
    );
    if (!folderId) {
      throw new ClickUpError(`Falha ao criar a pasta ${area}`, "folder_template_failed");
    }
    folderIds[area] = folderId;
  }

  return { spaceId, folderIds };
}

/** Descobre a lista "Processos" de cada pasta recém-criada. */
async function resolveLists(
  token: string,
  folderIds: Record<string, string>,
): Promise<Record<string, string>> {
  const listMap: Record<string, string> = {};

  for (const [area, folderId] of Object.entries(folderIds)) {
    const response = await cuFetch(token, `/folder/${folderId}/list`);
    const lists = (response.lists ?? []) as Array<{ id: string; name: string }>;
    if (!lists.length) {
      throw new ClickUpError(`Pasta ${area} veio sem lista`, "template_missing_list");
    }

    const processos = lists.find((list) => normalizeFieldName(list.name) === "processos");
    listMap[area] = String((processos ?? lists[0]).id);
  }

  // O worker cai em `default` quando `processos.area` traz um valor fora da
  // lista conhecida — dado antigo, importação, área digitada à mão.
  listMap.default = listMap["Cível"] ?? Object.values(listMap)[0];
  return listMap;
}

/**
 * Lê os custom fields de uma lista e monta o mapa lógico.
 *
 * Os campos são idênticos em todas as pastas — vieram do mesmo template —,
 * então basta inspecionar uma.
 */
async function resolveFieldMap(
  token: string,
  listId: string,
): Promise<{ fieldMap: Record<string, string>; missing: string[] }> {
  const response = await cuFetch(token, `/list/${listId}/field`);
  const fields = (response.fields ?? []) as Array<{ id: string; name: string }>;

  const fieldMap: Record<string, string> = {};
  for (const field of fields) {
    const key = FIELD_ALIASES[normalizeFieldName(field.name)];
    if (key) fieldMap[key] = String(field.id);
  }

  const missing = REQUIRED_KEYS.filter((key) => !fieldMap[key]);
  return { fieldMap, missing };
}

export async function provisionTenant(
  admin: SupabaseClient,
  request: ProvisionRequest,
): Promise<ProvisionResult> {
  const spaceName = request.spaceName?.trim() || "ADVeyes — Contencioso";

  const { spaceId, folderIds } = await createSpaceWithFolders(
    request.token,
    request.workspaceId,
    request.folderTemplateId,
    spaceName,
  );

  const listMap = await resolveLists(request.token, folderIds);
  const { fieldMap, missing } = await resolveFieldMap(request.token, listMap.default);

  if (missing.length) {
    // Sem estes campos o espelhamento perde a chave de idempotência ou o
    // estado de conferência do prazo. Melhor parar aqui, com o Space criado e
    // visível para inspeção, do que sincronizar carteira em cima de um modelo
    // quebrado.
    throw new ClickUpError(
      `Modelo incompleto — campos ausentes: ${missing.join(", ")}`,
      "template_missing_fields",
      422,
    );
  }

  const { error } = await admin.from("clickup_connections").upsert({
    tenant_id: request.tenantId,
    workspace_id: request.workspaceId,
    space_id: spaceId,
    encrypted_token: await encryptToken(request.token),
    template_version: "v1",
    field_map: fieldMap,
    list_map: listMap,
    status: "active",
    last_error_code: null,
    connected_by: request.connectedBy ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("clickup-provision: failed to persist connection", error.message);
    throw new ClickUpError("Não foi possível salvar a conexão", "connection_persist_failed");
  }

  return { spaceId, listMap, fieldMap, missingFields: missing };
}

/**
 * Enfileira a carteira existente, em lotes, até não sobrar nada.
 *
 * O teto de rodadas evita laço infinito se algum candidato voltar sempre — o
 * que aconteceria, por exemplo, se um processo falhasse a ponto de nunca criar
 * vínculo. Melhor parar e deixar o resto para a rodada seguinte do cron.
 */
export async function backfillTenant(
  admin: SupabaseClient,
  tenantId: string,
  batchSize = 200,
  maxRounds = 25,
): Promise<Record<string, number>> {
  const totals: Record<string, number> = {};

  for (let round = 0; round < maxRounds; round += 1) {
    const { data, error } = await admin.rpc("enqueue_clickup_backfill", {
      p_tenant_id: tenantId,
      p_limit: batchSize,
    });
    if (error) {
      throw new ClickUpError("Falha na carga inicial", "backfill_failed");
    }

    const rows = (data ?? []) as Array<{ entity_type: string; enqueued: number }>;
    let enqueuedThisRound = 0;
    for (const row of rows) {
      totals[row.entity_type] = (totals[row.entity_type] ?? 0) + row.enqueued;
      enqueuedThisRound += row.enqueued;
    }

    if (enqueuedThisRound === 0) break;
  }

  return totals;
}
