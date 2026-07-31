import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  refreshMock,
  acceptMock,
  signOutMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  refreshMock: vi.fn(),
  acceptMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: authMock }));
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ refresh: refreshMock }),
}));
vi.mock("@/services/team-management", () => ({
  teamManagementService: { acceptInvitation: acceptMock },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: signOutMock } },
}));
vi.mock("@/components/common/Logo", () => ({
  LogoFull: () => <div>ADVeyes</div>,
}));
vi.mock("@/components/auth/InvitationAuthOptions", () => ({
  InvitationAuthOptions: () => <div>Opções de autenticação</div>,
}));

import ConviteAceite from "@/pages/ConviteAceite";

describe("ConviteAceite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/convite/aceitar");
    refreshMock.mockResolvedValue(undefined);
  });

  it("guarda o token e remove da barra antes de autenticar", async () => {
    authMock.mockReturnValue({ user: null, loading: false });
    window.history.replaceState(
      {},
      "",
      "/convite/aceitar?token=token_seguro_com_mais_de_32_caracteres_123",
    );

    render(<MemoryRouter><ConviteAceite /></MemoryRouter>);

    await waitFor(() =>
      expect(screen.getByText("Opções de autenticação")).toBeInTheDocument()
    );
    expect(sessionStorage.getItem("adveyes:tenant-invitation-token")).toBe(
      "token_seguro_com_mais_de_32_caracteres_123",
    );
    expect(window.location.search).toBe("");
  });

  it("aceita automaticamente após autenticação", async () => {
    authMock.mockReturnValue({
      user: { id: "user-1", email: "convidado@example.com" },
      loading: false,
    });
    sessionStorage.setItem(
      "adveyes:tenant-invitation-token",
      "token_seguro_com_mais_de_32_caracteres_123",
    );
    acceptMock.mockResolvedValue({
      tenant_id: "tenant-1",
      membership_id: "membership-1",
    });

    render(<MemoryRouter><ConviteAceite /></MemoryRouter>);

    await waitFor(() =>
      expect(screen.getByText("Convite aceito")).toBeInTheDocument()
    );
    expect(acceptMock).toHaveBeenCalledWith(
      "token_seguro_com_mais_de_32_caracteres_123",
    );
    expect(refreshMock).toHaveBeenCalled();
    expect(
      sessionStorage.getItem("adveyes:tenant-invitation-token"),
    ).toBeNull();
  });

  it("informa link ausente sem chamar o backend", async () => {
    authMock.mockReturnValue({ user: null, loading: false });

    render(<MemoryRouter><ConviteAceite /></MemoryRouter>);

    await waitFor(() =>
      expect(screen.getByText(/link do convite está ausente/i))
        .toBeInTheDocument()
    );
    expect(acceptMock).not.toHaveBeenCalled();
  });
});
