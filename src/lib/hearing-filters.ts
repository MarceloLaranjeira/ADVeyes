export interface HearingFilterable {
  id: string;
  tipo: string;
  data_hora: string;
  status: string;
  processo_numero?: string | null;
  cliente_nome?: string | null;
  vara?: string | null;
  court_code?: string | null;
}

export interface HearingFilters {
  query: string;
  period: "future" | "7" | "30" | "custom" | "all";
  from: string;
  to: string;
  status: string;
  type: string;
  court: string;
}

export const defaultHearingFilters: HearingFilters = {
  query: "",
  period: "future",
  from: "",
  to: "",
  status: "all",
  type: "all",
  court: "all",
};

const dayEnd = (date: string) => new Date(`${date}T23:59:59.999`).getTime();
const dayStart = (date: string) => new Date(`${date}T00:00:00`).getTime();

export function filterHearings<T extends HearingFilterable>(
  hearings: T[],
  filters: HearingFilters,
  now = new Date(),
): T[] {
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");
  const nowMs = now.getTime();
  const periodEnd = filters.period === "7"
    ? nowMs + 7 * 86_400_000
    : filters.period === "30" ? nowMs + 30 * 86_400_000 : null;

  return hearings.filter((hearing) => {
    const startsAt = new Date(hearing.data_hora).getTime();
    if (!Number.isFinite(startsAt)) return false;
    if (filters.period === "future" && startsAt < nowMs) return false;
    if ((filters.period === "7" || filters.period === "30") && (startsAt < nowMs || startsAt > periodEnd!)) return false;
    if (filters.period === "custom") {
      if (filters.from && startsAt < dayStart(filters.from)) return false;
      if (filters.to && startsAt > dayEnd(filters.to)) return false;
    }
    if (filters.status !== "all" && hearing.status !== filters.status) return false;
    if (filters.type !== "all" && hearing.tipo !== filters.type) return false;
    if (filters.court !== "all" && (hearing.court_code ?? "Não informado") !== filters.court) return false;
    if (!query) return true;
    return [hearing.tipo, hearing.processo_numero, hearing.cliente_nome, hearing.vara, hearing.court_code, hearing.status]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query));
  }).sort((left, right) => left.data_hora.localeCompare(right.data_hora));
}

export function paginateHearings<T>(items: T[], requestedPage: number, pageSize = 25) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages,
  };
}
