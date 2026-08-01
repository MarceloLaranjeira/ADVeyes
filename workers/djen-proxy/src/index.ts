interface Env {
  DJEN_PROXY_SECRET: string;
}

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

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET") {
      return new Response(null, { status: 405, headers: { Allow: "GET" } });
    }

    if (
      !env.DJEN_PROXY_SECRET ||
      request.headers.get("Authorization") !== `Bearer ${env.DJEN_PROXY_SECRET}`
    ) {
      return json({ error: "unauthorized" }, 401);
    }

    const incoming = new URL(request.url);
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
      return json({ error: "missing_reference" }, 400);
    }

    try {
      const upstream = await fetch(target, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; ADVeyes/1.0; +https://adveyes.automatikus.com.br)",
        },
      });
      const headers = new Headers({
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      });
      for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "retry-after"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      return json({ error: "upstream_unavailable" }, 502);
    }
  },
};
