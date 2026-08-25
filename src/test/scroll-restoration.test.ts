import { describe, expect, it } from "vitest";
import {
  restoreScrollOffset,
  runScrollRestoration,
  type ScrollRestorationRunDeps,
} from "@/lib/scroll-restoration";

function harness(initialHeight: number) {
  const scrolled: number[] = [];
  const pending: Array<() => void> = [];
  let height = initialHeight;
  let clock = 0;
  return {
    scrolled,
    runNext: () => pending.shift()?.(),
    grow: (value: number) => { height = value; },
    advance: (ms: number) => { clock += ms; },
    deps: {
      documentHeight: () => height,
      viewportHeight: () => 600,
      scrollTo: (offset: number) => scrolled.push(offset),
      now: () => clock,
      schedule: (callback: () => void) => { pending.push(callback); },
    },
  };
}

describe("restoreScrollOffset", () => {
  it("restaura de imediato quando a página já tem altura", () => {
    const h = harness(3000);
    restoreScrollOffset(800, h.deps);
    expect(h.scrolled).toEqual([800]);
  });

  it("espera a lista renderizar antes de restaurar", () => {
    const h = harness(0);
    restoreScrollOffset(800, h.deps);
    expect(h.scrolled).toEqual([]);

    h.grow(3000);
    h.runNext();
    expect(h.scrolled).toEqual([800]);
  });

  it("desiste depois de um segundo e vai até onde a página permite", () => {
    const h = harness(900);
    restoreScrollOffset(5000, h.deps);
    expect(h.scrolled).toEqual([]);

    h.advance(1000);
    h.runNext();
    expect(h.scrolled).toEqual([300]);
  });

  it("vai ao topo quando não há posição guardada", () => {
    const h = harness(3000);
    restoreScrollOffset(0, h.deps);
    expect(h.scrolled).toEqual([0]);
  });
});

function runHarness(overrides: Partial<ScrollRestorationRunDeps> = {}) {
  const store: Record<string, string> = {};
  const calls = {
    getItem: 0,
    setItem: 0,
    setManual: 0,
    addListener: 0,
    removeListener: 0,
  };
  const scrolledTo: number[] = [];
  let scrollY = 0;
  let scrollHandler: (() => void) | undefined;

  const deps: ScrollRestorationRunDeps = {
    enabled: true,
    isPop: false,
    storageKey: "scroll:test",
    getItem: (key) => {
      calls.getItem += 1;
      return store[key] ?? null;
    },
    setItem: (key, value) => {
      calls.setItem += 1;
      store[key] = value;
    },
    setManualScrollRestoration: () => {
      calls.setManual += 1;
    },
    restore: {
      documentHeight: () => 3000,
      viewportHeight: () => 600,
      scrollTo: (offset) => {
        scrolledTo.push(offset);
        scrollY = offset;
      },
      now: () => 0,
      schedule: () => {},
    },
    getScrollY: () => scrollY,
    addScrollListener: (handler) => {
      calls.addListener += 1;
      scrollHandler = handler;
    },
    removeScrollListener: () => {
      calls.removeListener += 1;
    },
    ...overrides,
  };

  return {
    deps,
    calls,
    store,
    scrolledTo,
    setScrollY: (value: number) => {
      scrollY = value;
    },
    fireScroll: () => scrollHandler?.(),
  };
}

describe("runScrollRestoration", () => {
  it("com enabled falso não lê nem grava nada, e o cleanup também não faz nada", () => {
    const h = runHarness({ enabled: false });

    const cleanup = runScrollRestoration(h.deps);

    expect(h.calls.getItem).toBe(0);
    expect(h.calls.setManual).toBe(0);
    expect(h.calls.addListener).toBe(0);
    expect(h.scrolledTo).toEqual([]);

    cleanup();

    expect(h.calls.setItem).toBe(0);
    expect(h.calls.removeListener).toBe(0);
  });

  it("grava no cleanup a posição rastreada por scroll, não a lida depois da troca de página", () => {
    // AppLayout é persistente: o React troca o <Outlet/> para a página nova
    // antes do cleanup do efeito da página antiga rodar. Se o cleanup lesse
    // scrollY diretamente ali, pegaria a posição da página NOVA (aqui
    // simulada como 0, uma página mais curta) em vez da posição de saída
    // real do usuário.
    const h = runHarness();

    const cleanup = runScrollRestoration(h.deps);
    h.setScrollY(1800);
    h.fireScroll();

    h.setScrollY(0); // troca de DOM para a página de destino, mais curta

    cleanup();

    expect(h.store["scroll:test"]).toBe("1800");
  });

  it("com enabled verdadeiro e navegação POP, restaura a posição salva", () => {
    const h = runHarness({ isPop: true });
    h.store["scroll:test"] = "800";

    runScrollRestoration(h.deps);

    expect(h.scrolledTo).toEqual([800]);
  });

  it("com enabled verdadeiro e navegação normal, zera a rolagem", () => {
    const h = runHarness({ isPop: false });

    runScrollRestoration(h.deps);

    expect(h.scrolledTo).toEqual([0]);
  });
});
