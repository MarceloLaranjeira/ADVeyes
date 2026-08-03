import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AndamentosManuais } from "@/components/processos/AndamentosManuais";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const baseProps = {
  tenantId: "tenant-1",
  processId: "processo-1",
  processNumber: "0285939-12.2025.8.04.1000",
  currentUserId: "user-1",
  onChanged: vi.fn(),
};

describe("AndamentosManuais", () => {
  it("orienta o usuário quando não há registros", () => {
    render(<AndamentosManuais {...baseProps} items={[]} />);
    expect(screen.getByText("Nenhum andamento registrado")).toBeTruthy();
  });

  it("lista o registro com ações de editar e excluir", () => {
    render(
      <AndamentosManuais
        {...baseProps}
        items={[{
          id: "a1",
          data_andamento: "2026-08-01T12:00:00.000Z",
          tipo: "Diligência",
          descricao: "Contato com o cliente",
          tribunal: "TJAM",
          origem: "manual",
          user_id: "user-1",
        }]}
      />,
    );

    expect(screen.getByText("Contato com o cliente")).toBeTruthy();
    expect(screen.getByText("Diligência")).toBeTruthy();
    expect(screen.getByLabelText("Editar andamento")).toBeTruthy();
    expect(screen.getByLabelText("Excluir andamento")).toBeTruthy();
  });

  it("não oferece edição para movimentação oficial", () => {
    render(
      <AndamentosManuais
        {...baseProps}
        items={[{
          id: "a2",
          data_andamento: "2026-08-01T12:00:00.000Z",
          tipo: "Juntada",
          descricao: "Movimento do DataJud",
          tribunal: "TJAM",
          origem: "datajud",
          user_id: null,
        }]}
      />,
    );

    expect(screen.queryByText("Movimento do DataJud")).toBeNull();
    expect(screen.getByText("Nenhum andamento registrado")).toBeTruthy();
  });

  it("sinaliza registro feito por outro membro do escritório", () => {
    render(
      <AndamentosManuais
        {...baseProps}
        items={[{
          id: "a3",
          data_andamento: "2026-08-01T12:00:00.000Z",
          tipo: "Andamento",
          descricao: "Petição protocolada",
          tribunal: null,
          origem: "manual",
          user_id: "outro-usuario",
        }]}
      />,
    );

    expect(screen.getByText(/registrado por outro membro/)).toBeTruthy();
  });
});
