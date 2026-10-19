import { describe, expect, it } from "vitest";
import { matchesPeriod } from "@/lib/publication-filters";

const NOW = new Date("2026-10-19T15:00:00Z");

describe("matchesPeriod", () => {
  it("aceita tudo no período completo, mesmo sem data", () => {
    expect(matchesPeriod(null, "todas", NOW)).toBe(true);
  });

  it("filtra por hoje usando só a data", () => {
    expect(matchesPeriod("2026-10-19T00:00:00+00:00", "hoje", NOW)).toBe(true);
    expect(matchesPeriod("2026-10-18", "hoje", NOW)).toBe(false);
    expect(matchesPeriod(null, "hoje", NOW)).toBe(false);
  });

  it("inclui os limites de 7 e 30 dias e exclui futuro", () => {
    expect(matchesPeriod("2026-10-13", "7d", NOW)).toBe(true);
    expect(matchesPeriod("2026-10-12", "7d", NOW)).toBe(false);
    expect(matchesPeriod("2026-09-20", "30d", NOW)).toBe(true);
    expect(matchesPeriod("2026-09-19", "30d", NOW)).toBe(false);
    expect(matchesPeriod("2026-10-20", "7d", NOW)).toBe(false);
  });
});
