/**
 * Cálculo da Controladoria: quanto falta e o que vem antes.
 *
 * A contagem é em dias corridos porque a data já está correta — quem a
 * calculou em dias úteis foi o calendário forense no momento em que o prazo
 * foi confirmado. Aqui só se mede a distância até uma data que já existe.
 */

import type { ActionItem, ControladoriaUrgency } from "@/types/controladoria";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Meia-noite local: prazo é dia, não instante. */
function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function parseLocalDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function pluralDays(amount: number): string {
  return amount === 1 ? "1 dia" : `${amount} dias`;
}

export function classifyDeadline(
  dueDate: string | null,
  now: Date,
): { urgency: ControladoriaUrgency; days: number | null; label: string } {
  if (!dueDate) return { urgency: "sem_prazo", days: null, label: "sem prazo" };

  const days = Math.round(
    (startOfDay(parseLocalDay(dueDate)) - startOfDay(now)) / DAY_MS,
  );

  if (days < 0) {
    return { urgency: "vencido", days, label: `venceu há ${pluralDays(-days)}` };
  }
  if (days === 0) return { urgency: "hoje", days, label: "hoje" };
  if (days === 1) return { urgency: "amanha", days, label: "amanhã" };
  return { urgency: "proximo", days, label: `faltam ${pluralDays(days)}` };
}

/** Sem prazo vai para o fim da fila, mas nunca some da lista. */
const NO_DEADLINE = Number.MAX_SAFE_INTEGER;

export function sortActionItems(items: ActionItem[]): ActionItem[] {
  return [...items].sort((left, right) => {
    const leftDay = left.dueDate ? startOfDay(parseLocalDay(left.dueDate)) : NO_DEADLINE;
    const rightDay = right.dueDate ? startOfDay(parseLocalDay(right.dueDate)) : NO_DEADLINE;
    if (leftDay !== rightDay) return leftDay - rightDay;
    return left.title.localeCompare(right.title, "pt-BR");
  });
}
