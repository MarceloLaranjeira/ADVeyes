import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PropostaPrazoCard } from "@/components/processos/PropostaPrazoCard";
import type { PropostaPrazo } from "@/services/deadline";

function build(overrides: Partial<PropostaPrazo> = {}): PropostaPrazo {
  return {
    numeroProcesso: "0800123-45.2026.8.04.0001",
    tribunal: "TJAM",
    ato: "Contestação",
    dias: 15,
    diasCorridos: false,
    intimacaoPessoal: false,
    regimePenal: false,
    confianca: "explicito",
    fundamentoDoPrazo: "Prazo declarado na própria publicação.",
    trecho: "no prazo de 15 dias",
    disponibilizacao: "2026-03-02",
    publicacao: "2026-03-03",
    termoInicial: "2026-03-04",
    vencimento: "2026-03-24",
    diasUteisContados: 15,
    diasNaoUteis: [{ date: "2026-03-07", reason: "sábado" }],
    fundamentos: ["CPC, art. 219 — computados somente os dias úteis."],
    regraContagem: {
      modo: "uteis",
      fonte: "cpc",
      confianca: "alta",
      fundamento: "CPC, art. 219 — computados somente os dias úteis.",
    },
    alertas: [],
    calendario: {
      tribunal: "TJAM",
      feriados: [],
      feriadosDoTribunal: 2,
      cobertura: "tribunal",
    },
    ...overrides,
  };
}

const noop = () => {};

describe("PropostaPrazoCard", () => {
  it("mostra a data fatal em formato brasileiro", () => {
    render(
      <PropostaPrazoCard
        proposta={build()}
        onConfirmar={noop}
        onAjustar={noop}
      />,
    );
    // Aparece duas vezes de propósito: no cabeçalho, que responde "quando", e
    // ao fim da cadeia do art. 224, que responde "como se chegou lá".
    expect(screen.getAllByText("24/03/2026")).toHaveLength(2);
  });

  it("exibe a cadeia completa do art. 224", () => {
    render(
      <PropostaPrazoCard
        proposta={build()}
        onConfirmar={noop}
        onAjustar={noop}
      />,
    );
    expect(screen.getByText("Disponibilização")).toBeInTheDocument();
    expect(screen.getByText("Publicação")).toBeInTheDocument();
    expect(screen.getByText("Termo inicial")).toBeInTheDocument();
    expect(screen.getByText("02/03/2026")).toBeInTheDocument();
    expect(screen.getByText("03/03/2026")).toBeInTheDocument();
    expect(screen.getByText("04/03/2026")).toBeInTheDocument();
  });

  it("mostra os alertas sem exigir clique", () => {
    render(
      <PropostaPrazoCard
        proposta={build({
          alertas: ["Possível Fazenda Pública no polo: prazo em dobro."],
        })}
        onConfirmar={noop}
        onAjustar={noop}
      />,
    );
    expect(screen.getByText(/Fazenda Pública/)).toBeVisible();
  });

  it("distingue confiança explícita de deduzida", () => {
    const { rerender } = render(
      <PropostaPrazoCard
        proposta={build()}
        onConfirmar={noop}
        onAjustar={noop}
      />,
    );
    expect(screen.getByText("Prazo escrito na publicação")).toBeInTheDocument();

    rerender(
      <PropostaPrazoCard
        proposta={build({ confianca: "inferido" })}
        onConfirmar={noop}
        onAjustar={noop}
      />,
    );
    expect(screen.getByText("Prazo deduzido do ato")).toBeInTheDocument();
  });

  it("deixa claro que nada é gravado sem confirmação", () => {
    render(
      <PropostaPrazoCard
        proposta={build()}
        onConfirmar={noop}
        onAjustar={noop}
      />,
    );
    expect(screen.getByText(/só é criada depois da sua confirmação/))
      .toBeInTheDocument();
  });

  it("aciona os retornos de confirmar e ajustar", () => {
    const onConfirmar = vi.fn();
    const onAjustar = vi.fn();
    render(
      <PropostaPrazoCard
        proposta={build()}
        onConfirmar={onConfirmar}
        onAjustar={onAjustar}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Confirmar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ajustar/ }));

    expect(onConfirmar).toHaveBeenCalledOnce();
    expect(onAjustar).toHaveBeenCalledOnce();
  });

  it("bloqueia o botão enquanto confirma", () => {
    render(
      <PropostaPrazoCard
        proposta={build()}
        isConfirming
        onConfirmar={noop}
        onAjustar={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /Confirmar/ })).toBeDisabled();
  });

  it("avisa quando só o calendário nacional foi aplicado", () => {
    render(
      <PropostaPrazoCard
        proposta={build({
          calendario: {
            tribunal: "TJAM",
            feriados: [],
            feriadosDoTribunal: 0,
            cobertura: "nacional",
          },
        })}
        onConfirmar={noop}
        onAjustar={noop}
      />,
    );
    expect(screen.getByText(/Apenas o calendário nacional/))
      .toBeInTheDocument();
  });
});

describe("PropostaPrazoCard — fundamento do ramo", () => {
  it("exibe o fundamento do CPP num prazo criminal", () => {
    // A publicação criminal diz "prazo de 5 dias" sem qualificador, e a
    // regra do ramo troca a contagem para corridos. Antes, o cartão só
    // mostrava o fundamento da leitura, que afirmava dias úteis pelo CPC —
    // justificativa contraditória justamente onde a regra muda o resultado.
    render(
      <PropostaPrazoCard
        proposta={build({
          diasCorridos: true,
          regimePenal: true,
          fundamentoDoPrazo: "Prazo declarado na própria publicação.",
          regraContagem: {
            modo: "corridos",
            fonte: "cpp",
            confianca: "alta",
            fundamento: "CPP, art. 798 — os prazos são contínuos.",
          },
        })}
        onConfirmar={vi.fn()}
        onAjustar={vi.fn()}
      />,
    );
    expect(screen.getByText(/CPP, art. 798/)).toBeInTheDocument();
  });

  it("pede conferência quando a regra do ramo não é pacífica", () => {
    render(
      <PropostaPrazoCard
        proposta={build({
          regraContagem: {
            modo: "uteis",
            fonte: "jec",
            confianca: "baixa",
            fundamento: "Lei 9.099/1995 — rito dos Juizados Especiais.",
          },
        })}
        onConfirmar={vi.fn()}
        onAjustar={vi.fn()}
      />,
    );
    expect(screen.getByText(/não é pacífica/)).toBeInTheDocument();
  });
});
