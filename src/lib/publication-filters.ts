export type PublicationPeriod = "todas" | "hoje" | "7d" | "30d";

export const PERIOD_LABELS: Record<PublicationPeriod, string> = {
  todas: "Todo o período",
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

const DAY_MS = 86_400_000;
const PERIOD_DAYS: Record<Exclude<PublicationPeriod, "todas" | "hoje">, number> = { "7d": 7, "30d": 30 };

/** Compara só a data (AAAA-MM-DD), para que o fuso não mova a publicação de dia. */
export function matchesPeriod(date: string | null, period: PublicationPeriod, now = new Date()): boolean {
  if (period === "todas") return true;
  if (!date) return false;
  const day = date.slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  if (period === "hoje") return day === today;
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - (PERIOD_DAYS[period] - 1) * DAY_MS)
    .toISOString().slice(0, 10);
  return day >= from && day <= today;
}
