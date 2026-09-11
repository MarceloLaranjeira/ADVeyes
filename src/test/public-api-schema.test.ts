import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260831044840_public_api_foundation.sql"),
  "utf8",
);

describe("public API schema", () => {
  it("creates every internal API table with RLS", () => {
    for (const table of [
      "api_tokens",
      "api_idempotency_keys",
      "api_request_logs",
      "domain_events",
      "webhook_endpoints",
      "webhook_deliveries",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("revokes browser access and adds soft delete to all public resources", () => {
    expect(migration).toContain("revoke all on table");
    for (const table of ["clientes", "processos", "tarefas"]) {
      expect(migration).toContain(`alter table public.${table}`);
      expect(migration).toContain("add column if not exists deleted_at timestamptz");
    }
  });

  it("installs domain event triggers", () => {
    expect(migration).toContain("create or replace function private.emit_public_api_event()");
    expect(migration).toContain("clientes_public_api_events");
    expect(migration).toContain("processos_public_api_events");
    expect(migration).toContain("tarefas_public_api_events");
  });
});
