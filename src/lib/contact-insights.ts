export interface InsightContact {
  id: string;
  nome: string;
  created_at: string;
  data_nascimento: string | null;
  profissao: string | null;
  origem: string | null;
  source_provider?: string | null;
}

export interface InsightProcess {
  cliente_id: string | null;
  status: string | null;
}

export interface ContactInsights {
  total: number;
  withActiveProcess: number;
  withoutActiveProcess: number;
  createdThisMonth: number;
  /** Variação percentual sobre o mês anterior; null quando o mês anterior não teve cadastros. */
  monthChangePct: number | null;
  topOrigins: Array<{ name: string; value: number }>;
  topProfessions: Array<{ name: string; value: number }>;
  ageBuckets: Array<{ name: string; value: number }>;
  birthdaysThisMonth: Array<{ id: string; nome: string; day: number }>;
}

const NOT_INFORMED = "Não informado";
const INACTIVE_STATUSES = new Set(["arquivado", "encerrado", "baixado", "extinto"]);

export const AGE_BUCKETS = [
  { name: "Até 24", max: 24 },
  { name: "25 a 34", max: 34 },
  { name: "35 a 44", max: 44 },
  { name: "45 a 54", max: 54 },
  { name: "55 a 64", max: 64 },
  { name: "65+", max: Infinity },
] as const;

export function isActiveProcess(status: string | null): boolean {
  return !INACTIVE_STATUSES.has((status ?? "").trim().toLowerCase());
}

export function ageOf(birthDate: string, now: Date): number | null {
  const [year, month, day] = birthDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  let age = now.getUTCFullYear() - year;
  const beforeBirthday = now.getUTCMonth() + 1 < month ||
    (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function ranking(values: Array<string | null>, limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim() || NOT_INFORMED;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, limit);
}

const monthKey = (iso: string) => iso.slice(0, 7);

export function summarizeContacts(
  contacts: InsightContact[],
  processes: InsightProcess[],
  now = new Date(),
): ContactInsights {
  const activeIds = new Set(
    processes.filter((p) => p.cliente_id && isActiveProcess(p.status)).map((p) => p.cliente_id as string),
  );
  const withActive = contacts.filter((c) => activeIds.has(c.id)).length;

  const thisMonth = now.toISOString().slice(0, 7);
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const createdThisMonth = contacts.filter((c) => monthKey(c.created_at) === thisMonth).length;
  const createdPrevious = contacts.filter((c) => monthKey(c.created_at) === previous).length;

  const buckets = AGE_BUCKETS.map((bucket) => ({ name: bucket.name, value: 0 }));
  for (const contact of contacts) {
    const age = contact.data_nascimento ? ageOf(contact.data_nascimento, now) : null;
    if (age === null) continue;
    buckets[AGE_BUCKETS.findIndex((bucket) => age <= bucket.max)].value += 1;
  }

  const month = now.getUTCMonth() + 1;
  const birthdays = contacts
    .filter((c) => c.data_nascimento && Number(c.data_nascimento.slice(5, 7)) === month)
    .map((c) => ({ id: c.id, nome: c.nome, day: Number((c.data_nascimento as string).slice(8, 10)) }))
    .sort((a, b) => a.day - b.day || a.nome.localeCompare(b.nome));

  return {
    total: contacts.length,
    withActiveProcess: withActive,
    withoutActiveProcess: contacts.length - withActive,
    createdThisMonth,
    monthChangePct: createdPrevious > 0
      ? Math.round(((createdThisMonth - createdPrevious) / createdPrevious) * 100)
      : null,
    topOrigins: ranking(contacts.map((c) => c.origem), 5),
    topProfessions: ranking(contacts.filter((c) => c.profissao).map((c) => c.profissao), 5),
    ageBuckets: buckets,
    birthdaysThisMonth: birthdays,
  };
}
