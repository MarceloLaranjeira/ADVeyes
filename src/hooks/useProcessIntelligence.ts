import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { processIntelligenceService } from "@/services/process-intelligence";
import type { ProcessIntelligenceManualOverride } from "@/types/process-intelligence";

export function useProcessIntelligence(tenantId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["process-intelligence", tenantId] as const;
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const query = useQuery({ queryKey, enabled: Boolean(tenantId), queryFn: () => processIntelligenceService.list(tenantId!), staleTime: 30_000 });
  const analyze = useMutation({ mutationFn: (processId: string) => processIntelligenceService.analyze(tenantId!, processId), onSuccess: refresh });
  const backfill = useMutation({ mutationFn: () => processIntelligenceService.backfill(tenantId!), onSuccess: refresh });
  const correct = useMutation({
    mutationFn: ({ processId, correction, justification }: { processId: string; correction: ProcessIntelligenceManualOverride; justification: string }) => processIntelligenceService.correct(tenantId!, processId, correction, justification),
    onSuccess: refresh,
  });
  return { items: query.data ?? [], loading: query.isLoading, error: query.error, refetch: query.refetch, analyze, backfill, correct };
}
