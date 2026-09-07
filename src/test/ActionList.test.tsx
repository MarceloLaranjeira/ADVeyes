import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionList } from "@/components/controladoria/ActionList";
import type { ActionItem } from "@/types/controladoria";

const deadline: ActionItem = {
  id: "deadline-1",
  kind: "prazo",
  title: "Apresentar contestação",
  dueDate: "2026-08-28",
  processNumber: "0001234-56.2026.8.04.0001",
  processId: "process-1",
  clientName: "Maria Oliveira",
  assigneeId: null,
  assigneeName: null,
  status: "pendente",
};

describe("ActionList", () => {
  it("mostra a data absoluta e quanto falta no card de prazo", () => {
    render(<ActionList items={[deadline]} now={new Date(2026, 7, 26)} onOpenItem={() => undefined} />);
    expect(screen.getByText(/Vencimento: 28\/08\/2026 · Faltam 2 dias/)).toBeInTheDocument();
  });

  it("abre o ambiente de origem pelo card e preserva ações internas", () => {
    const open = vi.fn();
    const internal = vi.fn();
    render(
      <ActionList items={[deadline]} now={new Date(2026, 7, 26)} onOpenItem={open}>
        {() => <button type="button" onClick={internal}>Ação interna</button>}
      </ActionList>,
    );

    fireEvent.click(screen.getByText("Apresentar contestação"));
    expect(open).toHaveBeenCalledWith(deadline);
    open.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Ação interna" }));
    expect(internal).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });
});
