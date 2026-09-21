import { describe, expect, it, vi } from "vitest";
import {
  courtsForOabState,
  discoverProcessesByOab,
} from "../../supabase/functions/_shared/datajud-client.ts";

/** Resposta mínima do Elasticsearch no formato que o DataJud devolve. */
function hits(
  items: Array<{ numero: string; sort?: unknown[] }>,
): { hits: { hits: Array<Record<string, unknown>> } } {
  return {
    hits: {
      hits: items.map((item) => ({
        _source: {
          numeroProcesso: item.numero,
          tribunal: "TJAM",
          classe: { nome: "Procedimento Comum" },
          orgaoJulgador: { nome: "1ª Vara Cível" },
          partes: [
            { polo: "ATIVO", nome: "Cliente" },
            { polo: "PASSIVO", nome: "Banco" },
          ],
        },
        sort: item.sort ?? [item.numero],
      })),
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("courtsForOabState — cobertura de índices", () => {
  it("inclui os tribunais superiores em toda seccional", () => {
    const courts = courtsForOabState("AM");
    expect(courts).toContain("tjam");
    expect(courts).toContain("trf1");
    expect(courts).toContain("trt11");
    // Um recurso no STJ pertence ao advogado tanto quanto o processo de origem.
    expect(courts).toEqual(
      expect.arrayContaining(["stf", "stj", "tst", "tse", "stm"]),
    );
  });

  it("inclui a justiça militar apenas nos três estados que a possuem", () => {
    expect(courtsForOabState("MG")).toContain("tjmmg");
    expect(courtsForOabState("RS")).toContain("tjmrs");
    expect(courtsForOabState("SP")).toContain("tjmsp");
    expect(courtsForOabState("AM")).not.toContain("tjmmg");
  });

  it("continua vazio para seccional desconhecida", () => {
    expect(courtsForOabState("XX")).toEqual([]);
  });
});

describe("discoverProcessesByOab — varredura completa", () => {
  it("segue paginando com search_after até o índice acabar", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      numero: `page1-${i}`,
      sort: [`cursor-${i}`],
    }));
    const page2 = [{ numero: "page2-0", sort: ["cursor-100"] }];

    const bodies: Array<Record<string, unknown>> = [];
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      // Só o índice do TJAM tem resultado; os demais respondem vazio.
      const isFirstPage = !body.search_after;
      return jsonResponse(hits(isFirstPage ? page1 : page2));
    }) as unknown as typeof fetch;

    const result = await discoverProcessesByOab({
      authorization: "APIKey test",
      oabNumber: "10099",
      oabState: "AM",
      pageSize: 100,
      maxPages: 5,
      fetcher,
    });

    // 101 processos distintos por índice, deduplicados entre os índices.
    expect(result.processes.length).toBe(101);

    // A segunda chamada de cada índice precisa carregar o cursor da anterior.
    const secondCall = bodies.find((body) => body.search_after);
    expect(secondCall?.search_after).toEqual(["cursor-99"]);

    // Ordenação estável é obrigatória para search_after ser determinístico.
    expect(bodies[0].sort).toEqual([
      { "@timestamp": { order: "asc" } },
      { _id: "asc" },
    ]);

    // Todo índice consultado vira uma linha de relatório.
    expect(result.reports).toHaveLength(courtsForOabState("AM").length);
    expect(result.reports.every((report) => report.status === "ok")).toBe(true);
  });

  it("marca o índice como parcial quando bate o teto de páginas", async () => {
    const fullPage = Array.from({ length: 10 }, (_, i) => ({
      numero: `p-${i}-${Math.random()}`,
      sort: [`c-${i}`],
    }));
    const fetcher = vi.fn(async () =>
      jsonResponse(hits(fullPage))
    ) as unknown as typeof fetch;

    const result = await discoverProcessesByOab({
      authorization: "APIKey test",
      oabNumber: "10099",
      oabState: "AM",
      pageSize: 10,
      maxPages: 2,
      fetcher,
    });

    // Página sempre cheia => a varredura para no teto e avisa que faltou.
    expect(
      result.reports.every((report) =>
        report.status === "partial" &&
        report.errorCode === "datajud_max_pages_reached"
      ),
    ).toBe(true);
  });

  it("isola a falha de um índice sem derrubar os demais", async () => {
    const fetcher = vi.fn(async (url: unknown) => {
      if (String(url).includes("api_publica_tjam")) {
        return new Response("boom", { status: 503 });
      }
      return jsonResponse(hits([{ numero: "0001" }]));
    }) as unknown as typeof fetch;

    const result = await discoverProcessesByOab({
      authorization: "APIKey test",
      oabNumber: "10099",
      oabState: "AM",
      fetcher,
    });

    const tjam = result.reports.find((report) => report.court === "tjam");
    expect(tjam?.status).toBe("failed");
    expect(tjam?.errorCode).toBe("datajud_request_failed");

    // Os outros índices continuam entregando resultado.
    expect(result.processes.length).toBeGreaterThan(0);
    expect(
      result.reports.some((report) => report.status === "ok"),
    ).toBe(true);
  });

  it("deduplica o mesmo processo encontrado em mais de um índice", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(hits([{ numero: "0800123-45.2023.8.04.0001" }]))
    ) as unknown as typeof fetch;

    const result = await discoverProcessesByOab({
      authorization: "APIKey test",
      oabNumber: "10099",
      oabState: "AM",
      fetcher,
    });

    // Todos os índices devolvem o mesmo número: o resultado tem de ser um só.
    expect(result.processes).toHaveLength(1);
    expect(result.processes[0].numeroProcesso).toBe(
      "0800123-45.2023.8.04.0001",
    );
  });
});
