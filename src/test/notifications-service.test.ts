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
  for (const method of [
    "select",
    "eq",
    "is",
    "order",
    "limit",
    "range",
    "or",
    "update",
  ]) {
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
    const unread = builder({ data: [raw] });
    const recent = builder({ data: [raw] });
    fromMock
      .mockReturnValueOnce(unread.chain)
      .mockReturnValueOnce(recent.chain);

    const result = await notificationsService.list("user-1", "tenant-1");

    expect(fromMock).toHaveBeenCalledTimes(2);
    for (const query of [unread, recent]) {
      expect(query.calls).toContainEqual(["eq", "user_id", "user-1"]);
      expect(query.calls).toContainEqual(["is", "arquivada_em", null]);
      expect(query.calls).toContainEqual([
        "or",
        "tenant_id.eq.tenant-1,tenant_id.is.null",
      ]);
      expect(query.calls).toContainEqual([
        "order",
        "created_at",
        { ascending: false },
      ]);
    }
    expect(unread.calls).toContainEqual(["eq", "lida", false]);
    expect(unread.calls).toContainEqual(["range", 0, 499]);
    expect(recent.calls).toContainEqual(["limit", 50]);
    // A mesma linha veio nas duas consultas e foi deduplicada.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "n-1", tipo: "PRAZO_VENCENDO" });
  });

  it("sem tenant traz apenas o histórico sem vínculo", async () => {
    const unread = builder({ data: [] });
    const recent = builder({ data: [] });
    fromMock
      .mockReturnValueOnce(unread.chain)
      .mockReturnValueOnce(recent.chain);

    await notificationsService.list("user-1", null, 20);

    for (const query of [unread, recent]) {
      expect(query.calls).toContainEqual(["is", "tenant_id", null]);
      expect(query.calls).not.toContainEqual([
        "or",
        expect.stringContaining("tenant_id.eq"),
      ]);
    }
    expect(recent.calls).toContainEqual(["limit", 20]);
  });

  it("não esconde não lida antiga fora das 50 recentes", async () => {
    const antiga = {
      ...raw,
      id: "n-antiga",
      created_at: "2026-01-01T10:00:00Z",
      lida: false,
    };
    const lidaRecente = {
      ...raw,
      id: "n-recente",
      created_at: "2026-09-20T10:00:00Z",
      lida: true,
      lida_em: "2026-09-20T10:01:00Z",
    };
    const unread = builder({ data: [antiga] });
    const recent = builder({ data: [lidaRecente] });
    fromMock
      .mockReturnValueOnce(unread.chain)
      .mockReturnValueOnce(recent.chain);

    const result = await notificationsService.list("user-1", "tenant-1");

    expect(result.map((item) => item.id)).toEqual(["n-recente", "n-antiga"]);
    expect(result.find((item) => item.id === "n-antiga")?.lida).toBe(false);
  });

  it("pagina além do teto de 500 até carregar todas as não lidas", async () => {
    const primeiraPagina = Array.from({ length: 500 }, (_, index) => ({
      ...raw,
      id: `unread-${index}`,
      created_at: `2026-08-${String((index % 28) + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    const ultimaPagina = [{
      ...raw,
      id: "unread-500",
      created_at: "2026-07-01T10:00:00Z",
    }];
    const unread1 = builder({ data: primeiraPagina });
    const recent = builder({ data: [] });
    const unread2 = builder({ data: ultimaPagina });
    fromMock
      .mockReturnValueOnce(unread1.chain)
      .mockReturnValueOnce(recent.chain)
      .mockReturnValueOnce(unread2.chain);

    const result = await notificationsService.list("user-1", "tenant-1");

    expect(unread1.calls).toContainEqual(["range", 0, 499]);
    expect(unread2.calls).toContainEqual(["range", 500, 999]);
    expect(result).toHaveLength(501);
    expect(result.some((item) => item.id === "unread-500")).toBe(true);
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
    expect(q.calls).toContainEqual(["is", "arquivada_em", null]);
    expect(q.calls).toContainEqual([
      "or",
      "tenant_id.eq.tenant-1,tenant_id.is.null",
    ]);
  });

  it("propaga erro do Supabase em vez de fingir sucesso", async () => {
    const unread = builder({ error: { message: "database unavailable" } });
    const recent = builder({ data: [] });
    fromMock
      .mockReturnValueOnce(unread.chain)
      .mockReturnValueOnce(recent.chain);

    await expect(notificationsService.list("user-1", "tenant-1"))
      .rejects.toThrow("database unavailable");
  });
});
