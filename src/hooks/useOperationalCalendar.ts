import { useQuery } from "@tanstack/react-query";
import { loadOperationalCalendar } from "@/services/operational-calendar";

export function useOperationalCalendar(tenantId: string | null) {
  const query = useQuery({
    queryKey: ["operational-calendar", tenantId],
    enabled: Boolean(tenantId),
    queryFn: () => loadOperationalCalendar(tenantId!),
  });

  return {
    ...query,
    events: query.data?.events ?? [],
    tasks: query.data?.tasks ?? [],
    hearings: query.data?.hearings ?? [],
    items: query.data?.items ?? [],
  };
}
