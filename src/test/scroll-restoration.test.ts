import { describe, expect, it } from "vitest";
import { restoreScrollOffset } from "@/lib/scroll-restoration";

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
