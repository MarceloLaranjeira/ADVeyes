import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock },
}));

import { notificationsService } from "@/services/notifications";

/**
 * Query builder mínimo que registra a cadeia chamada pelo service.
 * `then` torna o objeto awaitable, como o PostgREST builder real.
 */
function builder(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "limit", "or", "update"]) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return chain;
    });
  }
  chain.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
    .then(resolve, reject);
  return { chain, calls };
}

const raw = {
  id: "n-1",
  tipo: "alerta",
  urgencia: "alta",
  titulo: "Prazo",
  mensagem: "Vence amanhã",
  processo_numero: null,
  created_at: "2026-09-20T10:00:00Z",
  lida: false,
  lida_em: null,
  arquivada_em: null,
  tenant_id: "tenant-1",
  user_id: "user-1",
};

describe("notificationsService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista somente a caixa do usuário e do tenant atual", async () => {
    const q = builder({ data: [raw] });
    fromMock.mockReturnValue(q.chain);

    const result = await notificationsService.list("user-1", "tenant-1");

    expect(fromMock).toHaveBeenCalledWith("notificacoes");
    expect(q.calls).toContainEqual(["eq", "user_id", "user-1"]);
    expect(q.calls).toContainEqual(["is", "arquivada_em", null]);
    expect(q.calls).toContainEqual([
      "or",
      "tenant_id.eq.tenant-1,tenant_id.is.null",
    ]);
    expect(q.calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(q.calls).toContainEqual(["limit", 50]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "n-1", tipo: "PRAZO_VENCENDO" });
  });

  it("sem tenant traz apenas o histórico sem vínculo", async () => {
    const q = builder({ data: [] });
    fromMock.mockReturnValue(q.chain);

    await notificationsService.list("user-1", null, 20);

    expect(q.calls).toContainEqual(["is", "tenant_id", null]);
    expect(q.calls).not.toContainEqual([
      "or",
      expect.stringContaining("tenant_id.eq"),
    ]);
    expect(q.calls).toContainEqual(["limit", 20]);
  });

  it("marca uma notificação como lida sem tocar na de outro usuário", async () => {
    const q = builder({});
    fromMock.mockReturnValue(q.chain);

    const before = Date.now();
    await notificationsService.marcarLida("n-1", "user-1", "tenant-1");
    const after = Date.now();

    const update = q.calls.find(([method]) => method === "update");
    expect(update?.[1]).toMatchObject({ lida: true });
    const lidaEm = (update?.[1] as { lida_em?: string }).lida_em;
    expect(lidaEm).toBeTruthy();
    const timestamp = Date.parse(lidaEm!);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
    expect(q.calls).toContainEqual(["eq", "id", "n-1"]);
    expect(q.calls).toContainEqual(["eq", "user_id", "user-1"]);
    expect(q.calls).toContainEqual(["is", "lida_em", null]);
    expect(q.calls).toContainEqual([
      "or",
      "tenant_id.eq.tenant-1,tenant_id.is.null",
    ]);
  });

  it("marca todas no recorte do tenant, em uma única atualização", async () => {
    const q = builder({});
    fromMock.mockReturnValue(q.chain);

    await notificationsService.marcarTodasLidas("user-1", "tenant-1");

    expect((q.chain.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect(q.calls).toContainEqual(["eq", "user_id", "user-1"]);
    expect(q.calls).toContainEqual([
      "or",
      "tenant_id.eq.tenant-1,tenant_id.is.null",
    ]);
    expect(q.calls).toContainEqual(["is", "arquivada_em", null]);
  });

  it("arquiva sem apagar a linha", async () => {
    const q = builder({});
    fromMock.mockReturnValue(q.chain);

    await notificationsService.arquivar("n-1", "user-1", "tenant-1");

    const update = q.calls.find(([method]) => method === "update");
    expect((update?.[1] as { arquivada_em?: string }).arquivada_em).toBeTruthy();
    expect(q.calls).toContainEqual(["eq", "id", "n-1"]);
    expect(q.calls).toContainEqual(["eq", "user_id", "user-1"]);
    expect(q.calls).toContainEqual([
      "or",
      "tenant_id.eq.tenant-1,tenant_id.is.null",
    ]);
  });

  it("propaga erro do Supabase em vez de fingir sucesso", async () => {
    const q = builder({ error: { message: "database unavailable" } });
    fromMock.mockReturnValue(q.chain);

    await expect(notificationsService.list("user-1", "tenant-1"))
      .rejects.toThrow("database unavailable");
  });
});
