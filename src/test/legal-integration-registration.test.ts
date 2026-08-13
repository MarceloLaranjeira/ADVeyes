import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import { legalIntegrationService } from "@/services/legal-integration";

describe("legalIntegrationService.register", () => {
  beforeEach(() => invokeMock.mockReset());

  it("salva a inscrição e adia a descoberta para não prender o onboarding", async () => {
    invokeMock.mockResolvedValue({
      data: {
        registrationId: "registration-1",
        registrationSaved: true,
        discoveryPending: true,
        totalCandidates: 0,
      },
      error: null,
    });

    const result = await legalIntegrationService.register({
      tenantId: "tenant-1",
      professionalId: "professional-1",
      oabNumber: "5055",
      oabState: "AM",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "legal-discover-lawyer-processes",
      {
        body: {
          tenantId: "tenant-1",
          professionalId: "professional-1",
          oabNumber: "5055",
          oabState: "AM",
          action: "register",
          deferDiscovery: true,
        },
      },
    );
    expect(result).toMatchObject({
      registrationSaved: true,
      discoveryPending: true,
    });
  });

  it("envia edição e exclusão para operações explícitas do servidor", async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });

    await legalIntegrationService.updateRegistration({
      tenantId: "tenant-1",
      registrationId: "registration-1",
      professionalId: "professional-1",
      oabNumber: "14788",
      oabState: "AM",
    });
    await legalIntegrationService.disableRegistration("tenant-1", "registration-1");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "legal-discover-lawyer-processes", {
      body: {
        tenantId: "tenant-1",
        registrationId: "registration-1",
        professionalId: "professional-1",
        oabNumber: "14788",
        oabState: "AM",
        action: "update",
      },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "legal-discover-lawyer-processes", {
      body: {
        action: "disable",
        tenantId: "tenant-1",
        registrationId: "registration-1",
      },
    });
  });
});
