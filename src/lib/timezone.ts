export const DEFAULT_ZONE = "America/Manaus";

/** Os quatro fusos do Brasil; Cuiabá, Campo Grande, Porto Velho e Boa Vista seguem Manaus. */
export const BRAZIL_ZONES = [
  { id: "America/Manaus", name: "Manaus", detail: "AM, MT, MS, RO, RR · UTC−4" },
  { id: "America/Sao_Paulo", name: "Brasília", detail: "SP, RJ, MG, DF, sul e nordeste · UTC−3" },
  { id: "America/Rio_Branco", name: "Rio Branco", detail: "AC e sudoeste do AM · UTC−5" },
  { id: "America/Noronha", name: "Fernando de Noronha", detail: "UTC−2" },
] as const;

export const zoneName = (zone: string): string =>
  BRAZIL_ZONES.find((item) => item.id === zone)?.name ?? zone;

export const isKnownZone = (value: unknown): value is string =>
  typeof value === "string" && BRAZIL_ZONES.some((item) => item.id === value);

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsInZone(instant: Date, zone: string): Parts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => Number(formatted.find((part) => part.type === type)?.value);
  return {
    year: read("year"), month: read("month"), day: read("day"),
    hour: read("hour"), minute: read("minute"), second: read("second"),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Instante em "AAAA-MM-DDTHH:mm", como o campo datetime-local espera, no fuso dado. */
export function isoToInput(iso: string, zone: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const p = partsInZone(instant, zone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Relógio de parede ("AAAA-MM-DDTHH:mm") em um fuso vira o instante UTC correspondente. */
export function inputToIso(input: string, zone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallClock;
  // Duas passagens cobrem a troca de horário de verão, caso um fuso volte a tê-la.
  for (let pass = 0; pass < 2; pass += 1) {
    const p = partsInZone(new Date(instant), zone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    instant += wallClock - shown;
  }
  return new Date(instant).toISOString();
}

export interface ZonedLabel {
  /** "03/11/2026 às 09:00" ou "03/11/2026" quando só a data é conhecida. */
  text: string;
  hasTime: boolean;
}

/** Data e hora no fuso; 00:00 de uma audiência importada significa "horário não informado". */
export function formatInZone(iso: string, zone: string, dateOnlyWhenMidnight = false): ZonedLabel {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return { text: "—", hasTime: false };
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "2-digit", month: "2-digit", year: "numeric" }).format(instant);
  const p = partsInZone(instant, zone);
  if (dateOnlyWhenMidnight && p.hour === 0 && p.minute === 0) return { text: date, hasTime: false };
  return { text: `${date} às ${pad(p.hour)}:${pad(p.minute)}`, hasTime: true };
}
