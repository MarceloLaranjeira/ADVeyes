import { describe, expect, it } from "vitest";
import {
  contarNaoLidas,
  mapData,
  mapNotificacao,
  mapTipo,
  mapUrgencia,
  mergeNotificacao,
  type NotificacaoRow,
} from "@/lib/notificacoes";
import type { Notificacao } from "@/types/notificacoes";

function row(overrides: Partial<NotificacaoRow> = {}): NotificacaoRow {
  return {
    id: "n-1",
    tipo: "alerta",
    urgencia: "ALTA",
    titulo: "Prazo vencendo",
    mensagem: "Contestação vence em 2 dias",
    processo_numero: "0800123-45.2023.8.04.0001",
    created_at: "2026-09-20T10:00:00Z",
    lida: false,
    lida_em: null,
    arquivada_em: null,
    tenant_id: "tenant-1",
    user_id: "user-1",
    ...overrides,
  };
}

function notificacao(overrides: Partial<Notificacao> = {}): Notificacao {
  return {
    id: "n-1",
    tipo: "GERAL",
    urgencia: "MEDIA",
    titulo: "Aviso",
    mensagem: "",
    dataNotificacao: new Date("2026-09-20T10:00:00Z"),
    lida: false,
    ...overrides,
  };
}

describe("mapTipo", () => {
  it("traduz os tipos gravados pelas Edge Functions", () => {
    expect(mapTipo("movimentacao")).toBe("NOVA_MOVIMENTACAO");
    expect(mapTipo("alerta")).toBe("PRAZO_VENCENDO");
    expect(mapTipo("prazo_vencendo")).toBe("PRAZO_VENCENDO");
    expect(mapTipo("sentenca")).toBe("SENTENCA");
    expect(mapTipo("intimacao")).toBe("INTIMACAO");
  });

  it("aceita variação de caixa e espaço", () => {
    expect(mapTipo("  ALERTA  ")).toBe("PRAZO_VENCENDO");
  });

  it("cai em GERAL para tipo desconhecido em vez de sumir", () => {
    // Uma Edge Function nova pode gravar um tipo que o front ainda não conhece.
    // Some da tela seria pior do que aparecer sem categoria.
    expect(mapTipo("tipo_que_ainda_nao_existe")).toBe("GERAL");
    expect(mapTipo(null)).toBe("GERAL");
  });
});

describe("mapUrgencia", () => {
  it("aceita o vocabulário fechado", () => {
    expect(mapUrgencia("CRITICA")).toBe("CRITICA");
    expect(mapUrgencia("baixa")).toBe("BAIXA");
  });

  it("usa MEDIA quando o valor está fora do vocabulário", () => {
    expect(mapUrgencia("URGENTÍSSIMO")).toBe("MEDIA");
    expect(mapUrgencia(null)).toBe("MEDIA");
  });
});

describe("mapData", () => {
  it("converte a data do banco", () => {
    expect(mapData("2026-09-20T10:00:00Z").toISOString())
      .toBe("2026-09-20T10:00:00.000Z");
  });

  it("nunca devolve Invalid Date", () => {
    // O painel formata com toLocaleString: uma data inválida viraria
    // "Invalid Date" na tela do advogado.
    expect(Number.isNaN(mapData("não é data").getTime())).toBe(false);
    expect(Number.isNaN(mapData(null).getTime())).toBe(false);
  });
});

describe("mapNotificacao", () => {
  it("monta a notificação a partir da linha", () => {
    const item = mapNotificacao(row());
    expect(item).toMatchObject({
      id: "n-1",
      tipo: "PRAZO_VENCENDO",
      urgencia: "ALTA",
      titulo: "Prazo vencendo",
      processoId: "0800123-45.2023.8.04.0001",
      lida: false,
      acao: {
        label: "Abrir processo",
        url: "/processos?tab=lista&q=0800123-45.2023.8.04.0001",
      },
    });
  });

  it("trata lida_em como fonte da verdade", () => {
    expect(mapNotificacao(row({ lida: false, lida_em: "2026-09-20T11:00:00Z" })).lida)
      .toBe(true);
  });

  it("respeita o booleano legado quando lida_em ainda é nulo", () => {
    // Linhas gravadas antes da coluna existir só têm o booleano.
    expect(mapNotificacao(row({ lida: true, lida_em: null })).lida).toBe(true);
  });

  it("só oferece abrir processo quando há número CNJ", () => {
    expect(mapNotificacao(row({ processo_numero: null })).acao).toBeUndefined();
    expect(mapNotificacao(row({ processo_numero: "   " })).acao).toBeUndefined();
  });

  it("dá um título de fallback em vez de deixar vazio", () => {
    expect(mapNotificacao(row({ titulo: "   " })).titulo).toBe("Notificação");
    expect(mapNotificacao(row({ titulo: null })).titulo).toBe("Notificação");
  });
});

describe("mergeNotificacao", () => {
  it("coloca a nova notificação no topo", () => {
    const lista = [notificacao({ id: "antiga" })];
    const resultado = mergeNotificacao(lista, notificacao({ id: "nova" }));
    expect(resultado.map((n) => n.id)).toEqual(["nova", "antiga"]);
  });

  it("ignora id repetido", () => {
    // O mesmo INSERT chega duas vezes quando o canal reconecta, ou quando a
    // linha já veio na carga inicial. Duplicar inflaria o contador do sino.
    const lista = [notificacao({ id: "n-1" })];
    expect(mergeNotificacao(lista, notificacao({ id: "n-1" }))).toBe(lista);
    expect(mergeNotificacao(lista, notificacao({ id: "n-1" }))).toHaveLength(1);
  });
});

describe("contarNaoLidas", () => {
  it("conta apenas as não lidas", () => {
    expect(contarNaoLidas([
      notificacao({ id: "a", lida: false }),
      notificacao({ id: "b", lida: true }),
      notificacao({ id: "c", lida: false }),
    ])).toBe(2);
  });

  it("devolve zero para lista vazia", () => {
    expect(contarNaoLidas([])).toBe(0);
  });
});
