import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  computeDeadline,
  parseIsoDate,
  subtractBusinessDays,
  toIsoDate,
} from "../../supabase/functions/_shared/forensic-calendar.ts";

const calendario = buildCalendar([2026]);

function recuar(vencimento: string, dias: number): string {
  return toIsoDate(
    subtractBusinessDays(parseIsoDate(vencimento), dias, calendario),
  );
}

describe("subtractBusinessDays", () => {
  it("é a diferença que justifica o recurso inteiro", () => {
    // 2026-08-17 é uma segunda-feira. Três dias corridos antes seria
    // 14/08, uma sexta — véspera, com o fim de semana no meio. Três dias
    // úteis caem na quarta da semana anterior.
    expect(recuar("2026-08-17", 3)).toBe("2026-08-12");
  });

  it("não conta o dia de partida", () => {
    // De uma quarta, recuar 1 dia útil devolve a terça.
    expect(recuar("2026-08-12", 1)).toBe("2026-08-11");
  });

  it("pula o fim de semana", () => {
    // Segunda 17/08 menos 1 dia útil é a sexta 14/08.
    expect(recuar("2026-08-17", 1)).toBe("2026-08-14");
  });

  it("pula feriado nacional", () => {
    // 07/09/2026 é segunda (Independência). Terça 08/09 menos 1 dia útil
    // salta o feriado e a sexta anterior, 04/09.
    expect(recuar("2026-09-08", 1)).toBe("2026-09-04");
  });

  it("atravessa o recesso forense sem pousar dentro dele", () => {
    // O recesso vai de 20/12 a 20/01. Recuar de 21/01 tem de sair do
    // outro lado, em dezembro, antes do dia 20.
    const resultado = recuar("2026-01-21", 1);
    expect(resultado < "2025-12-20").toBe(true);
  });

  it("com zero dias, devolve o próprio dia se for útil", () => {
    expect(recuar("2026-08-12", 0)).toBe("2026-08-12");
  });

  it("com zero dias num sábado, recua para a sexta", () => {
    // 2026-08-15 é sábado. Prazo interno nunca cai em dia sem expediente.
    expect(recuar("2026-08-15", 0)).toBe("2026-08-14");
  });

  it("trata número negativo como zero, sem avançar no calendário", () => {
    expect(recuar("2026-08-12", -5)).toBe("2026-08-12");
  });

  it("recua uma quinzena útil sem cair em dia fechado", () => {
    const resultado = recuar("2026-08-17", 10);
    const dia = parseIsoDate(resultado).getUTCDay();
    expect(dia).not.toBe(0);
    expect(dia).not.toBe(6);
  });
});

describe("regime penal — termo inicial", () => {
  it("não protrai o termo inicial para dia útil", () => {
    // Intimação pessoal na sexta 07/08/2026. No CPC o termo inicial seria
    // protraído para segunda; no CPP a contagem corre do dia seguinte, o
    // sábado, porque o art. 798, §1 só exclui o dia do começo.
    const penal = computeDeadline({
      disponibilizacao: "2026-08-07",
      dias: 5,
      diasCorridos: true,
      intimacaoPessoal: true,
      regimePenal: true,
    });
    expect(penal.termoInicial).toBe("2026-08-08");

    const civel = computeDeadline({
      disponibilizacao: "2026-08-07",
      dias: 5,
      diasCorridos: true,
      intimacaoPessoal: true,
    });
    expect(civel.termoInicial).toBe("2026-08-10");
  });

  it("a data fatal penal não sai depois da devida", () => {
    // O ponto do achado: protrair o início empurrava o vencimento para
    // depois do prazo legal, mostrando folga que não existe.
    const penal = computeDeadline({
      disponibilizacao: "2026-08-07",
      dias: 5,
      diasCorridos: true,
      intimacaoPessoal: true,
      regimePenal: true,
    });
    const civel = computeDeadline({
      disponibilizacao: "2026-08-07",
      dias: 5,
      diasCorridos: true,
      intimacaoPessoal: true,
    });
    expect(penal.vencimento < civel.vencimento).toBe(true);
  });

  it("cita o CPP na trilha, não o CPC", () => {
    const penal = computeDeadline({
      disponibilizacao: "2026-08-07",
      dias: 5,
      diasCorridos: true,
      intimacaoPessoal: true,
      regimePenal: true,
    });
    expect(penal.fundamentos.some((f) => f.includes("798"))).toBe(true);
    expect(penal.fundamentos.some((f) => f.includes("224, §3"))).toBe(false);
  });

  it("ainda prorroga vencimento que cai em dia sem expediente", () => {
    // CPP art. 798, §3 — a prorrogação do vencimento continua valendo.
    const penal = computeDeadline({
      disponibilizacao: "2026-08-05",
      dias: 3,
      diasCorridos: true,
      intimacaoPessoal: true,
      regimePenal: true,
    });
    const diaDaSemana = parseIsoDate(penal.vencimento).getUTCDay();
    expect(diaDaSemana).not.toBe(0);
    expect(diaDaSemana).not.toBe(6);
  });

  it("publicação penal no diário ainda começa em dia útil", () => {
    // A dispensa de protração vale para a intimação pessoal, não para o
    // diário. A Lei 11.419/2006 alcança o processo penal (art. 1º, §1º) e
    // manda o prazo começar no primeiro dia útil seguinte à publicação
    // (art. 4º, §4º). Sem isso, uma publicação antes do fim de semana
    // começaria no sábado e a data fatal sairia ANTES da devida.
    const penalDjen = computeDeadline({
      disponibilizacao: "2026-08-05",
      dias: 5,
      diasCorridos: true,
      regimePenal: true,
    });
    const inicio = parseIsoDate(penalDjen.termoInicial).getUTCDay();
    expect(inicio).not.toBe(0);
    expect(inicio).not.toBe(6);
    expect(penalDjen.fundamentos.some((f) => f.includes("11.419"))).toBe(true);
  });

  it("o padrão continua sendo o regime do CPC", () => {
    // Guarda de regressão: nenhum chamador existente muda de comportamento.
    const semRegime = computeDeadline({
      disponibilizacao: "2026-08-07",
      dias: 15,
    });
    expect(semRegime.fundamentos.some((f) => f.includes("224, §3"))).toBe(true);
  });
});
