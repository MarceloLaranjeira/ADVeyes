import type { IncomingMessage, ServerResponse } from "node:http";

const DJEN_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const ALLOWED_PARAMS = new Set([
  "numeroOab",
  "ufOab",
  "numeroProcesso",
  "dataDisponibilizacaoInicio",
  "dataDisponibilizacaoFim",
  "meio",
  "itensPorPagina",
  "pagina",
]);

function json(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "method_not_allowed" });
  }

  const proxySecret = process.env.DJEN_PROXY_SECRET;
  if (
    !proxySecret ||
    request.headers.authorization !== `Bearer ${proxySecret}`
  ) {
    return json(response, 401, { error: "unauthorized" });
  }

  const incoming = new URL(request.url ?? "/", "https://adveyes.automatikus.com.br");
  const target = new URL(DJEN_URL);
  for (const [name, value] of incoming.searchParams) {
    if (ALLOWED_PARAMS.has(name) && value.length <= 120) {
      target.searchParams.set(name, value);
    }
  }

  if (
    !target.searchParams.has("numeroOab") &&
    !target.searchParams.has("numeroProcesso")
  ) {
    return json(response, 400, { error: "missing_reference" });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; ADVeyes/1.0; +https://adveyes.automatikus.com.br)",
      },
      signal: AbortSignal.timeout(20_000),
    });
    response.statusCode = upstream.status;
    response.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") ?? "application/json",
    );
    response.setHeader("Cache-Control", "no-store");
    for (const name of [
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "retry-after",
    ]) {
      const value = upstream.headers.get(name);
      if (value) response.setHeader(name, value);
    }
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error("DJEN proxy upstream failure", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return json(response, 502, { error: "upstream_unavailable" });
  }
}
