import { describe, expect, it } from "vitest";
import { describePostgrestError } from "@/services/controladoria-actions";

describe("describePostgrestError", () => {
  it("diz que faltou permissão em vez de falar em erro", () => {
    expect(describePostgrestError({ code: "42501", message: "permission denied for table tarefas" }))
      .toBe("Seu acesso não permite esta ação neste escritório.");
  });

  it("reconhece a linha que não existe mais", () => {
    expect(describePostgrestError({ code: "PGRST116", message: "" }))
      .toBe("Este registro não está mais disponível. Atualize a tela.");
  });

  it("esconde o detalhe interno de uma falha desconhecida", () => {
    const message = describePostgrestError({ code: "XX000", message: "internal: relation pg_toast_4711" });
    expect(message).toContain("Não foi possível concluir");
    expect(message).not.toContain("pg_toast");
  });

  it("trata ausência de erro estruturado", () => {
    expect(describePostgrestError(null)).toContain("Não foi possível concluir");
  });
});
