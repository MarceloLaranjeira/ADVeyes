import { describe, expect, it, vi } from "vitest";
import { discoverProcessesByOab } from "../../supabase/functions/_shared/datajud-client.ts";

/**
 * Regressões apontadas na revisão do PR #33. Cada teste aqui existe porque a
 * primeira versão da correção errava exatamente neste ponto.
 */

function hitPage(count: number, prefix: string) {
  return new Response(
    JSON.stringify({
      hits: {
        hits: Array.from({ length: count }, (_, i) => ({
          _source: { numeroProcesso: `${prefix}-${i}`, tribunal: "TJAM" },
          sort: [`${prefix}-cursor-${i}`],
        })),
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const EMPTY = () =>
  new Response(JSON.stringify({ hits: { hits: [] } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("scanCourt — teto de páginas não é truncamento automático", () => {
  it("reporta ok quando o total é múltiplo exato do pageSize", async () => {
    // Cenário do revisor: 2 páginas cheias e nada além. Sem a sondagem, isso
    // seria marcado como parcial e dispararia revarredura eterna.
    let dataCalls = 0;
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { size: number };
      if (body.size === 1) return EMPTY(); // sondagem: acabou mesmo
      dataCalls += 1;
      return hitPage(5, `p${dataCalls}`);
    }) as unknown as typeof fetch;

    const result = await discoverProcessesByOab({
      authorization: "APIKey test",
      oabNumber: "10099",
      oabState: "AM",
      pageSize: 5,
      maxPages: 2,
      fetcher,
    });

    expect(result.reports.every((r) => r.status === "ok")).toBe(true);
    expect(result.reports.every((r) => r.errorCode === null)).toBe(true);
  });

  it("mantém partial quando a sondagem encontra resultado além do teto", async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { size: number };
      // A sondagem acha mais um: existe backlog de verdade.
      if (body.size === 1) return hitPage(1, "probe");
      return hitPage(5, "full");
    }) as unknown as typeof fetch;

    const result = await discoverProcessesByOab({
      authorization: "APIKey test",
      oabNumber: "10099",
      oabState: "AM",
      pageSize: 5,
      maxPages: 2,
      fetcher,
    });

    expect(
      result.reports.every((r) =>
        r.status === "partial" && r.errorCode === "datajud_max_pages_reached"
      ),
    ).toBe(true);
  });

  it("assume partial quando a própria sondagem falha", async () => {
    // Conservador por escolha: na dúvida, avisa que pode faltar resultado.
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { size: number };
      if (body.size === 1) throw new Error("probe down");
      return hitPage(5, "full");
    }) as unknown as typeof fetch;

    const result = await discoverProcessesByOab({
      authorization: "APIKey test",
      oabNumber: "10099",
      oabState: "AM",
      pageSize: 5,
      maxPages: 1,
      fetcher,
    });

    expect(result.reports.every((r) => r.status === "partial")).toBe(true);
  });
});
