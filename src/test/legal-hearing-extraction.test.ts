import { describe, expect, it } from "vitest";
import { extractHearingCandidate } from "../../supabase/functions/_shared/legal-hearing-extraction.ts";

describe("extractHearingCandidate", () => {
  it("extrai audiência com data numérica e hora", () => {
    const result = extractHearingCandidate(
      "Audiência de conciliação designada para 20/08/2026 às 09:30.",
    );
    expect(result).toMatchObject({
      type: "Audiência",
      startsAt: "2026-08-20T13:30:00.000Z",
      confidence: 0.95,
    });
  });

  it("extrai sessão com data escrita", () => {
    const result = extractHearingCandidate(
      "Sessão de julgamento em 9 de setembro de 2026 às 14h00.",
    );
    expect(result).toMatchObject({
      type: "Sessão de julgamento",
      startsAt: "2026-09-09T18:00:00.000Z",
    });
  });

  it("não cria evento sem data e hora explícitas", () => {
    expect(extractHearingCandidate("Audiência será oportunamente marcada."))
      .toBeNull();
    expect(extractHearingCandidate("Prazo de 15 dias às partes."))
      .toBeNull();
  });

  it("rejeita datas e horários inválidos", () => {
    expect(extractHearingCandidate("Audiência em 31/02/2026 às 09:00"))
      .toBeNull();
    expect(extractHearingCandidate("Audiência em 20/08/2026 às 25:00"))
      .toBeNull();
  });
});
