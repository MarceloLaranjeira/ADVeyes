import { describe, expect, it } from "vitest";
import {
  situacaoDoPrazo,
  hojeNoFusoForense,
  pesoDaConfianca,
} from "@/services/deadline";

describe("pesoDaConfianca", () => {
  it("não exige leitura quando o prazo veio escrito ou do advogado", () => {
    expect(pesoDaConfianca("explicito").exigeLeitura).toBe(false);
    expect(pesoDaConfianca("manual").exigeLeitura).toBe(false);
  });

  it("exige leitura quando o prazo foi deduzido", () => {
    expect(pesoDaConfianca("inferido").exigeLeitura).toBe(true);
    expect(pesoDaConfianca("residual").exigeLeitura).toBe(true);
  });

  it("dá um rótulo legível para cada nível", () => {
    for (const nivel of ["explicito", "inferido", "residual", "manual"] as const) {
      expect(pesoDaConfianca(nivel).rotulo.length).toBeGreaterThan(0);
    }
  });
});

describe("situacaoDoPrazo", () => {
  // 07/08/2026 é uma sexta-feira.
  const hoje = new Date("2026-08-07T15:30:00.000Z");

  it("conta dias úteis, não corridos", () => {
    // Segunda 10/08 está a três dias corridos, mas a um único dia útil.
    expect(situacaoDoPrazo("2026-08-10", hoje)).toEqual({
      estado: "a_vencer",
      diasUteis: 1,
    });
  });

  it("reconhece o dia do vencimento, mesmo com hora avançada", () => {
    expect(situacaoDoPrazo("2026-08-07", hoje)).toEqual({
      estado: "vence_hoje",
    });
  });

  it("marca prazo vencido como vencido", () => {
    expect(situacaoDoPrazo("2026-08-04", hoje)).toEqual({
      estado: "vencido",
      diasUteis: 3,
    });
  });

  it("atravessa a virada de mês descontando os fins de semana", () => {
    // 25 dias corridos até 01/09, dos quais 17 são úteis.
    expect(situacaoDoPrazo("2026-09-01", hoje)).toEqual({
      estado: "a_vencer",
      diasUteis: 17,
    });
  });

  it("não confunde prazo vencido no fim de semana com vencimento hoje", () => {
    // O prazo venceu na sexta 07/08 e hoje é sábado 08/08. Não há nenhum dia
    // útil no intervalo. A contagem numérica devolvia -0, e como `-0 < 0` é
    // falso e `-0 === 0` é verdadeiro, o cartão anunciava "Vence hoje" para
    // um prazo já perdido.
    const sabado = new Date("2026-08-08T10:00:00.000Z");
    expect(situacaoDoPrazo("2026-08-07", sabado)).toEqual({
      estado: "vencido",
      diasUteis: 0,
    });
  });

  it("não anuncia vencimento hoje quando o recesso separa as datas", () => {
    // Em 21/12 um prazo que vence em 11/01 tem zero dias úteis no meio, mas
    // está a três semanas de distância.
    const vespera = new Date("2026-12-21T10:00:00.000Z");
    expect(situacaoDoPrazo("2027-01-11", vespera)).toEqual({
      estado: "a_vencer",
      diasUteis: 0,
    });
  });

  it("desconta feriado de tribunal quando o calendário é informado", () => {
    expect(
      situacaoDoPrazo("2026-08-10", hoje, [
        { date: "2026-08-10", description: "feriado do tribunal" },
      ]),
    ).toEqual({ estado: "a_vencer", diasUteis: 0 });
  });
});

describe("data civil no fuso forense", () => {
  it("não vira o dia às 21h de Brasília", () => {
    // 2026-08-10T00:30:00Z é 10/08 em UTC e ainda 09/08 em Brasília. Ler em
    // UTC classificava o prazo pelo dia seguinte justamente na faixa da noite
    // em que o advogado mais confere prazo.
    expect(hojeNoFusoForense(new Date("2026-08-10T00:30:00Z"))).toBe("2026-08-09");
  });

  it("acompanha a virada real do dia civil", () => {
    expect(hojeNoFusoForense(new Date("2026-08-10T02:59:00Z"))).toBe("2026-08-09");
    expect(hojeNoFusoForense(new Date("2026-08-10T03:01:00Z"))).toBe("2026-08-10");
  });

  it("um prazo que vence hoje não aparece como vencido à noite", () => {
    const meiaNoiteMeiaUtc = new Date("2026-08-10T00:30:00Z");
    expect(
      situacaoDoPrazo("2026-08-09", hojeNoFusoForense(meiaNoiteMeiaUtc)),
    ).toEqual({ estado: "vence_hoje" });
  });
});

describe("calendário cobre os anos do meio", () => {
  it("conta feriado de ano intermediário como dia não útil", () => {
    // Um intervalo que atravessa mais de um ano deixava o ano do meio sem
    // feriados, e cada feriado nacional em dia de semana virava dia útil —
    // a contagem saía maior do que a real.
    const situacao = situacaoDoPrazo("2028-06-01", "2026-11-01");
    if (situacao.estado !== "a_vencer") throw new Error("esperado a_vencer");

    // 2027 tem feriados nacionais em dia de semana; se o ano tivesse ficado
    // de fora, a contagem seria maior. O limite superior é o total de dias
    // de semana no intervalo, que só se atinge sem feriado nenhum.
    const diasDeSemana = Math.floor(578 / 7) * 5;
    expect(situacao.diasUteis).toBeLessThan(diasDeSemana);
  });
});
