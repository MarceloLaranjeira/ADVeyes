export interface SchedulableSource {
  id: string;
  tenant_id: string;
  source_kind: "oab" | "process";
  next_sync_at: string;
  created_at: string;
}

function dueOrder(left: SchedulableSource, right: SchedulableSource): number {
  const due = left.next_sync_at.localeCompare(right.next_sync_at);
  return due || left.created_at.localeCompare(right.created_at) ||
    left.id.localeCompare(right.id);
}

/**
 * Faz round-robin entre escritórios, preservando a antiguidade dentro de cada
 * um. Um tenant com milhares de fontes não pode consumir o lote inteiro.
 */
export function roundRobinByTenant<T extends SchedulableSource>(
  candidates: T[],
): T[] {
  const queues = new Map<string, T[]>();
  for (const source of [...candidates].sort(dueOrder)) {
    const queue = queues.get(source.tenant_id) ?? [];
    queue.push(source);
    queues.set(source.tenant_id, queue);
  }

  const tenantIds = [...queues.keys()].sort((left, right) => {
    const leftFirst = queues.get(left)?.[0];
    const rightFirst = queues.get(right)?.[0];
    if (!leftFirst || !rightFirst) return left.localeCompare(right);
    return dueOrder(leftFirst, rightFirst);
  });
  const ordered: T[] = [];
  let remaining = candidates.length;
  while (remaining > 0) {
    for (const tenantId of tenantIds) {
      const item = queues.get(tenantId)?.shift();
      if (!item) continue;
      ordered.push(item);
      remaining -= 1;
    }
  }
  return ordered;
}

/**
 * Reserva 30% do ciclo para fontes de OAB e intercala os dois tipos. Se um
 * grupo não tiver trabalho, o outro usa a capacidade livre.
 */
export function selectFairLegalSources<T extends SchedulableSource>(
  processCandidates: T[],
  oabCandidates: T[],
  batchSize: number,
): T[] {
  if (batchSize <= 0) return [];
  const processes = roundRobinByTenant(processCandidates);
  const oabs = roundRobinByTenant(oabCandidates);
  const reservedOabs = oabs.length
    ? Math.min(oabs.length, Math.max(1, Math.floor(batchSize * 0.3)))
    : 0;
  const selectedProcesses = processes.splice(
    0,
    Math.min(processes.length, batchSize - reservedOabs),
  );
  const selectedOabs = oabs.splice(
    0,
    Math.min(oabs.length, batchSize - selectedProcesses.length),
  );

  while (
    selectedProcesses.length + selectedOabs.length < batchSize &&
    (processes.length || oabs.length)
  ) {
    const process = processes.shift();
    if (process) selectedProcesses.push(process);
    if (selectedProcesses.length + selectedOabs.length >= batchSize) break;
    const oab = oabs.shift();
    if (oab) selectedOabs.push(oab);
  }

  const selected: T[] = [];
  while (selectedProcesses.length || selectedOabs.length) {
    const oab = selectedOabs.shift();
    if (oab) selected.push(oab);
    const firstProcess = selectedProcesses.shift();
    if (firstProcess) selected.push(firstProcess);
    const secondProcess = selectedProcesses.shift();
    if (secondProcess) selected.push(secondProcess);
  }
  return selected.slice(0, batchSize);
}
