import { describe, expect, it } from "vitest";
import { buildProcessTimeline, summarizeTimelineText } from "@/lib/process-timeline";

describe("buildProcessTimeline", () => {
  it("combina e ordena todas as origens pela data mais recente", () => {
    const result = buildProcessTimeline({
      movements: [{ id: "m1", occurred_at: "2026-08-01", content: "Movimento" }],
      publications: [{ id: "p1", data_publicacao: "2026-08-03", conteudo: "Publicação" }],
      manual: [{ id: "a1", data_andamento: "2026-08-02", descricao: "Registro" }],
    });

    expect(result.map((event) => event.kind)).toEqual([
      "publication",
      "manual",
      "movement",
    ]);
  });

  it("decodifica entidades HTML aninhadas e remove marcação", () => {
    const [event] = buildProcessTimeline({
      publications: [{
        id: "p1",
        tipo: "Intima&amp;ccedil;&amp;atilde;o",
        conteudo: "PODER JUDICI&amp;Aacute;RIO <strong>oficial</strong>",
      }],
    });

    expect(event.title).toBe("Intimação");
    expect(event.content).toBe("PODER JUDICIÁRIO oficial");
  });

  it("usa textos seguros quando o provedor envia campos incompletos", () => {
    const [event] = buildProcessTimeline({ movements: [{ id: "m1" }] });
    expect(event.title).toBe("Andamento");
    expect(event.content).not.toContain("undefined");
  });
});

describe("summarizeTimelineText", () => {
  it("resume textos longos sem cortar a última palavra", () => {
    expect(summarizeTimelineText("uma frase jurídica muito extensa", 18)).toBe("uma frase jurídica…");
  });
});
