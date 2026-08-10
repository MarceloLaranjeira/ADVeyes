import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEscavadorProcessCover } from "../../supabase/functions/_shared/escavador-client.ts";

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
