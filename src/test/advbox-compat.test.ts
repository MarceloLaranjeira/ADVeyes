import { describe, expect, it } from "vitest";
import {
  advboxDate,
  advboxPage,
  customerFromInput,
  documentToOutput,
  lawsuitFromInput,
  lawsuitToOutput,
  movementFromInput,
  movementTimestamp,
  movementToOutput,
  parseAdvboxPath,
  parseAmount,
  postFromInput,
  transactionFromInput,
  transactionToOutput,
  utcDay,
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

describe("datas de andamento", () => {
  it("devolve o dia UTC mesmo com o instante em outro fuso", () => {
    expect(utcDay("2026-10-18T20:00:00-04:00")).toBe("2026-10-19");
    expect(utcDay("2026-10-19T12:00:00+00:00")).toBe("2026-10-19");
    expect(utcDay(null)).toBeNull();
  });

  it("grava a data ao meio-dia UTC e volta no mesmo dia", () => {
    const stored = movementTimestamp("2026-10-19");
    expect(stored).toBe("2026-10-19T12:00:00Z");
    expect(utcDay(stored)).toBe("2026-10-19");
    expect(movementToOutput({ data_andamento: "2026-10-19T08:00:00-04:00", descricao: "x" }, "l1").date).toBe("2026-10-19");
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

describe("transações", () => {
  const base = { entry_type: "income", debit_account: "a", categories_id: "c", cost_centers_id: "k", amount: "250,50", date_due: "05/11/2026" };

  it("converte valores em formato brasileiro e recusa zero e lixo", () => {
    expect(parseAmount("250,50")).toBe(250.5);
    expect(parseAmount("1.250,50")).toBe(1250.5);
    expect(parseAmount(99.9)).toBe(99.9);
    expect(() => parseAmount("0")).toThrow();
    expect(() => parseAmount("abc")).toThrow();
    expect(() => parseAmount("-5")).toThrow();
  });

  it("cria receita como honorário e despesa como despesa", () => {
    const income = transactionFromInput(base, "create");
    expect(income.patch).toMatchObject({ tipo: "honorario", valor: 250.5, data_vencimento: "2026-11-05" });
    expect(income.refs).toMatchObject({ accountId: "a", categoryId: "c", costCenterId: "k" });
    expect(transactionFromInput({ ...base, entry_type: "expense" }, "create").patch.tipo).toBe("despesa");
  });

  it("exige tipo válido, classificação e cliente quando há processo", () => {
    expect(() => transactionFromInput({ ...base, entry_type: "x" }, "create")).toThrow();
    expect(() => transactionFromInput({ ...base, categories_id: undefined }, "create")).toThrow();
    expect(() => transactionFromInput({ ...base, lawsuits_id: "l1" }, "create")).toThrow();
  });

  it("atualiza valor, vencimento e pagamento", () => {
    expect(transactionFromInput({ amount: "10,00" }, "update").patch).toEqual({ valor: 10 });
    const paid = transactionFromInput({ status: "paid", date_payment: "06/11/2026" }, "update").patch;
    expect(paid).toMatchObject({ status: "pago", data_pagamento: "2026-11-06" });
    expect(transactionFromInput({ status: "pending" }, "update").patch).toMatchObject({ status: "pendente", data_pagamento: null });
    expect(() => transactionFromInput({}, "update")).toThrow();
    expect(() => transactionFromInput({ status: "xyz" }, "update")).toThrow();
  });

  it("devolve o lançamento no formato ADVBOX", () => {
    const out = transactionToOutput({ id: "t1", tipo: "despesa", valor: 30, status: "atrasado", descricao: "x", data_vencimento: "2026-11-05" });
    expect(out).toMatchObject({ id: "t1", entry_type: "expense", amount: 30, status: "overdue", date_due: "2026-11-05" });
  });
});

describe("documentos", () => {
  it("monta o link de download e o vínculo com o processo", () => {
    const out = documentToOutput({ id: "d1", nome: "peticao.pdf", tamanho: 10, processo_id: "p1", created_at: "x" }, { numero: "0001" });
    expect(out.links.download).toBe("/api/v1/documents/d1/download");
    expect(out.attached_to).toEqual({ type: "lawsuit", id: "p1", label: "0001" });
    expect(documentToOutput({ id: "d2", nome: "a" }, null).attached_to).toBeNull();
  });
});
