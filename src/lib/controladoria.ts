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

function parseLocalDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
      ? parsed
      : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pluralDays(amount: number): string {
  return amount === 1 ? "1 dia" : `${amount} dias`;
}

export function classifyDeadline(
  dueDate: string | null,
  now: Date,
): { urgency: ControladoriaUrgency; days: number | null; label: string } {
  const parsed = dueDate ? parseLocalDay(dueDate) : null;
  if (!parsed) return { urgency: "sem_prazo", days: null, label: "Vencimento não definido" };

  const days = Math.round(
    (startOfDay(parsed) - startOfDay(now)) / DAY_MS,
  );

  if (days < 0) {
    return { urgency: "vencido", days, label: days === -1 ? "Venceu ontem" : `Venceu há ${pluralDays(-days)}` };
  }
  if (days === 0) return { urgency: "hoje", days, label: "Vence hoje" };
  if (days === 1) return { urgency: "amanha", days, label: "Vence amanhã" };
  return { urgency: "proximo", days, label: `Faltam ${pluralDays(days)}` };
}

export function formatDeadlineDate(dueDate: string | null): string {
  const parsed = dueDate ? parseLocalDay(dueDate) : null;
  return parsed
    ? parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "Vencimento não definido";
}

/** Sem prazo vai para o fim da fila, mas nunca some da lista. */
const NO_DEADLINE = Number.MAX_SAFE_INTEGER;

export function sortActionItems(items: ActionItem[]): ActionItem[] {
  return [...items].sort((left, right) => {
    const leftDate = left.dueDate ? parseLocalDay(left.dueDate) : null;
    const rightDate = right.dueDate ? parseLocalDay(right.dueDate) : null;
    const leftDay = leftDate ? startOfDay(leftDate) : NO_DEADLINE;
    const rightDay = rightDate ? startOfDay(rightDate) : NO_DEADLINE;
    if (leftDay !== rightDay) return leftDay - rightDay;
    return left.title.localeCompare(right.title, "pt-BR");
  });
}
