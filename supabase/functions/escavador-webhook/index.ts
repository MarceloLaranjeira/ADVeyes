import { createClient } from "npm:@supabase/supabase-js@2";

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
  const eventType = payload.event?.trim();
  const externalEventId = payload.uuid?.trim();
  const externalMonitorId = payload.monitoramento?.id;
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
    const movementType = movement.tipo === "PUBLICACAO"
      ? "PUBLICACAO"
      : "ANDAMENTO";
    const { data: insertedMovement, error: movementError } = await admin
      .from("process_movements")
      .upsert({
        tenant_id: monitor.tenant_id,
        process_id: monitor.process_id,
        provider: "escavador",
        external_id: String(movement.id),
        movement_type: movementType,
        occurred_at: movement.data ?? null,
        title: movement.texto_categoria ?? movement.tipo_publicacao ?? null,
        content: movement.conteudo ?? "Movimentação sem conteúdo.",
        source_name: movement.fonte?.nome ?? movement.fonte?.sigla ?? null,
        provider_payload: movement,
      }, {
        onConflict: "tenant_id,process_id,provider,external_id",
        ignoreDuplicates: true,
      })
      .select("id")
      .maybeSingle();
    if (movementError) return response({ error: "operation_failed" }, 500);

    if (insertedMovement && movementType === "PUBLICACAO") {
      const { data: process } = await admin.from("processos")
        .select("user_id, numero, cliente_nome")
        .eq("tenant_id", monitor.tenant_id)
        .eq("id", monitor.process_id)
        .single();
      if (process) {
        await admin.from("publicacoes").insert({
          tenant_id: monitor.tenant_id,
          user_id: process.user_id,
          tipo: movement.tipo_publicacao?.toLowerCase() ?? "publicacao",
          tribunal: movement.fonte?.sigla ?? "Escavador",
          numero_processo: process.numero,
          cliente_nome: process.cliente_nome,
          data_publicacao: movement.data ?? callbackAt,
          conteudo: movement.conteudo ?? "Publicação sem conteúdo.",
          conteudo_simplificado: movement.texto_categoria ?? null,
          status: "nova",
        });
      }
    }
  }

  if (eventType === "novo_documento" && payload.documento?.id != null) {
    const document = payload.documento;
    await admin.from("process_movements").upsert({
      tenant_id: monitor.tenant_id,
      process_id: monitor.process_id,
      provider: "escavador",
      external_id: `documento:${document.id}`,
      movement_type: "DOCUMENTO",
      occurred_at: document.data ?? null,
      title: document.titulo ?? "Novo documento público",
      content: document.descricao ?? "Documento público localizado.",
      source_name: "Escavador",
      source_url: document.links?.api ?? null,
      provider_payload: document,
    }, {
      onConflict: "tenant_id,process_id,provider,external_id",
      ignoreDuplicates: true,
    });
  }

  await admin.from("legal_provider_events").update({
    status: "processed",
    processed_at: new Date().toISOString(),
  }).eq("id", event.id);

  return response({ received: true });
});
