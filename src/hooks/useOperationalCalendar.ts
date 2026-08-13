import { useQuery } from "@tanstack/react-query";
import { loadOperationalCalendar } from "@/services/operational-calendar";
import type { OperationalCalendarScope } from "@/types/operational-calendar";

export function useOperationalCalendar(
  tenantId: string | null,
  range?: { from: Date; to: Date },
  options?: { scope?: OperationalCalendarScope; userId?: string | null },
) {
  const from = range?.from.toISOString();
  const to = range?.to.toISOString();
  const scope = options?.scope ?? "office";
  const userId = options?.userId ?? null;
  const query = useQuery({
    queryKey: ["operational-calendar", tenantId, scope, userId, from, to],
    enabled: Boolean(tenantId),
    queryFn: () => loadOperationalCalendar({
      tenantId: tenantId!,
      scope,
      userId,
      range: from && to ? { from: new Date(from), to: new Date(to) } : undefined,
    }),
  });

  return {
    ...query,
    events: query.data?.events ?? [],
    tasks: query.data?.tasks ?? [],
    hearings: query.data?.hearings ?? [],
    members: query.data?.members ?? [],
    items: query.data?.items ?? [],
    failures: query.data?.failures ?? [],
  };
}
