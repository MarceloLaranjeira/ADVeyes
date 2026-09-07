import { describe, expect, it, vi } from "vitest";
import {
  ContactEnrichmentError,
  fetchPublicContactEnrichment,
  isValidCnpj,
  normalizeCnpj,
  parseBrasilApiContact,
  parseOpenCnpjContact,
} from "../../supabase/functions/_shared/contact-enrichment.ts";

describe("CNPJ", () => {
  it("normaliza e valida CNPJ numérico", () => {
    expect(normalizeCnpj("19.131.243/0001-97")).toBe("19131243000197");
    expect(isValidCnpj("19.131.243/0001-97")).toBe(true);
    expect(isValidCnpj("19.131.243/0001-98")).toBe(false);
  });

  it("aceita CNPJ alfanumérico com dígitos verificadores válidos", () => {
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
  });

  it("rejeita CPF, documento mascarado e sequências repetidas", () => {
    expect(isValidCnpj("123.456.789-09")).toBe(false);
    expect(isValidCnpj("**.***.***/****-**")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });
});

describe("normalização dos provedores", () => {
  it("normaliza telefone, e-mail e endereço da BrasilAPI", () => {
    const result = parseBrasilApiContact({
      cnpj: "19131243000197",
      ddd_telefone_1: "1123851939",
      email: " CONTATO@EXEMPLO.COM ",
      tipo_logradouro: "AVENIDA",
      logradouro: "PAULISTA",
      numero: "37",
      bairro: "BELA VISTA",
      municipio: "SAO PAULO",
      uf: "SP",
      cep: "01311902",
      razao_social: "OPEN KNOWLEDGE BRASIL",
    }, "19131243000197", "2026-09-01T12:00:00.000Z");

    expect(result.phone).toBe("+551123851939");
    expect(result.email).toBe("contato@exemplo.com");
    expect(result.address).toContain("AVENIDA PAULISTA 37");
  });

  it("normaliza telefone não-fax do OpenCNPJ", () => {
    const result = parseOpenCnpjContact({
      cnpj: "19131243000197",
      email: "empresa@example.com",
      telefones: [
        { ddd: "11", numero: "11112222", is_fax: true },
        { ddd: "11", numero: "999998888", is_fax: false },
      ],
      logradouro: "PAULISTA",
      numero: "37",
      municipio: "SAO PAULO",
      uf: "SP",
    }, "19131243000197");

    expect(result.phone).toBe("+5511999998888");
    expect(result.provider).toBe("opencnpj");
  });

  it("rejeita resposta de outro CNPJ", () => {
    expect(() => parseBrasilApiContact(
      { cnpj: "11222333000181" },
      "19131243000197",
    )).toThrowError(ContactEnrichmentError);
  });
});

describe("fallback público", () => {
  it("usa OpenCNPJ quando a BrasilAPI não encontra o cadastro", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        cnpj: "19131243000197",
        email: "fallback@example.com",
        telefones: [],
      }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await fetchPublicContactEnrichment("19131243000197", fetcher);
    expect(result.provider).toBe("opencnpj");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("não consulta rede para documento inválido", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(fetchPublicContactEnrichment("123", fetcher)).rejects.toMatchObject({
      code: "invalid_cnpj",
      retryable: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
