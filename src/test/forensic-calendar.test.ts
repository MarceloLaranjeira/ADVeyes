import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  computeDeadline,
  easterSunday,
  isInRecess,
  nationalHolidays,
  nextBusinessDay,
  parseIsoDate,
  toIsoDate,
} from "../../supabase/functions/_shared/forensic-calendar.ts";

describe("easterSunday", () => {
  // Datas conferidas contra o calendário litúrgico publicado.
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2030, "2030-04-21"],
  ])("calcula a Páscoa de %i", (year, expected) => {
    expect(toIsoDate(easterSunday(year))).toBe(expected);
  });
});

describe("nationalHolidays", () => {
  it("deriva os feriados móveis de 2026 a partir da Páscoa", () => {
    const dates = new Map(
      nationalHolidays(2026).map((h) => [h.date, h.description]),
    );
    expect(dates.get("2026-02-16")).toContain("Carnaval");
    expect(dates.get("2026-02-17")).toContain("Carnaval");
    expect(dates.get("2026-04-03")).toBe("Sexta-feira Santa");
    expect(dates.get("2026-06-04")).toBe("Corpus Christi");
  });

  it("marca a Quarta-feira de Cinzas como expediente reduzido, não feriado", () => {
    const cinzas = nationalHolidays(2026).find((h) =>
      h.date === "2026-02-18"
    );
    expect(cinzas?.partialExpedient).toBe(true);
  });

  it("inclui a Consciência Negra só a partir de 2024 (Lei 14.759/2023)", () => {
    const has = (year: number) =>
      nationalHolidays(year).some((h) => h.date === `${year}-11-20`);
    expect(has(2023)).toBe(false);
    expect(has(2024)).toBe(true);
    expect(has(2026)).toBe(true);
  });
});

describe("isInRecess", () => {
  it("suspende de 20 de dezembro a 20 de janeiro, inclusive", () => {
    expect(isInRecess(parseIsoDate("2026-12-19"))).toBe(false);
    expect(isInRecess(parseIsoDate("2026-12-20"))).toBe(true);
    expect(isInRecess(parseIsoDate("2026-12-31"))).toBe(true);
    expect(isInRecess(parseIsoDate("2027-01-20"))).toBe(true);
    expect(isInRecess(parseIsoDate("2027-01-21"))).toBe(false);
  });
});

describe("nextBusinessDay", () => {
  const calendar = buildCalendar([2026]);

  it("pula o fim de semana", () => {
    // 2026-03-07 é sábado.
    expect(toIsoDate(nextBusinessDay(parseIsoDate("2026-03-07"), calendar)))
      .toBe("2026-03-09");
  });

  it("pula feriado nacional", () => {
    // 2026-04-21 é Tiradentes, numa terça.
    expect(toIsoDate(nextBusinessDay(parseIsoDate("2026-04-21"), calendar)))
      .toBe("2026-04-22");
  });

  it("devolve o próprio dia quando já é útil", () => {
    expect(toIsoDate(nextBusinessDay(parseIsoDate("2026-03-04"), calendar)))
      .toBe("2026-03-04");
  });
});

describe("computeDeadline", () => {
  it("aplica a cadeia disponibilização → publicação → termo inicial", () => {
    // 2026-03-02 é segunda-feira.
    const result = computeDeadline({
      disponibilizacao: "2026-03-02",
      dias: 15,
    });

    expect(result.publicacao).toBe("2026-03-03");
    expect(result.termoInicial).toBe("2026-03-04");
    expect(result.vencimento).toBe("2026-03-24");
    expect(result.diasUteisContados).toBe(15);
  });

  it("conta somente dias úteis, registrando o que foi pulado", () => {
    const result = computeDeadline({
      disponibilizacao: "2026-03-02",
      dias: 5,
    });

    // Termo inicial 04/03 (quarta): 04, 05, 06, 09, 10.
    expect(result.vencimento).toBe("2026-03-10");
    expect(result.diasNaoUteis.map((d) => d.date)).toEqual([
      "2026-03-07",
      "2026-03-08",
    ]);
    expect(result.diasNaoUteis[0].reason).toBe("sábado");
    expect(result.diasNaoUteis[1].reason).toBe("domingo");
  });

  it("suspende o prazo durante o recesso do art. 220", () => {
    // 2026-12-15 é terça. O prazo atravessa o recesso e reabre em 21/01.
    const result = computeDeadline({
      disponibilizacao: "2026-12-15",
      dias: 5,
    });

    expect(result.publicacao).toBe("2026-12-16");
    expect(result.termoInicial).toBe("2026-12-17");
    expect(result.vencimento).toBe("2027-01-25");
    expect(result.fundamentos.join(" ")).toContain("art. 220");
    expect(
      result.diasNaoUteis.some((d) => d.reason?.includes("recesso")),
    ).toBe(true);
  });

  it("não protrai a publicação quando a intimação é pessoal", () => {
    const result = computeDeadline({
      disponibilizacao: "2026-03-02",
      dias: 5,
      intimacaoPessoal: true,
    });

    expect(result.publicacao).toBe("2026-03-02");
    expect(result.termoInicial).toBe("2026-03-03");
    expect(result.fundamentos.join(" ")).toContain("Intimação pessoal");
  });

  it("conta em dias corridos quando pedido", () => {
    const result = computeDeadline({
      disponibilizacao: "2026-03-02",
      dias: 10,
      diasCorridos: true,
    });

    // Termo inicial 04/03 + 9 dias corridos = 13/03 (sexta).
    expect(result.vencimento).toBe("2026-03-13");
    expect(result.fundamentos.join(" ")).toContain("dias corridos");
  });

  it("protrai o vencimento que cai em dia corrido não útil", () => {
    // Em dias corridos o vencimento pode cair num sábado; art. 224, §1.
    const result = computeDeadline({
      disponibilizacao: "2026-03-02",
      dias: 11,
      diasCorridos: true,
    });

    // 04/03 + 10 = 14/03, sábado → protraído para 16/03.
    expect(result.vencimento).toBe("2026-03-16");
    expect(result.fundamentos.join(" ")).toContain("art. 224, §1");
  });

  it("respeita feriado de tribunal informado pelo banco", () => {
    const semExtra = computeDeadline({
      disponibilizacao: "2026-03-02",
      dias: 5,
    });
    const comExtra = computeDeadline({
      disponibilizacao: "2026-03-02",
      dias: 5,
      extraHolidays: [
        { date: "2026-03-09", description: "Feriado municipal" },
      ],
    });

    expect(semExtra.vencimento).toBe("2026-03-10");
    expect(comExtra.vencimento).toBe("2026-03-11");
  });

  it("rejeita prazo inválido", () => {
    expect(() => computeDeadline({ disponibilizacao: "2026-03-02", dias: 0 }))
      .toThrow(/maior que zero/);
    expect(() =>
      computeDeadline({ disponibilizacao: "2026-02-30", dias: 5 })
    ).toThrow(/inexistente/);
  });
});
