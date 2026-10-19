export interface ProviderHealthRow {
  provider: string;
  healthy_count: number;
  failing_count: number;
  top_failure_code: string | null;
}

export interface ProviderHealthAlert {
  /** Provedores com ao menos uma fonte em falha, do mais afetado ao menos. */
  failing: ProviderHealthRow[];
  /** Provedores que só têm fontes saudáveis. */
  working: string[];
}

/** Retorna null quando nenhum provedor tem fonte em falha. */
export function summarizeProviderHealth(
  rows: readonly ProviderHealthRow[],
): ProviderHealthAlert | null {
  const failing = rows
    .filter((row) => row.failing_count > 0)
    .sort((a, b) => b.failing_count - a.failing_count);
  if (failing.length === 0) return null;

  const working = rows
    .filter((row) => row.failing_count === 0 && row.healthy_count > 0)
    .map((row) => row.provider);

  return { failing, working };
}
