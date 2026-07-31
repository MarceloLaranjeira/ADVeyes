import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { googleCalendar } from "@/lib/google-calendar";

describe("googleCalendar", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/configuracoes");
    vi.useRealTimers();
  });

  it("stores the connected status returned by the backend", async () => {
    invokeMock.mockResolvedValue({
      data: {
        connected: true,
        connection: {
          google_email: "cliente@example.com",
          status: "connected",
          connected_at: "2026-07-27T00:00:00.000Z",
          last_sync_at: null,
          last_error_code: null,
          last_error_at: null,
        },
        queue: { pending: 0, processing: 0, retry: 0, failed: 0 },
      },
      error: null,
    });

    const status = await googleCalendar.getStatus();

    expect(status.connected).toBe(true);
    expect(googleCalendar.isConnected()).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("google-calendar", {
      body: { action: "status" },
    });
  });

  it("handles and removes the OAuth callback result from the URL", () => {
    window.history.replaceState(
      {},
      "",
      "/configuracoes?google_calendar=connected",
    );

    expect(googleCalendar.handleOAuthResult()).toEqual({
      connected: true,
      errorCode: undefined,
    });
    expect(window.location.search).toBe("");
    expect(googleCalendar.isConnected()).toBe(true);
  });

  it("debounces immediate sync requests", async () => {
    vi.useFakeTimers();
    sessionStorage.setItem("adveyes_google_calendar_status", "connected");
    invokeMock.mockResolvedValue({
      data: { queued: 1, claimed: 1, completed: 1, retried: 0, failed: 0 },
      error: null,
    });

    googleCalendar.requestSync();
    googleCalendar.requestSync();
    await vi.advanceTimersByTimeAsync(800);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("google-calendar", {
      body: { action: "sync" },
    });
  });

  it("clears the cached connection after disconnecting", async () => {
    sessionStorage.setItem("adveyes_google_calendar_status", "connected");
    invokeMock.mockResolvedValue({
      data: { removedFromGoogle: 2, failedRemovals: 0 },
      error: null,
    });

    const result = await googleCalendar.disconnect(true);

    expect(result.removedFromGoogle).toBe(2);
    expect(googleCalendar.isConnected()).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith("google-calendar", {
      body: { action: "disconnect", removeEvents: true },
    });
  });
});
