import { describe, expect, it } from "vitest";
import {
  roundRobinByTenant,
  selectFairLegalSources,
  type SchedulableSource,
} from "../../supabase/functions/_shared/legal-source-scheduling";

function source(
  id: string,
  tenantId: string,
  kind: "oab" | "process",
  minute: number,
): SchedulableSource {
  const timestamp = `2026-08-11T12:${String(minute).padStart(2, "0")}:00.000Z`;
  return {
    id,
    tenant_id: tenantId,
    source_kind: kind,
    next_sync_at: timestamp,
    created_at: timestamp,
  };
}

describe("legal source scheduling", () => {
  it("faz rodízio entre tenants sem perder a ordem de vencimento interna", () => {
    const ordered = roundRobinByTenant([
      source("a1", "tenant-a", "process", 1),
      source("a2", "tenant-a", "process", 2),
      source("a3", "tenant-a", "process", 3),
      source("b1", "tenant-b", "process", 1),
      source("b2", "tenant-b", "process", 2),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["a1", "b1", "a2", "b2", "a3"]);
  });

  it("reserva capacidade para OAB mesmo com fila de processos maior que o lote", () => {
    const processes = Array.from({ length: 60 }, (_, index) =>
      source(`p${index}`, `tenant-${index % 3}`, "process", index % 10)
    );
    const oabs = Array.from({ length: 20 }, (_, index) =>
      source(`o${index}`, `tenant-${index % 2}`, "oab", index % 10)
    );

    const selected = selectFairLegalSources(processes, oabs, 40);

    expect(selected).toHaveLength(40);
    expect(selected.filter((item) => item.source_kind === "oab")).toHaveLength(12);
    expect(new Set(selected.map((item) => item.tenant_id)).size).toBeGreaterThan(1);
    expect(selected.slice(0, 3).map((item) => item.source_kind)).toContain("oab");
  });

  it("cede a capacidade reservada quando não há OAB vencida", () => {
    const processes = Array.from({ length: 8 }, (_, index) =>
      source(`p${index}`, "tenant-a", "process", index)
    );
    expect(selectFairLegalSources(processes, [], 5)).toHaveLength(5);
  });
});
