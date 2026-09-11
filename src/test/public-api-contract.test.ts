import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  eventTypeForChange,
  mapApiInput,
  mapApiOutput,
  normalizePageSize,
  parsePublicApiPath,
  PublicApiContractError,
  requireScope,
  resolveRequestTenant,
} from "../../supabase/functions/_shared/public-api-contract";

describe("public API contract", () => {
  it("parses proxied and direct function routes", () => {
    expect(parsePublicApiPath("/api/v1/contacts/abc")).toEqual({ resource: "contacts", id: "abc" });
    expect(parsePublicApiPath("/public-api/api/v1/tasks")).toEqual({ resource: "tasks", id: null });
    expect(parsePublicApiPath("/api/v1/unknown")).toBeNull();
  });

  it("round-trips opaque cursors and rejects malformed cursors", () => {
    const cursor = { created_at: "2026-08-31T00:00:00.000Z", id: "550e8400-e29b-41d4-a716-446655440000" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(() => decodeCursor("not-json")).toThrowError(PublicApiContractError);
  });

  it("limits page sizes", () => {
    expect(normalizePageSize(null)).toBe(50);
    expect(normalizePageSize("100")).toBe(100);
    expect(() => normalizePageSize("101")).toThrowError(PublicApiContractError);
  });

  it("maps only documented fields and blocks tenant injection", () => {
    expect(mapApiInput("contacts", { name: "Ada", phone: "92999999999" }, "create"))
      .toEqual({ nome: "Ada", telefone: "92999999999" });
    expect(() => mapApiInput("contacts", { name: "Ada", tenant_id: "other" }, "create"))
      .toThrowError(PublicApiContractError);
    expect(() => mapApiInput("processes", { status: "Ativo" }, "create"))
      .toThrowError(PublicApiContractError);
  });

  it("maps database fields to a stable external schema", () => {
    expect(mapApiOutput("tasks", {
      id: "1",
      titulo: "Protocolar",
      status: "pendente",
      tenant_id: "secret",
    })).toMatchObject({ id: "1", title: "Protocolar", status: "pendente" });
    expect(mapApiOutput("tasks", { id: "1" })).not.toHaveProperty("tenant_id");
  });

  it("enforces scopes", () => {
    expect(() => requireScope(["contacts:read"], "contacts:read")).not.toThrow();
    expect(() => requireScope(["contacts:read"], "contacts:write"))
      .toThrowError(PublicApiContractError);
  });

  it("emits distinct completion and soft-delete events", () => {
    expect(eventTypeForChange({ resource: "tasks", operation: "UPDATE", oldStatus: "pendente", newStatus: "concluída" }))
      .toBe("task.completed");
    expect(eventTypeForChange({ resource: "contacts", operation: "UPDATE", oldDeletedAt: null, newDeletedAt: "2026-08-31" }))
      .toBe("contact.deleted");
  });
});

describe("API pública — rota de escritórios", () => {
  it("reconhece a coleção de escritórios", () => {
    expect(parsePublicApiPath("/api/v1/tenants")).toEqual({ resource: "tenants", id: null });
  });

  it("não expõe um escritório individual pela rota de plataforma", () => {
    expect(parsePublicApiPath("/api/v1/tenants/00ca2f25-cc84-4721-b922-c63d75673cd2")).toBeNull();
  });
});

describe("API pública — escopo de escritório da credencial", () => {
  it("mantém a credencial de escritório presa ao seu próprio tenant", () => {
    expect(resolveRequestTenant({
      isPlatform: false,
      tokenTenantId: "tenant-a",
      headerTenantId: null,
      resource: "contacts",
    })).toBe("tenant-a");
  });

  it("recusa quando a credencial de escritório tenta apontar para outro tenant", () => {
    expect(() => resolveRequestTenant({
      isPlatform: false,
      tokenTenantId: "tenant-a",
      headerTenantId: "tenant-b",
      resource: "contacts",
    })).toThrowError(expect.objectContaining({ code: "tenant_not_allowed", status: 403 }));
  });

  it("aceita o próprio tenant repetido no cabeçalho", () => {
    expect(resolveRequestTenant({
      isPlatform: false,
      tokenTenantId: "tenant-a",
      headerTenantId: "tenant-a",
      resource: "contacts",
    })).toBe("tenant-a");
  });

  it("exige o cabeçalho de escritório na credencial de plataforma", () => {
    expect(() => resolveRequestTenant({
      isPlatform: true,
      tokenTenantId: null,
      headerTenantId: null,
      resource: "contacts",
    })).toThrowError(expect.objectContaining({ code: "tenant_header_required", status: 400 }));
  });

  it("usa o escritório indicado pela credencial de plataforma", () => {
    expect(resolveRequestTenant({
      isPlatform: true,
      tokenTenantId: null,
      headerTenantId: "tenant-b",
      resource: "contacts",
    })).toBe("tenant-b");
  });

  it("dispensa o cabeçalho para listar escritórios", () => {
    expect(resolveRequestTenant({
      isPlatform: true,
      tokenTenantId: null,
      headerTenantId: null,
      resource: "tenants",
    })).toBeNull();
  });

  it("recusa a rota de escritórios para credencial de escritório", () => {
    expect(() => resolveRequestTenant({
      isPlatform: false,
      tokenTenantId: "tenant-a",
      headerTenantId: null,
      resource: "tenants",
    })).toThrowError(expect.objectContaining({ code: "platform_token_required", status: 403 }));
  });
});
