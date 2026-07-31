import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    memberships: [{ tenantId: "tenant-a" }],
    currentTenant: { tenantId: "tenant-a" },
    loading: false,
    error: null,
    selectTenant: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={["/privado"]}>
      <Routes>
        <Route path="/login" element={<div>Página de login</div>} />
        <Route
          path="/privado"
          element={(
            <ProtectedRoute>
              <div>Conteúdo protegido</div>
            </ProtectedRoute>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("baseline de autenticação", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("redireciona uma sessão ausente para o login", () => {
    useAuthMock.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signOut: vi.fn(),
    });

    renderProtectedRoute();

    expect(screen.getByText("Página de login")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
  });

  it("mantém o conteúdo disponível para uma sessão válida", () => {
    useAuthMock.mockReturnValue({
      session: { access_token: "test-token" },
      user: { id: "user-a" },
      loading: false,
      signOut: vi.fn(),
    });

    renderProtectedRoute();

    expect(screen.getByText("Conteúdo protegido")).toBeInTheDocument();
  });

  it("não decide a rota enquanto a sessão está carregando", () => {
    useAuthMock.mockReturnValue({
      session: null,
      user: null,
      loading: true,
      signOut: vi.fn(),
    });

    const { container } = renderProtectedRoute();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Página de login")).not.toBeInTheDocument();
  });
});
