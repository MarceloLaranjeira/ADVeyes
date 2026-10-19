import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: fromMock } }));

import { financeService } from "@/services/finance";

describe("financeService", () => {
  beforeEach(() => fromMock.mockReset());

  it("lista cada domínio financeiro no escritório ativo", async () => {
    const financialOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const financialTenant = vi.fn().mockReturnValue({ order: financialOrder });
    const expenseOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const expenseTenant = vi.fn().mockReturnValue({ order: expenseOrder });
    const goalOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const goalYear = vi.fn().mockReturnValue({ order: goalOrder });
    const goalTenant = vi.fn().mockReturnValue({ order: goalYear });
    fromMock.mockImplementation((table: string) => ({ select: vi.fn().mockReturnValue({ eq: table === "financeiro" ? financialTenant : table === "despesas_escritorio" ? expenseTenant : goalTenant }) }));

    await financeService.list("tenant-1");

    expect(financialTenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(expenseTenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(goalTenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
  });

  it("grava lançamento com tenant e autor", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await financeService.createEntry("tenant-1", "user-1", { tipo: "honorario", descricao: "Contrato", valor: 1500, data_vencimento: "2026-10-20", status: "pendente" });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "tenant-1", user_id: "user-1" }));
  });

  it("restringe baixa e exclusão ao lançamento do escritório", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "entry-1" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const id = vi.fn().mockReturnValue({ select });
    const tenant = vi.fn().mockReturnValue({ eq: id });
    fromMock.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: tenant }), delete: vi.fn().mockReturnValue({ eq: tenant }) });

    await financeService.markEntryPaid("tenant-1", "entry-1");
    await financeService.removeEntry("tenant-1", "entry-1");

    expect(tenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(id).toHaveBeenCalledWith("id", "entry-1");
  });
});
