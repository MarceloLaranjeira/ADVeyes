import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsageMeter } from "@/components/integracoes/UsageMeter";

describe("UsageMeter", () => {
  it("mostra o consumo do período", () => {
    render(<UsageMeter label="Consultas neste mês" used={12} total={50} />);
    expect(screen.getByText("12 de 50")).toBeTruthy();
    expect(screen.getByLabelText("Consultas neste mês")).toBeTruthy();
  });

  it("expõe o progresso para leitores de tela", () => {
    render(<UsageMeter label="Consultas" used={20} total={200} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("20");
    expect(bar.getAttribute("aria-valuemax")).toBe("200");
  });

  it("não ultrapassa a barra quando o consumo excede o limite", () => {
    render(<UsageMeter label="Consultas" used={80} total={50} />);
    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("trata limite zero como esgotado, sem dividir por zero", () => {
    render(<UsageMeter label="Consultas" used={0} total={0} />);
    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
    expect(screen.getByText("0 de 0")).toBeTruthy();
  });
});

describe("UsageMeter em reais", () => {
  it("formata orçamento e gasto como moeda", () => {
    render(
      <UsageMeter label="Orçamento do mês" used={465} total={6000} asCurrency />,
    );
    expect(screen.getByText(/R\$\s?4,65 de R\$\s?60,00/)).toBeTruthy();
  });

  it("mantém números simples quando não é moeda", () => {
    render(<UsageMeter label="Processos" used={12} total={100} />);
    expect(screen.getByText("12 de 100")).toBeTruthy();
  });
});
