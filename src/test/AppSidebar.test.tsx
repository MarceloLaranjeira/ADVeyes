import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/layout/AppSidebar";

vi.mock("@/hooks/usePlatformAdmin", () => ({
  usePlatformAdmin: () => ({ isPlatformAdmin: false }),
}));

describe("AppSidebar", () => {
  it("destaca a rota ativa sem controlar a rolagem do usuário", () => {
    render(
      <MemoryRouter initialEntries={["/agenda"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation");
    expect(navigation.scrollTop).toBe(0);
    const activeLink = screen.getByRole("link", { name: "Agenda" });
    expect(activeLink).toHaveClass("font-bold");
    expect(activeLink.className).not.toContain("--gold");
  });

  it("separa processos de relacionamento e remove a busca redundante", () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Busca processual" })).not.toBeInTheDocument();
    expect(screen.getByText("Processos")).toBeInTheDocument();
    expect(screen.getByText("Relacionamento")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Central Processual" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Contatos" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "CRM — Leads" })).toHaveLength(1);
  });

  it("mantém textos secundários da navegação com pelo menos 82% de opacidade", () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Visão geral")).toHaveClass("text-sidebar-foreground/85");
    expect(screen.getByText("Cobertura DataJud/CNJ")).toHaveClass("text-sidebar-foreground/85");
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveClass("text-sidebar-foreground/90");
  });
});
