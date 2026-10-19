import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import { platformAdmin } from "@/services/platform-admin";

describe("platformAdmin.promotePartner", () => {
  beforeEach(() => invokeMock.mockReset());

  it("mostra o detalhe seguro devolvido pela Edge Function", async () => {
    const error = new Error("Edge Function returned a non-2xx status code");
    (error as Error & { context?: Response }).context = new Response(
      JSON.stringify({
        error: "partner_plan_unavailable",
        detail: "O Plano Parceiro não está disponível na base publicada.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
    invokeMock.mockResolvedValue({ data: null, error });

    await expect(platformAdmin.promotePartner("tenant-1")).rejects.toThrow(
      "O Plano Parceiro não está disponível na base publicada.",
    );
    expect(invokeMock).toHaveBeenCalledWith("platform-admin", {
      body: { action: "promote_partner", tenantId: "tenant-1" },
    });
  });
});
