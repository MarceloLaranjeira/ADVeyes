import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

import { crmService } from "@/services/crm";
import type { CRMLeadInput } from "@/types/crm";

const leadInput: CRMLeadInput = {
  nome: "Maria Silva",
  email: "maria@example.com",
  telefone: "5592999999999",
  origem: "indicacao",
  area_interesse: "Cível",
  descricao: "Consulta inicial",
  status: "novo",
  prioridade: "media",
  valor_estimado: 1200,
  data_contato: "2026-10-18",
  proximo_contato: null,
  observacoes: null,
};

describe("crmService", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("lista somente os leads do escritório ativo", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const tenant = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: tenant }) });

    await crmService.list("tenant-1");

    expect(tenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
  });

  it("grava o escritório e o autor ao criar um lead", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await crmService.create("tenant-1", "user-1", leadInput);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "tenant-1", user_id: "user-1" }));
  });

  it("restringe alterações ao escritório e ao lead selecionados", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "lead-1" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const id = vi.fn().mockReturnValue({ select });
    const tenant = vi.fn().mockReturnValue({ eq: id });
    fromMock.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: tenant }) });

    await crmService.update("tenant-1", "lead-1", { status: "perdido" });

    expect(tenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(id).toHaveBeenCalledWith("id", "lead-1");
  });

  it("converte pelo RPC transacional no mesmo escritório", async () => {
    rpcMock.mockResolvedValue({ data: "client-1", error: null });

    await expect(crmService.convert("tenant-1", "lead-1")).resolves.toBe("client-1");

    expect(rpcMock).toHaveBeenCalledWith("convert_lead_to_client", {
      p_tenant_id: "tenant-1",
      p_lead_id: "lead-1",
    });
  });
});
