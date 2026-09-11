import { describe, expect, it } from "vitest";
import {
  djenCertificateUrl,
  djenLawyers,
  djenParties,
  isDjenIntimation,
} from "@/lib/djen-publication";

describe("DJEN publication helpers", () => {
  it("separa intimação de outros tipos de comunicação", () => {
    expect(isDjenIntimation("Intimação")).toBe(true);
    expect(isDjenIntimation("INTIMACAO")).toBe(true);
    expect(isDjenIntimation("Lista de distribuição")).toBe(false);
  });

  it("monta o endereço oficial da certidão sem interpolação insegura", () => {
    expect(djenCertificateUrl("abc/123")).toBe(
      "https://comunicaapi.pje.jus.br/api/v1/comunicacao/abc%2F123/certidao",
    );
  });

  it("normaliza destinatários e advogados do contrato oficial", () => {
    expect(djenParties([{ nome: "Maria", polo: "A" }])).toEqual([
      { name: "Maria", side: "Polo ativo" },
    ]);
    expect(djenLawyers([{
      advogado: { nome: "Dra. Ana", numero_oab: "123", uf_oab: "am" },
    }])).toEqual([{ name: "Dra. Ana", registration: "OAB 123/AM" }]);
  });
});
