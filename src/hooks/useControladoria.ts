import { useQuery } from "@tanstack/react-query";
import { useActiveTeamMembers } from "@/hooks/useActiveTeamMembers";
import { fetchControladoria } from "@/services/controladoria";

export function useControladoria(tenantId: string | null, periodDays = 7) {
  const membersQuery = useActiveTeamMembers(tenantId);

  return useQuery({
    queryKey: ["controladoria", tenantId, periodDays, membersQuery.data],
    enabled: Boolean(tenantId) && !membersQuery.isLoading,
    queryFn: () => fetchControladoria(tenantId!, periodDays, membersQuery.data ?? []),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
