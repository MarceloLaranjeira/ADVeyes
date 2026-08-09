import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/layout/AppHeader";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "advogado@exemplo.com" }, signOut: vi.fn() }),
}));

vi.mock("@/components/notifications/NotificationPanel", () => ({
  NotificationPanel: () => <button aria-label="Notificações">Notificações</button>,
}));

vi.mock("@/components/common/Logo", () => ({
  LogoFull: () => <span>ADVeyes</span>,
}));

vi.mock("@/components/layout/EnvironmentSwitcher", () => ({
  EnvironmentSwitcher: () => <span>Escritório ativo</span>,
}));

describe("AppHeader", () => {
  it("mantém ações globais e remove atalhos duplicados da sidebar", () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText("Pesquisar contato, processo ou tarefa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notificações" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contratar" })).toBeInTheDocument();

    expect(screen.queryByTitle("Assistente IA")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Importar / Documentos")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Cronômetro")).not.toBeInTheDocument();
    expect(screen.queryByTitle("WhatsApp")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Configurações")).not.toBeInTheDocument();
  });
});
