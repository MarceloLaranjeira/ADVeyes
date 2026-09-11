import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DepthCard } from "@/components/dashboard/DepthCard";

describe("DepthCard interativo", () => {
  it("ativa pelo card e por teclado, sem engolir botões internos", () => {
    const activate = vi.fn();
    const inner = vi.fn();
    render(<DepthCard interactive onActivate={activate}><span>Conteúdo</span><button type="button" onClick={inner}>Interno</button></DepthCard>);

    const card = screen.getByText("Conteúdo").closest("[role='button']");
    expect(card).not.toBeNull();
    fireEvent.click(screen.getByText("Conteúdo"));
    fireEvent.keyDown(card!, { key: "Enter" });
    expect(activate).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Interno" }));
    expect(inner).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledTimes(2);
  });
});
