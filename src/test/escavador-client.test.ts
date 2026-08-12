import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchEscavadorProcessCover,
  fetchEscavadorProcessMovements,
  fetchEscavadorPublicDocuments,
} from "../../supabase/functions/_shared/escavador-client.ts";

describe("fetchEscavadorProcessCover", () => {
  afterEach(() => vi.restoreAllMocks());

  it("usa a rota V2 oficial e mantém o PAT apenas no cabeçalho", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        numero_cnj: "0800123-45.2023.8.04.0001",
        fontes: [{ id: 3, envolvidos: [] }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const result = await fetchEscavadorProcessCover({
      token: "segredo-do-backend",
      processNumber: "0800123-45.2023.8.04.0001",
    });

    expect(result.numero_cnj).toBe("0800123-45.2023.8.04.0001");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.escavador.com/api/v2/processos/numero_cnj/0800123-45.2023.8.04.0001",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer segredo-do-backend",
        }),
      }),
    );
    expect(fetchMock.mock.calls[0][0]).not.toContain("segredo-do-backend");
  });
});

describe("paginação dos detalhes do processo", () => {
  afterEach(() => vi.restoreAllMocks());

  it("segue apenas cursores oficiais nas movimentações", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 1, conteudo: "Distribuição" }],
        links: { next: "https://api.escavador.com/api/v2/processos/pagina-2" },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 2, conteudo: "Conclusão" }],
        links: { next: null },
      }), { status: 200 }));

    const result = await fetchEscavadorProcessMovements({
      token: "pat-secreto",
      processNumber: "0800123-45.2023.8.04.0001",
    });

    expect(result.items.map((item) => item.id)).toEqual([1, 2]);
    expect(result.pages).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("movimentacoes?limit=100");
  });

  it("consulta documentos públicos com o token somente no cabeçalho", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: 3, titulo: "Decisão" }] }), {
        status: 200,
      }),
    );

    const result = await fetchEscavadorPublicDocuments({
      token: "pat-secreto",
      processNumber: "0800123-45.2023.8.04.0001",
    });

    expect(result.items).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("documentos-publicos?limit=100");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("pat-secreto");
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer pat-secreto" }),
    }));
  });
});

describe("resumo por IA do Escavador", () => {
  afterEach(() => vi.restoreAllMocks());

  it("desembrulha o resumo corretamente mesmo se retornado em wrapper de resposta ou campo resumo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          resposta: {
            numero_cnj: "0800123-45.2023.8.04.0001",
            resumo: "Resumo sintético do processo gerado pela IA.",
            atualizado_em: "2026-08-11T12:00:00Z",
          },
        }),
        { status: 200 },
      ),
    );

    const { fetchEscavadorProcessSummary } = await import(
      "../../supabase/functions/_shared/escavador-client.ts"
    );
    const summary = await fetchEscavadorProcessSummary({
      token: "pat-token",
      processNumber: "0800123-45.2023.8.04.0001",
    });

    expect(summary.conteudo).toBe("Resumo sintético do processo gerado pela IA.");
    expect(summary.numero_cnj).toBe("0800123-45.2023.8.04.0001");
  });

  it("extrai ID da solicitação e status de jobs finalizados ou pendentes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          resposta: {
            id: 9876,
            status: "FINALIZADO",
          },
        }),
        { status: 200 },
      ),
    );

    const { requestEscavadorProcessSummary } = await import(
      "../../supabase/functions/_shared/escavador-client.ts"
    );
    const job = await requestEscavadorProcessSummary({
      token: "pat-token",
      processNumber: "0800123-45.2023.8.04.0001",
    });

    expect(job.id).toBe(9876);
    expect(job.status).toBe("FINALIZADO");
  });
});

