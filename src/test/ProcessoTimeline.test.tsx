import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProcessoTimeline } from "@/components/processos/ProcessoTimeline";

describe("ProcessoTimeline", () => {
  it("exibe os andamentos em lista e permite abrir a íntegra", () => {
    render(
      <ProcessoTimeline
        events={[{
          id: "movement:1",
          kind: "movement",
          occurredAt: "2026-08-01T12:00:00Z",
          title: "Juntada de petição",
          summary: "Resumo do andamento…",
          content: "Conteúdo completo do andamento processual.",
          provider: "datajud",
          sourceName: "DataJud/CNJ",
          sourceUrl: null,
          tribunal: null,
          possibleDeadline: false,
        }]}
      />,
    );

    expect(screen.getByText("Juntada de petição")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveClass("grid");
    expect(screen.getByText("01 de agosto de 2026")).toBeInTheDocument();
    expect(screen.getByText("Resumo do andamento…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver íntegra/i }));
    expect(screen.getByText("Conteúdo completo do andamento processual.")).toBeInTheDocument();
  });
});
