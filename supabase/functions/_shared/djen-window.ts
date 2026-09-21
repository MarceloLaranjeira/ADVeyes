/**
 * Janela de busca do DJEN.
 *
 * O ponto central: a posição retomável é o `sync_cursor`, não o
 * `last_success_at`.
 *
 * `last_success_at` registra quando a fonte respondeu pela última vez e avança
 * em toda execução bem-sucedida — inclusive nas truncadas, em que a cota da
 * API zerou no meio do período. Derivar a janela dele faz a execução seguinte
 * começar depois do backlog, e a publicação que ficou para trás nunca mais é
 * buscada. Publicação perdida é prazo perdido.
 *
 * `sync_cursor` só avança quando a varredura chegou ao fim do período. Enquanto
 * estiver parado, cada execução recomeça do mesmo ponto até completar.
 */

export const DJEN_INITIAL_LOOKBACK_DAYS = 7;
export const DJEN_OVERLAP_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export interface DjenWindowSource {
  /** Até onde o período foi efetivamente varrido (YYYY-MM-DD). */
  sync_cursor: string | null;
  /** Quando a fonte respondeu pela última vez (ISO). */
  last_success_at: string | null;
}

export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Data inicial da próxima janela. A sobreposição de um dia cobre publicações
 * disponibilizadas perto da virada que ainda não estavam no índice.
 */
export function djenStartDate(source: DjenWindowSource, now: Date): string {
  const fallback = () =>
    dateOnly(new Date(now.getTime() - DJEN_INITIAL_LOOKBACK_DAYS * DAY_MS));

  if (source.sync_cursor && DATE_ONLY.test(source.sync_cursor)) {
    const cursor = new Date(`${source.sync_cursor}T00:00:00Z`);
    if (!Number.isNaN(cursor.getTime())) {
      return dateOnly(new Date(cursor.getTime() - DJEN_OVERLAP_DAYS * DAY_MS));
    }
  }

  if (!source.last_success_at) return fallback();
  const lastSuccess = new Date(source.last_success_at);
  if (Number.isNaN(lastSuccess.getTime())) return fallback();

  return dateOnly(
    new Date(lastSuccess.getTime() - DJEN_OVERLAP_DAYS * DAY_MS),
  );
}

/**
 * Para onde o cursor vai depois da execução. Truncada, ele fica onde estava —
 * é o que garante que a próxima execução retome o backlog em vez de pulá-lo.
 */
export function nextDjenCursor(input: {
  currentCursor: string | null;
  windowEnd: string;
  truncated: boolean;
}): string | null {
  return input.truncated ? input.currentCursor : input.windowEnd;
}
