import { describe, expect, it, vi } from "vitest";
import { fetchDjenPublications } from "../../supabase/functions/_shared/djen-client.ts";

/**
 * O DJEN só aceita 5 ou 100 itens por página; o cliente normaliza qualquer
 * outro valor para 100. Os cenários abaixo usam 5 para manter o teste curto.
 */
const PAGE_SIZE = 5;

function page(
  count: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      status: "success",
      count: null,
      items: Array.from({ length: count }, (_, i) => ({
        hash: `hash-${Math.random()}-${i}`,
        numero_processo: "0800123-45.2023.8.04.0001",
        texto: "Intimação",
      })),
    }),
    { status: 200, headers: { "content-type": "application/json", ...headers } },
  );
}

describe("fetchDjenPublications — truncamento", () => {
  it("marca completed quando a última página vem incompleta", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(page(PAGE_SIZE))
      .mockResolvedValueOnce(page(2)) as unknown as typeof fetch;

    const result = await fetchDjenPublications({
      sourceKind: "oab",
      reference: "10099/AM",
      startDate: "2026-08-01",
      endDate: "2026-08-20",
      pageSize: PAGE_SIZE,
      fetcher,
    });

    expect(result.stopReason).toBe("completed");
    expect(result.truncated).toBe(false);
    expect(result.items).toHaveLength(7);
  });

  it("sinaliza rate_limited quando a cota zera no meio da varredura", async () => {
    // Página cheia + cota esgotada: existe mais publicação no período.
    // Cada chamada precisa de uma Response nova: o corpo só é lido uma vez.
    const fetcher = vi.fn(() =>
      Promise.resolve(page(PAGE_SIZE, { "x-ratelimit-remaining": "0" }))
    ) as unknown as typeof fetch;

    const result = await fetchDjenPublications({
      sourceKind: "oab",
      reference: "10099/AM",
      startDate: "2026-08-01",
      endDate: "2026-08-20",
      pageSize: PAGE_SIZE,
      fetcher,
    });

    // Esta é a diferença que impede o cursor de avançar e perder publicação.
    expect(result.stopReason).toBe("rate_limited");
    expect(result.truncated).toBe(true);
    expect(result.rateLimitRemaining).toBe(0);
  });

  it("sinaliza max_pages quando todas as páginas vêm cheias", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(page(PAGE_SIZE))
    ) as unknown as typeof fetch;

    const result = await fetchDjenPublications({
      sourceKind: "process",
      reference: "0800123-45.2023.8.04.0001",
      startDate: "2026-08-01",
      endDate: "2026-08-20",
      pageSize: PAGE_SIZE,
      maxPages: 3,
      fetcher,
    });

    expect(result.pages).toBe(3);
    expect(result.stopReason).toBe("max_pages");
    expect(result.truncated).toBe(true);
  });

  it("para sem truncar quando o total informado já foi alcançado", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            count: 5,
            items: Array.from({ length: 5 }, (_, i) => ({ hash: `h-${i}` })),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
    ) as unknown as typeof fetch;

    const result = await fetchDjenPublications({
      sourceKind: "oab",
      reference: "10099/AM",
      startDate: "2026-08-01",
      endDate: "2026-08-20",
      pageSize: PAGE_SIZE,
      maxPages: 10,
      fetcher,
    });

    expect(result.stopReason).toBe("completed");
    expect(result.truncated).toBe(false);
    expect(result.totalReported).toBe(5);
  });
});
