import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  useAuthMock,
  useTenantMock,
  getSubscriptionMock,
  channelMock,
  removeChannelMock,
} = vi.hoisted(() => {
  const subscribe = vi.fn(() => ({ id: "subscription-channel" }));
  const on = vi.fn(() => ({ subscribe }));
  return {
    useAuthMock: vi.fn(),
    useTenantMock: vi.fn(),
    getSubscriptionMock: vi.fn(),
    channelMock: vi.fn(() => ({ on })),
    removeChannelMock: vi.fn(),
  };
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: useAuthMock }));
vi.mock("@/contexts/TenantContext", () => ({ useTenant: useTenantMock }));
vi.mock("@/lib/asaas", () => ({
  asaas: { getSubscription: getSubscriptionMock },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: channelMock,
    removeChannel: removeChannelMock,
  },
}));

import {
  SubscriptionProvider,
  useSubscription,
} from "@/contexts/SubscriptionContext";

function SubscriptionProbe() {
  const { loading, plan, status } = useSubscription();
  return (
    <div>
      <span>{loading ? "carregando" : "carregado"}</span>
      <span>{plan}</span>
      <span>{status}</span>
    </div>
  );
}

describe("assinatura compartilhada por escritório", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { id: "user-a" } });
    useTenantMock.mockReturnValue({
      currentTenant: { tenantId: "tenant-a", role: "owner" },
      loading: false,
    });
    getSubscriptionMock.mockResolvedValue({
      canManage: true,
      subscription: {
        id: "subscription-a",
        tenant_id: "tenant-a",
        status: "active",
        billing_cycle: "monthly",
        trial_ends_at: null,
        next_due_date: "2026-08-30",
        billing_plans: {
          code: "profissional",
          name: "Profissional",
          version: 1,
          entitlements: {},
          features: [],
        },
      },
    });
  });

  it("consulta a assinatura vinculada ao escritório atual", async () => {
    render(
      <SubscriptionProvider>
        <SubscriptionProbe />
      </SubscriptionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("carregado")).toBeInTheDocument()
    );
    expect(getSubscriptionMock).toHaveBeenCalledWith("tenant-a");
    expect(screen.getByText("profissional")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("recarrega a assinatura do mesmo escritório", async () => {
    function RefreshProbe() {
      const { loading, refresh } = useSubscription();
      return (
        <button disabled={loading} onClick={() => void refresh()}>
          atualizar
        </button>
      );
    }

    render(
      <SubscriptionProvider>
        <RefreshProbe />
      </SubscriptionProvider>,
    );
    const button = await screen.findByRole("button", { name: "atualizar" });
    await waitFor(() => expect(button).not.toBeDisabled());
    await act(async () => button.click());
    expect(getSubscriptionMock).toHaveBeenNthCalledWith(1, "tenant-a");
    expect(getSubscriptionMock).toHaveBeenNthCalledWith(2, "tenant-a");
  });
});
