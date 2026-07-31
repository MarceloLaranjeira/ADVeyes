import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { onAuthStateChangeMock, getSessionMock } = vi.hoisted(() => ({
  onAuthStateChangeMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: onAuthStateChangeMock,
      getSession: getSessionMock,
      signOut: vi.fn(),
    },
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

type AuthCallback = (event: string, session: unknown) => void;

const buildSession = (accessToken: string, userId = "user-a") => ({
  access_token: accessToken,
  refresh_token: "refresh",
  expires_in: 3600,
  token_type: "bearer",
  user: { id: userId, email: "advogado@escritorio.com" },
});

/** Conta quantas vezes a identidade do usuário mudou para os consumidores. */
function AuthProbe() {
  const { user, loading } = useAuth();
  const seen = (AuthProbe.identities ??= new Set<unknown>());
  if (user) seen.add(user);

  return (
    <div>
      <span data-testid="status">{loading ? "carregando" : "pronto"}</span>
      <span data-testid="user">{user?.id ?? "anonimo"}</span>
      <span data-testid="identidades">{seen.size}</span>
    </div>
  );
}
AuthProbe.identities = undefined as Set<unknown> | undefined;

describe("AuthProvider", () => {
  let emit: AuthCallback;

  beforeEach(() => {
    vi.clearAllMocks();
    AuthProbe.identities = new Set();
    onAuthStateChangeMock.mockImplementation((callback: AuthCallback) => {
      emit = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    getSessionMock.mockResolvedValue({
      data: { session: buildSession("token-1") },
    });
  });

  it("preserva a identidade do usuário quando a aba recupera o foco", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("user-a"),
    );

    // O Supabase reemite a mesma sessão em um objeto novo ao voltar o foco.
    act(() => emit("SIGNED_IN", buildSession("token-1")));
    act(() => emit("TOKEN_REFRESHED", buildSession("token-1")));

    expect(screen.getByTestId("identidades")).toHaveTextContent("1");
  });

  it("propaga a sessão quando o token realmente é renovado", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("user-a"),
    );

    act(() => emit("TOKEN_REFRESHED", buildSession("token-2")));

    expect(screen.getByTestId("identidades")).toHaveTextContent("2");
  });

  it("limpa a sessão ao sair", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("user-a"),
    );

    act(() => emit("SIGNED_OUT", null));

    expect(screen.getByTestId("user")).toHaveTextContent("anonimo");
  });
});
