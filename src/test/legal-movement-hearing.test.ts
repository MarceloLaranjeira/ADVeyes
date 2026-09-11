import { describe, expect, it } from "vitest";
import { buildMovementHearingRecords } from "../../supabase/functions/_shared/legal-movement-hearing.ts";

const process = {
  id: "process-1",
  numero: "0800123-45.2023.8.04.0001",
  cliente_nome: "Cliente",
  user_id: "user-1",
  vara: "2ª Vara",
};

describe("buildMovementHearingRecords", () => {
  it("cria candidato vinculado quando há data e hora comprovadas", () => {
    const result = buildMovementHearingRecords({
      tenantId: "tenant-1",
      process,
      movement: {
        id: "movement-1",
        external_id: "26:2026-09-01",
        provider: "datajud",
        title: "Audiência de conciliação",
        content: "Designada para 10/09/2026 às 09:30.",
        description: null,
        notes: null,
        occurred_at: "2026-09-01T10:00:00Z",
        source_name: "DataJud/CNJ — TJAM",
      },
    });

    expect(result?.signalRow).toMatchObject({
      external_id: "movimento:movement-1",
      signal_kind: "scheduled",
    });
    expect(result?.hearingRow).toMatchObject({
      external_id: "movimento:movement-1",
      data_hora: "2026-09-10T13:30:00.000Z",
      review_status: "pending",
    });
  });

  it("registra indício sem transformar a data do movimento em audiência", () => {
    const result = buildMovementHearingRecords({
      tenantId: "tenant-1",
      process,
      movement: {
        id: "movement-2",
        external_id: "26:2026-09-01",
        provider: "datajud",
        title: "Audiência será oportunamente marcada",
        content: null,
        description: null,
        notes: null,
        occurred_at: "2026-09-01T10:00:00Z",
        source_name: "DataJud/CNJ — TJAM",
      },
    });

    expect(result?.signalRow).toMatchObject({
      signal_kind: "review",
      starts_at: null,
    });
    expect(result?.hearingRow).toBeNull();
  });
});
