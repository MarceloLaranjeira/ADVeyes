import { describe, expect, it } from "vitest";
import { parseProcessRoute, processRouteParams } from "@/lib/process-workspace";

describe("estado da Central Processual na URL", () => {
  it("usa os padrões quando a URL está vazia", () => {
    expect(parseProcessRoute(new URLSearchParams())).toEqual({
      tab: "central",
      situation: "ativos",
      limit: 40,
      filters: {
        search: "",
        phase: "all",
        waitingOn: "all",
        risk: "all",
        area: "all",
        stalledOnly: false,
      },
    });
  });

  it("preserva o atalho ?focus= que já existia", () => {
    expect(parseProcessRoute(new URLSearchParams("focus=stalled")).filters.stalledOnly).toBe(true);
    expect(parseProcessRoute(new URLSearchParams("focus=office")).filters.waitingOn).toBe("escritorio");
    expect(parseProcessRoute(new URLSearchParams("focus=critical")).filters.risk).toBe("critico");
  });

  it("volta ao padrão diante de valor inválido", () => {
    const state = parseProcessRoute(new URLSearchParams("tab=inventada&situacao=xis&limit=-3"));
    expect(state.tab).toBe("central");
    expect(state.situation).toBe("ativos");
    expect(state.limit).toBe(40);
  });

  it("faz a volta completa entre estado e URL", () => {
    const state = {
      tab: "lista" as const,
      situation: "arquivados" as const,
      limit: 80,
      filters: {
        search: "  Silva  ",
        phase: "recursal" as const,
        waitingOn: "escritorio" as const,
        risk: "critico" as const,
        area: "Trabalhista",
        stalledOnly: true,
      },
    };

    const restored = parseProcessRoute(processRouteParams(state));

    expect(restored).toEqual({ ...state, filters: { ...state.filters, search: "Silva" } });
  });

  it("omite da URL tudo que está no padrão", () => {
    const params = processRouteParams(parseProcessRoute(new URLSearchParams()));
    expect(params.toString()).toBe("");
  });
});
