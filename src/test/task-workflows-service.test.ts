import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

import { taskWorkflowsService } from "@/services/task-workflows";

describe("taskWorkflowsService", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("lista tipos somente do escritório ativo", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const tenant = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: tenant }) });

    await taskWorkflowsService.listTypes("tenant-1");

    expect(tenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
  });

  it("grava tenant e autor ao criar um tipo", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await taskWorkflowsService.createType("tenant-1", "user-1", { nome: "Petição", categoria: "Jurídico", pontos: 3, prazo_padrao_dias: 2 });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "tenant-1", created_by: "user-1" }));
  });

  it("cria workflow por RPC com etapas normalizadas", async () => {
    rpcMock.mockResolvedValue({ data: "workflow-1", error: null });

    await expect(taskWorkflowsService.createWorkflow("tenant-1", "Abertura", null, [{ tipoTarefaId: "type-1", prazoOffsetDias: 2 }])).resolves.toBe("workflow-1");

    expect(rpcMock).toHaveBeenCalledWith("create_task_workflow", expect.objectContaining({
      p_tenant_id: "tenant-1",
      p_etapas: [{ tipo_tarefa_id: "type-1", prazo_offset_dias: 2 }],
    }));
  });

  it("aplica workflow no mesmo escritório", async () => {
    rpcMock.mockResolvedValue({ data: 2, error: null });

    await expect(taskWorkflowsService.apply("tenant-1", "workflow-1", "process-1", "user-2", "2026-10-18")).resolves.toBe(2);

    expect(rpcMock).toHaveBeenCalledWith("apply_task_workflow", {
      p_tenant_id: "tenant-1",
      p_workflow_id: "workflow-1",
      p_processo_id: "process-1",
      p_responsavel_id: "user-2",
      p_inicio: "2026-10-18",
    });
  });
});
