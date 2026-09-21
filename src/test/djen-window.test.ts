import { describe, expect, it } from "vitest";
import {
  djenStartDate,
  nextDjenCursor,
} from "../../supabase/functions/_shared/djen-window.ts";

/**
 * O teste que faltava no PR #33.
 *
 * A primeira versão da correção preservava `sync_cursor` em execução truncada,
 * mas a janela seguinte era calculada a partir de `last_success_at` — que
 * continuava avançando. O backlog era pulado exatamente como antes: a correção
 * parecia certa e não fazia nada.
 */

const NOW = new Date("2026-09-20T12:00:00Z");

describe("djenStartDate — de onde a janela realmente começa", () => {
  it("usa o cursor, não o last_success_at, quando os dois existem", () => {
    // Este é o caso que revela o bug: a fonte respondeu hoje (last_success_at),
    // mas só varreu até o dia 10 (cursor). A janela tem de voltar ao dia 10.
    const start = djenStartDate({
      sync_cursor: "2026-09-10",
      last_success_at: "2026-09-20T11:00:00Z",
    }, NOW);

    expect(start).toBe("2026-09-09"); // cursor menos 1 dia de sobreposição
    expect(start).not.toBe("2026-09-19"); // o que o código antigo devolvia
  });

  it("cai em last_success_at quando ainda não há cursor", () => {
    expect(
      djenStartDate({
        sync_cursor: null,
        last_success_at: "2026-09-18T10:00:00Z",
      }, NOW),
    ).toBe("2026-09-17");
  });

  it("usa a janela inicial quando a fonte nunca sincronizou", () => {
    expect(
      djenStartDate({ sync_cursor: null, last_success_at: null }, NOW),
    ).toBe("2026-09-13"); // 7 dias de lookback
  });

  it("ignora cursor em formato inesperado em vez de gerar data inválida", () => {
    const start = djenStartDate({
      sync_cursor: "ontem",
      last_success_at: "2026-09-18T10:00:00Z",
    }, NOW);
    expect(start).toBe("2026-09-17");
  });

  it("ignora last_success_at inválido", () => {
    expect(
      djenStartDate({ sync_cursor: null, last_success_at: "não é data" }, NOW),
    ).toBe("2026-09-13");
  });
});

describe("nextDjenCursor — quando a janela avança", () => {
  it("avança para o fim do período quando a varredura terminou", () => {
    expect(
      nextDjenCursor({
        currentCursor: "2026-09-10",
        windowEnd: "2026-09-20",
        truncated: false,
      }),
    ).toBe("2026-09-20");
  });

  it("congela o cursor quando a varredura foi truncada", () => {
    // Sem isto, o backlog entre o cursor e o fim do período some para sempre.
    expect(
      nextDjenCursor({
        currentCursor: "2026-09-10",
        windowEnd: "2026-09-20",
        truncated: true,
      }),
    ).toBe("2026-09-10");
  });

  it("mantém null quando truncou antes de existir cursor", () => {
    // Nulo faz a próxima execução recomeçar pela janela inicial — conservador
    // e correto: melhor rebuscar do que pular.
    expect(
      nextDjenCursor({
        currentCursor: null,
        windowEnd: "2026-09-20",
        truncated: true,
      }),
    ).toBeNull();
  });
});

describe("ciclo completo: truncar, retomar, completar", () => {
  it("a segunda execução recomeça do ponto em que a primeira parou", () => {
    const source = { sync_cursor: "2026-09-10", last_success_at: null as string | null };

    // Execução 1: janela 09-09 → 09-20, mas a cota zera no meio.
    const start1 = djenStartDate(source, NOW);
    expect(start1).toBe("2026-09-09");
    const cursor1 = nextDjenCursor({
      currentCursor: source.sync_cursor,
      windowEnd: "2026-09-20",
      truncated: true,
    });
    // Mesmo com a fonte tendo respondido, o cursor não andou.
    source.sync_cursor = cursor1;
    source.last_success_at = "2026-09-20T12:00:00Z";
    expect(source.sync_cursor).toBe("2026-09-10");

    // Execução 2: a janela tem de voltar ao mesmo ponto, ignorando o
    // last_success_at que avançou.
    const start2 = djenStartDate(source, NOW);
    expect(start2).toBe(start1);

    // Agora completa: o cursor finalmente avança.
    const cursor2 = nextDjenCursor({
      currentCursor: source.sync_cursor,
      windowEnd: "2026-09-20",
      truncated: false,
    });
    expect(cursor2).toBe("2026-09-20");
  });
});
