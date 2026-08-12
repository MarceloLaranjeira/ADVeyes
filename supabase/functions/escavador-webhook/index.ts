import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createPublicationHearingCandidates,
  ingestMovements,
  ingestPublications,
} from "../_shared/legal-ingestion.ts";
import {
  normalizeEscavadorMovement,
  normalizeEscavadorPublication,
  resolveOriginSystem,
} from "../_shared/legal-normalization.ts";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function secureEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

interface EscavadorCallback {
  event?: string;
  uuid?: string;
  monitoramento?: {
    id?: number | string;
    numero?: string;
    status?: string;
    data_ultima_verificacao?: string | null;
  };
  movimentacao?: {
    id?: number | string;
    data?: string;
    tipo?: "ANDAMENTO" | "PUBLICACAO";
    tipo_publicacao?: string | null;
    conteudo?: string;
    texto_categoria?: string | null;
    fonte?: { nome?: string; sigla?: string };
  };
  documento?: {
    id?: number | string;
    titulo?: string;
    descricao?: string;
    data?: string;
    links?: { api?: string };
  };
  verificado_em?: string;
  [key: string]: unknown;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return response({ error: "method_not_allowed" }, 405);
  }

  const expectedToken = Deno.env.get("ESCAVADOR_CALLBACK_TOKEN");
  const authorization = request.headers.get("Authorization") ?? "";
  if (!expectedToken) {
    return response({ error: "integration_not_configured" }, 503);
  }
  if (
    !authorization.startsWith("Bearer ") ||
    !secureEqual(authorization.slice(7).trim(), expectedToken)
  ) {
    return response({ error: "unauthorized" }, 401);
  }

  let payload: EscavadorCallback;
  try {
    payload = await request.json();
  } catch {
    return response({ error: "invalid_payload" }, 400);
  }
  const raw = payload as Record<string, unknown>;
  const nestedData = (raw.data && typeof raw.data === "object" ? raw.data : {}) as Record<string, unknown>;
  const eventType = (payload.event ?? raw.event_type ?? nestedData.event ?? nestedData.event_type as string ?? "").trim();
  const externalEventId = (payload.uuid ?? raw.event_id ?? raw.id ?? nestedData.uuid ?? nestedData.event_id as string ?? "").trim();
  const externalMonitorId = payload.monitoramento?.id ?? raw.monitoramento_id ?? nestedData.monitoramento_id ?? (nestedData.monitoramento as Record<string, unknown>)?.id;
  if (!eventType || !externalEventId || externalMonitorId == null) {
    return response({ error: "invalid_payload" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return response({ error: "server_configuration_error" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: monitor, error: monitorError } = await admin
    .from("legal_provider_monitors")
    .select("id, tenant_id, process_id")
    .eq("provider", "escavador")
    .eq("external_id", String(externalMonitorId))
    .maybeSingle();
  if (monitorError) return response({ error: "operation_failed" }, 500);
  if (!monitor) {
    await admin.from("legal_provider_events").upsert({
      provider: "escavador",
      external_event_id: externalEventId,
      event_type: eventType,
      status: "quarantined",
      payload,
      error_code: "monitor_not_found",
      error_message: "Callback sem monitor conhecido.",
    }, { onConflict: "provider,external_event_id", ignoreDuplicates: true });
    return response({ received: true, quarantined: true });
  }

  const { data: event, error: eventError } = await admin
    .from("legal_provider_events")
    .upsert({
      tenant_id: monitor.tenant_id,
      monitor_id: monitor.id,
      provider: "escavador",
      external_event_id: externalEventId,
      event_type: eventType,
      status: "received",
      payload,
    }, { onConflict: "provider,external_event_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (eventError) return response({ error: "operation_failed" }, 500);
  if (!event) return response({ received: true, duplicate: true });

  let monitorStatus = "pending";
  if (eventType === "processo_encontrado") monitorStatus = "found";
  if (eventType === "processo_nao_encontrado") monitorStatus = "not_found";

  const callbackAt = new Date().toISOString();
  await admin.from("legal_provider_monitors").update({
    status: monitorStatus,
    last_callback_at: callbackAt,
    last_checked_at: payload.verificado_em ??
      payload.monitoramento?.data_ultima_verificacao ?? null,
  }).eq("id", monitor.id).eq("tenant_id", monitor.tenant_id);

  if (eventType === "nova_movimentacao" && payload.movimentacao?.id != null) {
    const movement = payload.movimentacao;

    const { data: process, error: processError } = await admin
      .from("processos")
      .select("id, numero, cliente_nome, user_id")
      .eq("tenant_id", monitor.tenant_id)
      .eq("id", monitor.process_id)
      .single();
    if (processError || !process) {
      return response({ error: "operation_failed" }, 500);
    }

    try {
      if (movement.tipo === "PUBLICACAO") {
        const normalized = normalizeEscavadorPublication({
          id: movement.id,
          tipo: movement.tipo_publicacao ?? null,
          data_publicacao: movement.data ?? callbackAt,
          conteudo: movement.conteudo ?? null,
          conteudo_simplificado: movement.texto_categoria ?? null,
          numero_processo: process.numero,
          tribunal: { sigla: movement.fonte?.sigla ?? null },
          fonte: movement.fonte ?? null,
        }, { receivedAt: callbackAt });

        const publicationResult = await ingestPublications(admin, {
          tenantId: monitor.tenant_id,
          provider: "escavador",
          fallbackUserId: process.user_id,
          publications: [normalized],
          defaultProcess: process,
        });
        await createPublicationHearingCandidates(admin, {
          tenantId: monitor.tenant_id,
          publicationIds: publicationResult.createdIds,
        });
      } else {
        await ingestMovements(admin, {
          tenantId: monitor.tenant_id,
          processId: monitor.process_id,
          provider: "escavador",
          movements: [normalizeEscavadorMovement(movement)],
        });
      }
    } catch {
      return response({ error: "operation_failed" }, 500);
    }
  }

  if (eventType === "novo_documento" && payload.documento?.id != null) {
    const document = payload.documento;
    await ingestMovements(admin, {
      tenantId: monitor.tenant_id,
      processId: monitor.process_id,
      provider: "escavador",
      movements: [{
        externalId: `documento:${document.id}`,
        movementType: "DOCUMENTO",
        occurredAt: document.data ?? null,
        title: document.titulo ?? "Novo documento público",
        content: document.descricao ?? "Documento público localizado.",
        originSystem: resolveOriginSystem({
          sourceUrl: document.links?.api ?? null,
          content: document.descricao ?? null,
        }),
        sourceName: "Escavador",
        sourceUrl: document.links?.api ?? null,
        tpuCode: null,
        description: document.descricao ?? null,
        complements: [],
        notes: null,
        documentType: document.titulo ?? null,
        fullTextAvailable: false,
        documentUrl: document.links?.api ?? null,
        payload: document as Record<string, unknown>,
      }],
    });
  }

  await admin.from("legal_provider_events").update({
    status: "processed",
    processed_at: new Date().toISOString(),
  }).eq("id", event.id);

  await admin.from("legal_sync_runs").insert({
    tenant_id: monitor.tenant_id,
    provider: "escavador",
    sync_kind: eventType === "nova_movimentacao" &&
        payload.movimentacao?.tipo === "PUBLICACAO"
      ? "publication"
      : "movement",
    trigger_type: "webhook",
    status: "succeeded",
    records_received: 1,
    records_created: 1,
    finished_at: new Date().toISOString(),
    metadata: {
      external_event_id: externalEventId,
      event_type: eventType,
    },
  });

  return response({ received: true });
});
