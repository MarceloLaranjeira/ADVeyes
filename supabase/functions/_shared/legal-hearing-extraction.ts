// Extração determinística de candidatos a audiência. O resultado nunca é
// tratado como compromisso confirmado sem revisão humana.

export interface HearingCandidate {
  type: string;
  startsAt: string;
  evidence: string;
  confidence: number;
}

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const EVENT_PATTERN = /\b(audi[êe]ncia|sess[ãa]o\s+de\s+julgamento)\b/i;
const TIME_PATTERN = /(?:\b(?:às|as)\s*)?(\d{1,2})(?::|h)(\d{2})\b/i;
const NUMERIC_DATE_PATTERN = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
const WRITTEN_DATE_PATTERN = new RegExp(
  `\\b(\\d{1,2})\\s+de\\s+(${Object.keys(MONTHS).join("|")})\\s+de\\s+(\\d{4})\\b`,
  "i",
);

function validDateParts(day: number, month: number, year: number): boolean {
  if (year < 2000 || year > 2200 || month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Extrai somente evento com data e hora explícitas. O fuso padrão é Manaus,
 * sede atual do produto; a tela de revisão permite corrigir antes de confirmar.
 */
export function extractHearingCandidate(
  text: string | null | undefined,
  timezoneOffset = "-04:00",
): HearingCandidate | null {
  const evidence = String(text ?? "").replace(/\s+/g, " ").trim();
  const event = evidence.match(EVENT_PATTERN);
  const time = evidence.match(TIME_PATTERN);
  const numericDate = evidence.match(NUMERIC_DATE_PATTERN);
  const writtenDate = evidence.match(WRITTEN_DATE_PATTERN);
  if (!event || !time || (!numericDate && !writtenDate)) return null;

  const day = Number(numericDate?.[1] ?? writtenDate?.[1]);
  const month = Number(
    numericDate?.[2] ?? MONTHS[(writtenDate?.[2] ?? "").toLocaleLowerCase("pt-BR")],
  );
  const year = Number(numericDate?.[3] ?? writtenDate?.[3]);
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (!validDateParts(day, month, year) || hour > 23 || minute > 59) return null;

  const startsAt = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${timezoneOffset}`;
  return {
    type: event[1].toLocaleLowerCase("pt-BR").startsWith("sess")
      ? "Sessão de julgamento"
      : "Audiência",
    startsAt: new Date(startsAt).toISOString(),
    evidence: evidence.slice(0, 1000),
    confidence: 0.95,
  };
}
