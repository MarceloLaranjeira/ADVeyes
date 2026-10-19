import { describe, expect, it } from "vitest";
import { formatInZone, inputToIso, isKnownZone, isoToInput, zoneName } from "@/lib/timezone";

describe("isoToInput / inputToIso", () => {
  it("mostra o mesmo instante em cada fuso do Brasil", () => {
    const instant = "2026-11-03T13:00:00Z";
    expect(isoToInput(instant, "America/Manaus")).toBe("2026-11-03T09:00");
    expect(isoToInput(instant, "America/Sao_Paulo")).toBe("2026-11-03T10:00");
    expect(isoToInput(instant, "America/Rio_Branco")).toBe("2026-11-03T08:00");
    expect(isoToInput(instant, "America/Noronha")).toBe("2026-11-03T11:00");
  });

  it("converte o relógio digitado em um fuso para UTC", () => {
    expect(inputToIso("2026-11-03T09:00", "America/Manaus")).toBe("2026-11-03T13:00:00.000Z");
    expect(inputToIso("2026-11-03T09:00", "America/Sao_Paulo")).toBe("2026-11-03T12:00:00.000Z");
    expect(inputToIso("2026-11-03T09:00", "America/Rio_Branco")).toBe("2026-11-03T14:00:00.000Z");
  });

  it("vai e volta sem perder o horário", () => {
    for (const zone of ["America/Manaus", "America/Sao_Paulo", "America/Rio_Branco", "America/Noronha"]) {
      const iso = inputToIso("2026-02-15T23:30", zone) as string;
      expect(isoToInput(iso, zone)).toBe("2026-02-15T23:30");
    }
  });

  it("rejeita entradas inválidas", () => {
    expect(inputToIso("", "America/Manaus")).toBeNull();
    expect(inputToIso("03/11/2026", "America/Manaus")).toBeNull();
    expect(isoToInput("lixo", "America/Manaus")).toBe("");
  });
});

describe("formatInZone", () => {
  it("formata data e hora no fuso escolhido", () => {
    expect(formatInZone("2026-11-03T13:00:00Z", "America/Manaus").text).toBe("03/11/2026 às 09:00");
    expect(formatInZone("2026-11-03T13:00:00Z", "America/Sao_Paulo").text).toBe("03/11/2026 às 10:00");
  });

  it("trata meia-noite importada como horário não informado", () => {
    const label = formatInZone("2026-11-03T04:00:00Z", "America/Manaus", true);
    expect(label).toEqual({ text: "03/11/2026", hasTime: false });
    expect(formatInZone("2026-11-03T04:00:00Z", "America/Manaus", false).text).toBe("03/11/2026 às 00:00");
  });
});

describe("zonas", () => {
  it("reconhece só os fusos do Brasil e nomeia o resto pelo id", () => {
    expect(isKnownZone("America/Manaus")).toBe(true);
    expect(isKnownZone("Europe/Lisbon")).toBe(false);
    expect(zoneName("America/Sao_Paulo")).toBe("Brasília");
    expect(zoneName("Europe/Lisbon")).toBe("Europe/Lisbon");
  });
});
