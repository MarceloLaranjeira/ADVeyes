import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata um valor em reais. Fonte única para todas as telas financeiras. */
export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Formata uma data para exibição, ou devolve `null` quando não dá para ler.
 *
 * Os tribunais entregam data em formatos irregulares — e `new Date(lixo)`
 * não lança: devolve um Date inválido que `toLocaleDateString` imprime como
 * "Invalid Date" na tela. Testar apenas se o campo existe não basta; é
 * preciso testar se ele virou uma data de verdade.
 *
 * Devolver `null` em vez de um texto de erro deixa quem chama decidir entre
 * omitir a linha ou mostrar um substituto.
 */
export function formatDateBR(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;

  // Data de calendário (`2026-08-07`, com ou sem hora zerada em UTC) é o que
  // tribunal e diário entregam: significa "este dia", não "este instante".
  // Convertê-la para o fuso local recua um dia a oeste de Greenwich — em
  // Manaus, UTC−4, todo prazo apareceria um dia antes. Aqui ela é lida como
  // texto, sem passar pelo fuso.
  if (typeof value === "string") {
    const calendario = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z?)?$/
      .exec(value.trim());
    if (calendario) {
      const [, ano, mes, dia] = calendario;
      // Descarta 2026-13-45 e afins, que o regex sozinho aceita.
      const teste = new Date(Date.UTC(+ano, +mes - 1, +dia));
      if (
        teste.getUTCFullYear() !== +ano ||
        teste.getUTCMonth() !== +mes - 1 ||
        teste.getUTCDate() !== +dia
      ) return null;
      return `${dia}/${mes}/${ano}`;
    }
  }

  // Momento no tempo (com hora real) é legitimamente convertido ao fuso local.
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
}
