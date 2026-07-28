import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  useAuthMock,
  fromMock,
  channelMock,
  removeChannelMock,
  maybeSingleMock,
  eqMock,
} = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const subscribe = vi.fn(() => ({ id: "subscription-channel" }));
  const on = vi.fn(() => ({ subscribe }));
  const channel = vi.fn(() => ({ on }));

  return {
    useAuthMock: vi.fn(),
    fromMock: from,
    channelMock: channel,
    removeChannelMock: vi.fn(),
    maybeSingleMock: maybeSingle,
    eqMock: eq,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
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

describe("baseline de assinatura por usuário", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: { id: "user-a" },
    });
  });

  it("consulta somente a assinatura vinculada ao usuário autenticado", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "subscription-a",
        user_id: "user-a",
        plan: "profissional",
        status: "active",
        trial_ends_at: null,
      },
    });

    render(
      <SubscriptionProvider>
        <SubscriptionProbe />
      </SubscriptionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("carregado")).toBeInTheDocument();
    });

    expect(fromMock).toHaveBeenCalledWith("asaas_subscriptions");
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-a");
    expect(screen.getByText("profissional")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("recarrega a mesma assinatura sem trocar o proprietário", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "subscription-a",
        user_id: "user-a",
        plan: "starter",
        status: "active",
        trial_ends_at: null,
      },
    });

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

    await act(async () => {
      button.click();
    });

    expect(eqMock).toHaveBeenNthCalledWith(1, "user_id", "user-a");
    expect(eqMock).toHaveBeenNthCalledWith(2, "user_id", "user-a");
  });
});
