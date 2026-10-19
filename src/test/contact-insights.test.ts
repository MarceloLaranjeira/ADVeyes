import { describe, expect, it } from "vitest";
import { ageOf, summarizeContacts, type InsightContact } from "@/lib/contact-insights";

const NOW = new Date("2026-10-19T12:00:00Z");

const contact = (over: Partial<InsightContact>): InsightContact => ({
  id: "c1", nome: "Ana", created_at: "2026-10-02T00:00:00Z",
  data_nascimento: null, profissao: null, origem: null, ...over,
});

describe("ageOf", () => {
  it("considera o aniversário ainda não ocorrido", () => {
    expect(ageOf("1990-10-20", NOW)).toBe(35);
    expect(ageOf("1990-10-19", NOW)).toBe(36);
    expect(ageOf("lixo", NOW)).toBeNull();
    expect(ageOf("2099-01-01", NOW)).toBeNull();
  });
});

describe("summarizeContacts", () => {
  it("separa quem tem processo ativo, ignorando arquivados", () => {
    const result = summarizeContacts(
      [contact({ id: "a" }), contact({ id: "b" }), contact({ id: "c" })],
      [
        { cliente_id: "a", status: "Em andamento" },
        { cliente_id: "b", status: "arquivado" },
        { cliente_id: null, status: "Em andamento" },
      ],
      NOW,
    );
    expect(result).toMatchObject({ total: 3, withActiveProcess: 1, withoutActiveProcess: 2 });
  });

  it("calcula a variação do mês e trata mês anterior vazio", () => {
    const contacts = [
      contact({ id: "1", created_at: "2026-10-05T00:00:00Z" }),
      contact({ id: "2", created_at: "2026-10-06T00:00:00Z" }),
      contact({ id: "3", created_at: "2026-09-10T00:00:00Z" }),
    ];
    expect(summarizeContacts(contacts, [], NOW)).toMatchObject({ createdThisMonth: 2, monthChangePct: 100 });
    expect(summarizeContacts([contacts[0]], [], NOW).monthChangePct).toBeNull();
  });

  it("agrupa origens, profissões, faixas etárias e aniversariantes", () => {
    const result = summarizeContacts([
      contact({ id: "1", origem: "Indicação", profissao: "Médico", data_nascimento: "1990-10-25" }),
      contact({ id: "2", origem: "Indicação", profissao: "Médico", data_nascimento: "1960-03-01" }),
      contact({ id: "3", nome: "Bia", data_nascimento: "2005-10-02" }),
    ], [], NOW);
    expect(result.topOrigins[0]).toEqual({ name: "Indicação", value: 2 });
    expect(result.topOrigins[1]).toEqual({ name: "Não informado", value: 1 });
    expect(result.topProfessions).toEqual([{ name: "Médico", value: 2 }]);
    expect(result.ageBuckets.find((b) => b.name === "35 a 44")?.value).toBe(1);
    expect(result.ageBuckets.find((b) => b.name === "Até 24")?.value).toBe(1);
    expect(result.birthdaysThisMonth.map((b) => b.nome)).toEqual(["Bia", "Ana"]);
  });
});
