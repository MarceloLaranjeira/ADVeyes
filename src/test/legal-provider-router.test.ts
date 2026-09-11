import { describe, expect, it } from "vitest";
import {
  legalProviderAvailabilityFromEnvironment,
  selectLegalProviders,
} from "../../supabase/functions/_shared/legal-provider-router";

const none = {
  datajud: false,
  djen: false,
  judit: false,
  trackjud: false,
  escavador: false,
  conecta: false,
};

describe("roteamento econômico de provedores jurídicos", () => {
  it("prioriza JUDIT e TrackJud antes do Escavador no enriquecimento", () => {
    expect(selectLegalProviders("process_enrichment", {
      ...none, judit: true, trackjud: true, escavador: true,
    })).toEqual(["judit", "trackjud", "escavador"]);
  });

  it("mantém DataJud e DJEN como fontes oficiais gratuitas", () => {
    expect(selectLegalProviders("official_process_lookup", { ...none, datajud: true }))
      .toEqual(["datajud"]);
    expect(selectLegalProviders("official_publications", { ...none, djen: true }))
      .toEqual(["djen"]);
  });

  it("não ativa Conecta sem endpoint e credencial institucionais", () => {
    const values: Record<string, string> = { CNJ_CONECTA_API_TOKEN: "token" };
    const available = legalProviderAvailabilityFromEnvironment((name) => values[name]);
    expect(available.conecta).toBe(false);
    expect(selectLegalProviders("judiciary_ai", available)).toEqual([]);
  });
});
