import { describe, expect, it, vi } from "vitest";
import {
  DjenApiError,
  fetchDjenPublications,
  groupDjenReferences,
} from "../../supabase/functions/_shared/djen-client.ts";

function response(body: unknown, options?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...options,
  });
}

describe("fetchDjenPublications", () => {
  it("agrupa a mesma referência global sem misturar OAB e processo", () => {
    const groups = groupDjenReferences([
      { source_kind: "oab" as const, reference: "12345/AM", tenant: "a" },
      { source_kind: "oab" as const, reference: "12345/AM", tenant: "b" },
      {
        source_kind: "process" as const,
        reference: "12345/AM",
        tenant: "c",
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].map((source) => source.tenant)).toEqual(["a", "b"]);
    expect(groups[1].map((source) => source.tenant)).toEqual(["c"]);
  });

  it("monta filtros de OAB e percorre as páginas uma única vez", async () => {
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      const url = new URL(String(request));
      const page = Number(url.searchParams.get("pagina"));
      expect(url.searchParams.get("numeroOab")).toBe("12345");
      expect(url.searchParams.get("ufOab")).toBe("AM");
      expect(url.searchParams.get("meio")).toBe("D");
      return response({
        status: "success",
        count: 6,
        items: page === 1
          ? [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
          : [{ id: 6 }],
      }, {
        headers: {
          "content-type": "application/json",
          "x-ratelimit-limit": "20",
          "x-ratelimit-remaining": page === 1 ? "19" : "18",
        },
      });
    });

    const result = await fetchDjenPublications({
      sourceKind: "oab",
      reference: "12345/AM",
      startDate: "2026-07-31",
      endDate: "2026-08-01",
      pageSize: 5,
      fetcher: fetcher as typeof fetch,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.items.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.pages).toBe(2);
    expect(result.rateLimit).toBe(20);
    expect(result.rateLimitRemaining).toBe(18);
  });

  it("consulta processo usando apenas os 20 dígitos do número CNJ", async () => {
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      const url = new URL(String(request));
      expect(url.searchParams.get("numeroProcesso")).toBe(
        "00128291820248130686",
      );
      return response({ status: "success", count: 0, items: [] });
    });

    await fetchDjenPublications({
      sourceKind: "process",
      reference: "0012829-18.2024.8.13.0686",
      startDate: "2026-08-01",
      endDate: "2026-08-01",
      fetcher: fetcher as typeof fetch,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("interrompe paginação quando o saldo informado chega a zero", async () => {
    const fetcher = vi.fn(async () =>
      response({
        count: 10,
        items: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
      }, {
        headers: { "x-ratelimit-remaining": "0" },
      })
    );
    const result = await fetchDjenPublications({
      sourceKind: "oab",
      reference: "12345/AM",
      startDate: "2026-08-01",
      endDate: "2026-08-01",
      pageSize: 5,
      fetcher: fetcher as typeof fetch,
    });
    expect(result.pages).toBe(1);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("expõe retentativa segura quando o CNJ responde 429", async () => {
    const fetcher = vi.fn(async () =>
      response({}, { status: 429, headers: { "retry-after": "75" } })
    );

    await expect(fetchDjenPublications({
      sourceKind: "oab",
      reference: "12345/AM",
      startDate: "2026-08-01",
      endDate: "2026-08-01",
      fetcher: fetcher as typeof fetch,
    })).rejects.toMatchObject({
      code: "djen_rate_limited",
      retryAfterMs: 75_000,
    } satisfies Partial<DjenApiError>);
  });

  it("rejeita referência e payload inválidos", async () => {
    await expect(fetchDjenPublications({
      sourceKind: "oab",
      reference: "sem-uf",
      startDate: "2026-08-01",
      endDate: "2026-08-01",
    })).rejects.toMatchObject({ code: "djen_invalid_reference" });

    const fetcher = vi.fn(async () => response({ status: "success" }));
    await expect(fetchDjenPublications({
      sourceKind: "process",
      reference: "0012829-18.2024.8.13.0686",
      startDate: "2026-08-01",
      endDate: "2026-08-01",
      fetcher: fetcher as typeof fetch,
    })).rejects.toMatchObject({ code: "djen_invalid_response" });
  });
});
