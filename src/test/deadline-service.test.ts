import { describe, expect, it } from "vitest";
import {
  diasUteisAteVencimento,
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

describe("diasUteisAteVencimento", () => {
  // 07/08/2026 é uma sexta-feira.
  const hoje = new Date("2026-08-07T15:30:00.000Z");

  it("conta dias úteis, não corridos", () => {
    // Segunda 10/08 está a três dias corridos, mas a um único dia útil:
    // o sábado e o domingo no meio não contam.
    expect(diasUteisAteVencimento("2026-08-10", hoje)).toBe(1);
  });

  it("devolve zero no dia do vencimento, mesmo com hora avançada", () => {
    expect(diasUteisAteVencimento("2026-08-07", hoje)).toBe(0);
  });

  it("devolve negativo para prazo vencido", () => {
    expect(diasUteisAteVencimento("2026-08-04", hoje)).toBe(-3);
  });

  it("atravessa a virada de mês descontando os fins de semana", () => {
    // 25 dias corridos até 01/09, dos quais 17 são úteis.
    expect(diasUteisAteVencimento("2026-09-01", hoje)).toBe(17);
  });

  it("não promete folga que o recesso forense não tem", () => {
    // Era o caso perigoso da contagem em dias corridos: em 21/12, um prazo
    // que vence em 11/01 aparecia como "faltam 21 dias". Não há um único
    // dia útil no meio — o fórum está fechado do dia 20/12 ao 20/01.
    const vespera = new Date("2026-12-21T10:00:00.000Z");
    expect(diasUteisAteVencimento("2027-01-11", vespera)).toBe(0);
  });

  it("desconta feriado de tribunal quando o calendário é informado", () => {
    // Sem o feriado, segunda 10/08 está a um dia útil. Com ele, a zero.
    expect(
      diasUteisAteVencimento("2026-08-10", hoje, [
        { date: "2026-08-10", description: "feriado do tribunal" },
      ]),
    ).toBe(0);
  });
});
