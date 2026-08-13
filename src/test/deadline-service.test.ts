import { describe, expect, it } from "vitest";
import {
  diasAteVencimento,
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

describe("diasAteVencimento", () => {
  const hoje = new Date("2026-08-07T15:30:00.000Z");

  it("conta os dias que faltam", () => {
    expect(diasAteVencimento("2026-08-10", hoje)).toBe(3);
  });

  it("devolve zero no dia do vencimento, mesmo com hora avançada", () => {
    expect(diasAteVencimento("2026-08-07", hoje)).toBe(0);
  });

  it("devolve negativo para prazo vencido", () => {
    expect(diasAteVencimento("2026-08-04", hoje)).toBe(-3);
  });

  it("atravessa a virada de mês", () => {
    expect(diasAteVencimento("2026-09-01", hoje)).toBe(25);
  });
});
