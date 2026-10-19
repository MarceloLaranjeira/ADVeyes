import type { LegalPortalHearing } from "./legal-portal-adapter.ts";

const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso)).replace(",", "");

/**
 * Notas da audiência em linhas "Rótulo: valor"; a tela as separa em etiquetas
 * (recurso, classe, matéria, assunto, sessão virtual).
 */
export function hearingNotes(item: LegalPortalHearing): string {
  const lines = ["Importada da agenda autenticada do Projudi/TJAM."];
  if (item.recourse) lines.push(`Recurso: ${item.recourse}`);
  if (item.classLabel) lines.push(`Classe: ${item.classLabel}`);
  if (item.matter) lines.push(`Matéria: ${item.matter}`);
  if (item.subject) lines.push(`Assunto: ${item.subject}`);
  if (item.endsAt) lines.push(`Sessão virtual: ${dayMonth(item.startsAt)} até ${dayMonth(item.endsAt)} (Manaus)`);
  return lines.join("\n");
}
