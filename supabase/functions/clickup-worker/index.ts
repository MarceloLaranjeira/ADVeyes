/**
 * Consome a fila de espelhamento para o ClickUp.
 *
 * Endpoint fino, no mesmo formato da `google-calendar-worker`: autenticado por
 * segredo compartilhado, sem sessão de usuário, acionado por pg_cron a cada
 * dois minutos. A lógica toda vive em `_shared/clickup.ts`.
 */

import { ClickUpError, corsHeaders, getAdminClient, jsonResponse, processJobs } from "../_shared/clickup.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("CLICKUP_WORKER_SECRET");
  const suppliedSecret = request.headers.get("x-worker-secret");
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      limit?: number;
      tenantId?: string;
    };

    const result = await processJobs(
      getAdminClient(),
      Math.max(1, Math.min(Number(body.limit) || 25, 100)),
      body.tenantId,
    );

    return jsonResponse(result);
  } catch (error) {
    const clickUpError = error instanceof ClickUpError
      ? error
      : new ClickUpError("Erro interno", "internal_error");
    console.error("clickup-worker", {
      code: clickUpError.code,
      status: clickUpError.status,
    });
    return jsonResponse(
      { error: clickUpError.message, code: clickUpError.code },
      clickUpError.status,
    );
  }
});
