import { useQuery } from "@tanstack/react-query";
import { loadOperationalCalendar } from "@/services/operational-calendar";

export function useOperationalCalendar(
  tenantId: string | null,
  range?: { from: Date; to: Date },
) {
  const from = range?.from.toISOString();
  const to = range?.to.toISOString();
  const query = useQuery({
    queryKey: ["operational-calendar", tenantId, from, to],
    enabled: Boolean(tenantId),
    queryFn: () => loadOperationalCalendar(
      tenantId!,
      new Date(),
      from && to ? { from: new Date(from), to: new Date(to) } : undefined,
    ),
  });

  return {
    ...query,
    events: query.data?.events ?? [],
    tasks: query.data?.tasks ?? [],
    hearings: query.data?.hearings ?? [],
    items: query.data?.items ?? [],
  };
}
