import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, lookupMock, submitMock, myRequestsMock, toastMock } = vi
  .hoisted(() => ({
    authMock: vi.fn(),
    lookupMock: vi.fn(),
    submitMock: vi.fn(),
    myRequestsMock: vi.fn(),
    toastMock: vi.fn(),
  }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: authMock }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("@/services/access-requests", () => ({
  accessRequestService: {
    lookupLink: lookupMock,
    submit: submitMock,
    myRequests: myRequestsMock,
  },
}));

import SolicitarAcesso from "@/pages/SolicitarAcesso";

const renderAt = (token: string) =>
  render(
    <MemoryRouter initialEntries={[`/solicitar-acesso?token=${token}`]}>
      <SolicitarAcesso />
    </MemoryRouter>,
  );

const validLink = {
  valid: true as const,
  tenant_id: "tenant-1",
  tenant_name: "Albertino Advocacia",
  link_id: "link-1",
};

describe("Solicitar acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockReturnValue({ session: null, user: null, loading: false });
    myRequestsMock.mockResolvedValue({ requests: [] });
  });

  it("recusa um token inexistente", async () => {
    lookupMock.mockResolvedValue({ valid: false, reason: "invalid_token" });

    renderAt("naoexiste");

    expect(await screen.findByText("Link inválido")).toBeInTheDocument();
  });

  it("explica que o link foi revogado", async () => {
    lookupMock.mockResolvedValue({ valid: false, reason: "revoked_token" });

    renderAt("revogado");

    expect(await screen.findByText("Este link foi revogado")).toBeInTheDocument();
  });

  it("mostra o escritório e pede login antes de solicitar", async () => {
    lookupMock.mockResolvedValue(validLink);

    renderAt("valido");

    expect(await screen.findByText("Albertino Advocacia")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /entrar para solicitar/i }),
    ).toBeInTheDocument();
    // Sem sessão não existe formulário: a solicitação é sempre de uma conta.
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
  });

  it("envia a solicitação e mostra o estado de espera", async () => {
    lookupMock.mockResolvedValue(validLink);
    submitMock.mockResolvedValue({
      request_id: "request-1",
      tenant_id: "tenant-1",
      status: "pending",
      already_pending: false,
    });
    authMock.mockReturnValue({
      session: { access_token: "token" },
      user: { email: "helena@example.com", user_metadata: {} },
      loading: false,
    });

    renderAt("valido");

    const nome = await screen.findByLabelText("Nome completo");
    fireEvent.change(nome, { target: { value: "Helena Souza" } });
    fireEvent.change(screen.getByLabelText("OAB"), {
      target: { value: "AM-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /solicitar acesso/i }));

    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith("valido", {
        name: "Helena Souza",
        phone: null,
        oab: "AM-1234",
      })
    );
    expect(await screen.findByText("Aguardando autorização"))
      .toBeInTheDocument();
  });

  it("não entra no escritório enquanto a decisão não vem", async () => {
    lookupMock.mockResolvedValue(validLink);
    myRequestsMock.mockResolvedValue({
      requests: [{
        request_id: "request-1",
        tenant_id: "tenant-1",
        tenant_name: "Albertino Advocacia",
        status: "pending",
        rejection_reason: null,
        created_at: "2026-08-24T12:00:00Z",
        decided_at: null,
      }],
    });
    authMock.mockReturnValue({
      session: { access_token: "token" },
      user: { email: "helena@example.com", user_metadata: {} },
      loading: false,
    });

    renderAt("valido");

    expect(await screen.findByText("Aguardando autorização"))
      .toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
  });
});
