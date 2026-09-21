/**
 * Classificação do estado de uma fonte de sincronização.
 *
 * A distinção que importa para o advogado: uma fonte que respondeu mas não
 * terminou o período NÃO está com falha. As publicações já baixadas estão no
 * painel, a janela de datas não avançou e a próxima execução retoma do mesmo
 * ponto. Misturar os dois casos gera alarme falso e, pior, esconde as fontes
 * que realmente pararam de funcionar.
 */

export type SyncHealth = "healthy" | "partial" | "pending" | "failing" | "stopped";

export interface SyncSourceState {
  active: boolean;
  last_error_code: string | null;
  paused_reason: string | null;
}

/**
 * Códigos que indicam busca incompleta — o provedor respondeu, mas a varredura
 * parou antes do fim do período por limite de cota ou volume.
 */
export const PARTIAL_SYNC_CODES: Record<string, string> = {
  djen_rate_limited:
    "Cota do DJEN esgotada no meio da busca — o restante vem na próxima execução",
  djen_max_pages:
    "Período com muitas publicações — o restante vem na próxima execução",
  datajud_max_pages_reached:
    "Muitos processos no tribunal — o restante vem na próxima varredura",
};

export function isPartialSyncCode(code: string | null | undefined): boolean {
  return Boolean(code && code in PARTIAL_SYNC_CODES);
}

export function partialSyncLabel(code: string | null | undefined): string | null {
  return code ? PARTIAL_SYNC_CODES[code] ?? null : null;
}

/**
 * Estado único de uma fonte. A ordem das verificações é a prioridade de
 * exibição: o que exige ação humana aparece antes do que se resolve sozinho.
 */
export function classifySyncSource(source: SyncSourceState): SyncHealth {
  // Interrompida: exige reativação manual — é o estado mais grave.
  if (!source.active && source.paused_reason !== "covered_by_oab") {
    return "stopped";
  }
  // Sem credencial: exige configuração, mas não é falha de operação.
  if (source.last_error_code === "integration_not_configured") return "pending";
  // Incompleta: se completa sozinha, nunca é contada como falha.
  if (isPartialSyncCode(source.last_error_code)) return "partial";
  if (source.last_error_code) return "failing";
  return "healthy";
}

export interface SyncHealthSummary {
  healthy: number;
  partial: number;
  pending: number;
  failing: number;
  stopped: number;
}

export function summarizeSyncHealth(
  sources: SyncSourceState[],
): SyncHealthSummary {
  const summary: SyncHealthSummary = {
    healthy: 0,
    partial: 0,
    pending: 0,
    failing: 0,
    stopped: 0,
  };
  for (const source of sources) {
    summary[classifySyncSource(source)] += 1;
  }
  return summary;
}
