import { describe, expect, it } from "vitest";
import {
  advboxDate,
  advboxPage,
  customerFromInput,
  lawsuitFromInput,
  lawsuitToOutput,
  movementFromInput,
  parseAdvboxPath,
  postFromInput,
} from "../../supabase/functions/_shared/advbox-compat.ts";

describe("parseAdvboxPath", () => {
  it("reconhece recursos, ids e ações", () => {
    expect(parseAdvboxPath("/functions/v1/public-api/api/v1/customers")).toEqual({ resource: "customers", id: null, action: null });
    expect(parseAdvboxPath("/api/v1/customers/birthdays")).toEqual({ resource: "customers", id: null, action: "birthdays" });
    expect(parseAdvboxPath("/api/v1/lawsuits/abc")).toEqual({ resource: "lawsuits", id: "abc", action: null });
    expect(parseAdvboxPath("/api/v1/documents/9/download")?.action).toBe("download");
    expect(parseAdvboxPath("/api/v1/last_movements")?.resource).toBe("last_movements");
  });

  it("rejeita rotas desconhecidas e ids onde não cabem", () => {
    expect(parseAdvboxPath("/api/v1/contacts")).toBeNull();
    expect(parseAdvboxPath("/api/v1/settings/1")).toBeNull();
    expect(parseAdvboxPath("/api/v1/posts/1")).toBeNull();
    expect(parseAdvboxPath("/other")).toBeNull();
  });
});

describe("advboxPage", () => {
  it("aplica padrão 1000 e valida limites", () => {
    expect(advboxPage(new URLSearchParams())).toEqual({ limit: 1000, offset: 0 });
    expect(advboxPage(new URLSearchParams(), 100).limit).toBe(100);
    expect(() => advboxPage(new URLSearchParams("limit=1001"))).toThrow();
    expect(() => advboxPage(new URLSearchParams("offset=-1"))).toThrow();
  });
});

describe("advboxDate", () => {
  it("converte DD/MM/YYYY e aceita ISO", () => {
    expect(advboxDate("31/12/2026", "d")).toBe("2026-12-31");
    expect(advboxDate("2026-01-05", "d")).toBe("2026-01-05");
    expect(advboxDate("", "d")).toBeNull();
    expect(() => advboxDate("ontem", "d")).toThrow();
  });
});

describe("entradas", () => {
  it("cliente exige name e monta o endereço", () => {
    expect(() => customerFromInput({ email: "a@b.c" }, "create")).toThrow();
    expect(customerFromInput({ name: "Ana", cellphone: "9", street: "Rua A", city: "Manaus" }, "create"))
      .toEqual({ nome: "Ana", telefone: "9", endereco: "Rua A, Manaus" });
  });

  it("processo exige número e ao menos um cliente", () => {
    expect(() => lawsuitFromInput({ process_number: "1" }, "create")).toThrow();
    const { patch, customerId } = lawsuitFromInput(
      { process_number: "0001", customers_id: ["c1"], stages_id: "ativo", date: "01/02/2026" }, "create");
    expect(patch).toMatchObject({ numero: "0001", status: "ativo", data_ajuizamento: "2026-02-01" });
    expect(customerId).toBe("c1");
    expect(() => lawsuitFromInput({}, "update")).toThrow();
  });

  it("andamento exige descrição de 10+ caracteres", () => {
    expect(() => movementFromInput({ lawsuit_id: "1", date: "01/02/2026", description: "curta" })).toThrow();
    expect(movementFromInput({ lawsuit_id: "1", date: "01/02/2026", description: "descrição longa ok" }).date).toBe("2026-02-01");
  });

  it("tarefa usa o prazo, senão a data de início", () => {
    const base = { guests: ["u1"], tasks_id: "t1", lawsuits_id: "l1", start_date: "01/02/2026" };
    expect(postFromInput(base).dueDate).toBe("2026-02-01");
    expect(postFromInput({ ...base, date_deadline: "10/02/2026" }).dueDate).toBe("2026-02-10");
    expect(() => postFromInput({ ...base, guests: [] })).toThrow();
  });
});

describe("saída", () => {
  it("processo mantém o formato ADVBOX com nulos nos campos não modelados", () => {
    const out = lawsuitToOutput({ id: "l1", numero: "0001", cliente_id: "c1", cliente_nome: "Ana", status: "ativo" });
    expect(out.process_number).toBe("0001");
    expect(out.customers).toEqual([{ customer_id: "c1", name: "Ana" }]);
    expect(out.fees_money).toBeNull();
  });
});
