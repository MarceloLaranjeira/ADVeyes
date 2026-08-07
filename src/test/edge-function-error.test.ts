import { describe, expect, it } from "vitest";
import { readEdgeFunctionError } from "@/lib/edge-function-error";
import { formatDateBR } from "@/lib/utils";

/** Simula a falha que o supabase-js entrega: mensagem genérica + corpo. */
function falhaComCorpo(corpo: unknown, status = 400) {
  const error = new Error("Edge Function returned a non-2xx status code");
  (error as Error & { context?: Response }).context = new Response(
    JSON.stringify(corpo),
    { status, headers: { "Content-Type": "application/json" } },
  );
  return error;
}

describe("readEdgeFunctionError", () => {
  // O caso real: a função diz que falta credencial, e o usuário via um
  // código de status.
  it("lê o texto que a função respondeu", async () => {
    const falha = falhaComCorpo({
      error: "Credenciais não configuradas para TJAM. Configure em Configurações > Tribunais.",
    });
    const resultado = await readEdgeFunctionError(falha);
    expect(resultado.message).toContain("Credenciais não configuradas");
    expect(resultado.message).not.toContain("non-2xx");
  });

  it("traduz códigos conhecidos", async () => {
    expect((await readEdgeFunctionError(falhaComCorpo({ error: "permission_denied" }))).message)
      .toBe("Você não tem permissão para esta ação.");
    expect((await readEdgeFunctionError(falhaComCorpo({ error: "llm_not_configured" }))).message)
      .toContain("IA ainda não foi configurada");
  });

  it("prefere o detalhe específico ao texto do código", async () => {
    const resultado = await readEdgeFunctionError(
      falhaComCorpo({ error: "operation_failed", detail: "constraint violada" }),
    );
    expect(resultado.code).toBe("operation_failed");
    expect(resultado.message).toBe("constraint violada");
  });

  it("expõe o código para quem quiser ramificar", async () => {
    const resultado = await readEdgeFunctionError(
      falhaComCorpo({ error: "llm_rate_limited" }),
    );
    expect(resultado.code).toBe("llm_rate_limited");
  });

  // O clone é obrigatório: ler o corpo original o consome.
  it("não consome o corpo da resposta", async () => {
    const falha = falhaComCorpo({ error: "invalid_payload" });
    await readEdgeFunctionError(falha);
    const context = (falha as Error & { context: Response }).context;
    await expect(context.json()).resolves.toEqual({ error: "invalid_payload" });
  });

  it("nunca deixa o texto genérico chegar ao usuário", async () => {
    const semCorpo = new Error("Edge Function returned a non-2xx status code");
    const resultado = await readEdgeFunctionError(semCorpo);
    expect(resultado.message).not.toContain("non-2xx");
    expect(resultado.message.length).toBeGreaterThan(0);
  });

  it("sobrevive a corpo que não é JSON", async () => {
    const error = new Error("Edge Function returned a non-2xx status code");
    (error as Error & { context?: Response }).context = new Response("<html>502</html>");
    const resultado = await readEdgeFunctionError(error);
    expect(resultado.message.length).toBeGreaterThan(0);
  });

  it("preserva mensagem de erro comum, não vinda de Edge Function", async () => {
    const resultado = await readEdgeFunctionError(new Error("Falha de rede"));
    expect(resultado.message).toBe("Falha de rede");
  });
});

describe("formatDateBR", () => {
  it("formata data válida no padrão brasileiro", () => {
    expect(formatDateBR("2026-08-07")).toBe("07/08/2026");
  });

  /**
   * A oeste de Greenwich, meia-noite UTC é o dia anterior. Tribunal e diário
   * entregam data de calendário — deixá-la passar pelo fuso recuaria todo
   * prazo em um dia em Manaus, que é prazo errado.
   */
  it("não recua o dia por causa do fuso", () => {
    expect(formatDateBR("2026-08-07T00:00:00.000Z")).toBe("07/08/2026");
    expect(formatDateBR("2026-01-01T00:00:00Z")).toBe("01/01/2026");
    expect(formatDateBR("2026-03-24")).toBe("24/03/2026");
  });

  it("rejeita data de calendário inexistente", () => {
    expect(formatDateBR("2026-13-45")).toBeNull();
    expect(formatDateBR("2026-02-30")).toBeNull();
  });

  // O bug real: o DataJud devolveu algo ilegível e a tela mostrou
  // "Invalid Date" ao advogado.
  it("devolve nulo em vez de Invalid Date", () => {
    for (const lixo of ["Invalid Date", "não informado", "0000-00-00", "abc"]) {
      expect(formatDateBR(lixo)).toBeNull();
    }
  });

  it("devolve nulo para ausência", () => {
    expect(formatDateBR(null)).toBeNull();
    expect(formatDateBR(undefined)).toBeNull();
    expect(formatDateBR("")).toBeNull();
  });

  it("aceita Date e timestamp", () => {
    expect(formatDateBR(new Date("2026-03-24T12:00:00Z"))).toBe("24/03/2026");
    expect(formatDateBR(Date.UTC(2026, 2, 24, 12))).toBe("24/03/2026");
  });

  it("nunca devolve a string Invalid Date", () => {
    const entradas = ["x", null, undefined, "", "2026-13-45", NaN];
    for (const entrada of entradas) {
      expect(formatDateBR(entrada as never)).not.toBe("Invalid Date");
    }
  });
});
