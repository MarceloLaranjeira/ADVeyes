import { beforeEach, describe, expect, it } from "vitest";
import {
  calendarItemClock,
  formatHearingClock,
  formatHearingMoment,
  readViewZone,
  resolveZone,
  VIEW_ZONE_KEY,
  writeViewZone,
} from "@/lib/display-zone";

const NOON_MANAUS = "2026-11-03T13:00:00Z";

describe("preferência de fuso", () => {
  beforeEach(() => window.localStorage.clear());

  it("usa Manaus por padrão e ignora valores inválidos", () => {
    expect(readViewZone()).toBe("America/Manaus");
    window.localStorage.setItem(VIEW_ZONE_KEY, "Europe/Lisbon");
    expect(readViewZone()).toBe("America/Manaus");
  });

  it("guarda e devolve a escolha", () => {
    writeViewZone("America/Sao_Paulo");
    expect(readViewZone()).toBe("America/Sao_Paulo");
    writeViewZone("auto");
    expect(readViewZone()).toBe("auto");
  });

  it("em auto usa o fuso do tribunal, com Manaus de reserva", () => {
    expect(resolveZone("America/Rio_Branco", "auto")).toBe("America/Rio_Branco");
    expect(resolveZone(null, "auto")).toBe("America/Manaus");
    expect(resolveZone("America/Rio_Branco", "America/Sao_Paulo")).toBe("America/Sao_Paulo");
  });
});

describe("formatHearingMoment", () => {
  beforeEach(() => window.localStorage.clear());

  it("mostra a hora no fuso escolhido com o nome do fuso", () => {
    expect(formatHearingMoment(NOON_MANAUS)).toBe("03/11/2026 às 09:00 (Manaus)");
    writeViewZone("America/Sao_Paulo");
    expect(formatHearingMoment(NOON_MANAUS)).toBe("03/11/2026 às 10:00 (Brasília)");
  });

  it("mostra a janela da sessão virtual", () => {
    expect(formatHearingMoment("2026-11-03T04:00:00Z", { endsAt: "2026-11-09T03:59:00Z" }))
      .toBe("03/11/2026 às 00:00 até 08/11/2026 às 23:59 (Manaus)");
  });

  it("trata meia-noite importada sem janela como horário não informado", () => {
    expect(formatHearingMoment("2026-11-03T04:00:00Z", { imported: true })).toBe("03/11/2026 · horário não informado");
  });
});

describe("hora nos cartões da agenda", () => {
  beforeEach(() => window.localStorage.clear());

  it("audiência usa o fuso escolhido e tarefa o do navegador", () => {
    expect(formatHearingClock(NOON_MANAUS, "America/Manaus")).toBe("09:00");
    expect(calendarItemClock({ sourceType: "hearing", date: NOON_MANAUS, timezone: null })).toBe("09:00");
    const local = calendarItemClock({ sourceType: "task", date: NOON_MANAUS });
    expect(local).toMatch(/^\d{2}:\d{2}$/);
  });
});
