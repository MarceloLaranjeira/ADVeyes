import { useQuery } from "@tanstack/react-query";
import { loadOperationalDashboard } from "@/services/operational-dashboard";

export function useOperationalDashboard(tenantId: string | null) {
  return useQuery({
    queryKey: ["operational-dashboard", tenantId],
    enabled: Boolean(tenantId),
    queryFn: () => loadOperationalDashboard(tenantId!),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

