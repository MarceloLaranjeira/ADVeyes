import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock },
}));

import { activitiesService } from "@/services/activities";
import type { Activity } from "@/types/activities";

const activity: Activity = {
  id: "task-1",
  tenant_id: "tenant-1",
  user_id: "user-1",
  titulo: "Protocolar manifestação",
  descricao: null,
  prioridade: "alta",
  status: "pendente",
  data_limite: "2026-08-09",
  processo_id: null,
  responsavel_id: "user-1",
  concluida_em: null,
  categoria: "Prazo",
  pontos: 5,
  updated_at: "2026-08-08T12:00:00Z",
  created_at: "2026-08-08T12:00:00Z",
  google_event_id: null,
  assignee: null,
  estimated_hours: null,
  tags: null,
  source_id: null,
  source_type: null,
};

describe("activitiesService", () => {
  beforeEach(() => fromMock.mockReset());

  it("lista apenas o tenant e combina o estado individual do usuário", async () => {
    const taskOrder = vi.fn().mockResolvedValue({ data: [activity], error: null });
    const taskTenant = vi.fn().mockReturnValue({ order: taskOrder });
    const stateUser = vi.fn().mockResolvedValue({
      data: [{
        tenant_id: "tenant-1",
        tarefa_id: "task-1",
        user_id: "user-1",
        favorita: true,
        lida_em: null,
        updated_at: "2026-08-08T12:00:00Z",
      }],
      error: null,
    });
    const stateTenant = vi.fn().mockReturnValue({ eq: stateUser });

    fromMock
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: taskTenant }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: stateTenant }) });

    const result = await activitiesService.list("tenant-1", "user-1");

    expect(taskTenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(stateUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(result[0].userState?.favorita).toBe(true);
  });

  it("carrega o contexto do processo em consulta separada e restrita ao tenant", async () => {
    const linkedActivity = { ...activity, processo_id: "process-1" };
    const taskOrder = vi.fn().mockResolvedValue({ data: [linkedActivity], error: null });
    const taskTenant = vi.fn().mockReturnValue({ order: taskOrder });
    const stateUser = vi.fn().mockResolvedValue({ data: [], error: null });
    const stateTenant = vi.fn().mockReturnValue({ eq: stateUser });
    const processIds = vi.fn().mockResolvedValue({
      data: [{ id: "process-1", numero: "0001234-56.2026.8.04.0001", cliente_id: "client-1", cliente_nome: "Cliente Exemplo" }],
      error: null,
    });
    const processTenant = vi.fn().mockReturnValue({ in: processIds });

    fromMock
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: taskTenant }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: stateTenant }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: processTenant }) });

    const result = await activitiesService.list("tenant-1", "user-1");

    expect(processTenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(processIds).toHaveBeenCalledWith("id", ["process-1"]);
    expect(result[0].process).toEqual(expect.objectContaining({
      id: "process-1",
      number: "0001234-56.2026.8.04.0001",
      clientName: "Cliente Exemplo",
    }));
  });

  it("sempre restringe atualização e exclusão ao tenant selecionado", async () => {
    const updateId = vi.fn().mockResolvedValue({ error: null });
    const updateTenant = vi.fn().mockReturnValue({ eq: updateId });
    const deleteId = vi.fn().mockResolvedValue({ error: null });
    const deleteTenant = vi.fn().mockReturnValue({ eq: deleteId });

    fromMock
      .mockReturnValueOnce({ update: vi.fn().mockReturnValue({ eq: updateTenant }) })
      .mockReturnValueOnce({ delete: vi.fn().mockReturnValue({ eq: deleteTenant }) });

    await activitiesService.update("tenant-1", "task-1", { status: "concluída" });
    await activitiesService.remove("tenant-1", "task-1");

    expect(updateTenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(updateId).toHaveBeenCalledWith("id", "task-1");
    expect(deleteTenant).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(deleteId).toHaveBeenCalledWith("id", "task-1");
  });

  it("persiste favorito e leitura com a chave composta individual", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert });

    await activitiesService.setUserState({
      tenant_id: "tenant-1",
      tarefa_id: "task-1",
      user_id: "user-1",
      favorita: true,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ favorita: true, user_id: "user-1" }),
      { onConflict: "tenant_id,tarefa_id,user_id" },
    );
  });

  it("separa sucessos e falhas em operações em lote", async () => {
    const updateId = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "acesso negado" } });
    const updateTenant = vi.fn().mockReturnValue({ eq: updateId });
    fromMock.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: updateTenant }) });

    const result = await activitiesService.bulk("tenant-1", "user-1", {
      ids: ["task-1", "task-2"],
      update: { prioridade: "alta" },
    });

    expect(result.succeeded).toEqual(["task-1"]);
    expect(result.failed).toEqual([{ id: "task-2", message: "acesso negado" }]);
  });
});
