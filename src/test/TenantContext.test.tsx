import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, invokeMock, rpcMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  invokeMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: (() => {
    const client = {
      functions: { invoke: invokeMock },
      rpc(this: unknown, ...args: unknown[]) {
        if (this !== client) {
          throw new Error("Supabase RPC perdeu o contexto do cliente");
        }
        return rpcMock(...args);
      },
    };

    return client;
  })(),
}));

import {
  TenantProvider,
  useTenant,
} from "@/contexts/TenantContext";

const membership = (slug: string, tenantId: string) => ({
  tenant_id: tenantId,
  slug,
  display_name: `Escritório ${slug}`,
  status: "active",
  membership_role: "owner",
  data_scope: "tenant",
  public_name: `Marca ${slug}`,
  short_name: slug,
  logo_light_path: null,
  logo_dark_path: null,
  favicon_path: null,
  icon_path: null,
  color_tokens: {},
});

function TenantProbe() {
  const {
    loading,
    memberships,
    currentTenant,
    error,
    selectTenant,
  } = useTenant();

  return (
    <div>
      <span>{loading ? "carregando" : "carregado"}</span>
      <span data-testid="count">{memberships.length}</span>
      <span data-testid="current">{currentTenant?.slug ?? "nenhum"}</span>
      <span data-testid="error">{error ?? "sem-erro"}</span>
      {memberships.map((item) => (
        <button key={item.tenantId} onClick={() => selectTenant(item)}>
          selecionar {item.slug}
        </button>
      ))}
    </div>
  );
}

const renderProvider = () =>
  render(
    <TenantProvider>
      <TenantProbe />
    </TenantProvider>,
  );

describe("TenantProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    invokeMock.mockResolvedValue({
      data: {
        hostname: "localhost",
        mode: "central",
        available: true,
        slug: null,
        branding: null,
      },
      error: null,
    });
  });

  it("carrega marca pública sem consultar memberships antes do login", async () => {
    useAuthMock.mockReturnValue({ user: null });

    renderProvider();

    await waitFor(() =>
      expect(screen.getByText("carregado")).toBeInTheDocument(),
    );
    expect(rpcMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("error")).toHaveTextContent("sem-erro");
  });

  it("seleciona automaticamente a única membership ativa", async () => {
    useAuthMock.mockReturnValue({ user: { id: "user-a" } });
    rpcMock.mockResolvedValue({
      data: [membership("albertino", "tenant-a")],
      error: null,
    });

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("current")).toHaveTextContent("albertino"),
    );
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("seleciona o primeiro tenant quando não existe preferência local", async () => {
    useAuthMock.mockReturnValue({ user: { id: "user-a" } });
    rpcMock.mockResolvedValue({
      data: [
        membership("albertino", "tenant-a"),
        membership("oliveira", "tenant-b"),
      ],
      error: null,
    });

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("2"),
    );
    expect(screen.getByTestId("current")).toHaveTextContent("albertino");

    fireEvent.click(screen.getByText("selecionar oliveira"));

    expect(screen.getByTestId("current")).toHaveTextContent("oliveira");
    expect(
      sessionStorage.getItem("adveyes:selected-tenant:user-a"),
    ).toBe("oliveira");
    expect(
      localStorage.getItem("adveyes:selected-tenant:user-a"),
    ).toBe("oliveira");
  });

  it("bloqueia a sessão quando a RPC autenticada falha", async () => {
    useAuthMock.mockReturnValue({ user: { id: "user-a" } });
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "tenant_load_failed",
      ),
    );
  });
});
