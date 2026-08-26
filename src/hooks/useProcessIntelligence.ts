import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { processIntelligenceService } from "@/services/process-intelligence";
import type { ProcessIntelligenceManualOverride } from "@/types/process-intelligence";

/**
 * `incluirArquivados` existe para a tela de detalhe.
 *
 * A listagem quer a carteira ativa; a tela de UM processo quer aquele
 * processo, arquivado ou não. Sem esta opção, abrir um processo arquivado
 * fazia o painel de inteligência não achar o item e anunciar "ainda não foi
 * analisado" — informação falsa sobre um processo que tem análise.
 *
 * A chave da query inclui a opção: as duas variantes são caches distintos e
 * não se sobrescrevem.
 */
export function useProcessIntelligence(
  tenantId: string | null,
  { incluirArquivados = false }: { incluirArquivados?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const queryKey = ["process-intelligence", tenantId, incluirArquivados] as const;
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const query = useQuery({
    queryKey,
    enabled: Boolean(tenantId),
    queryFn: () => processIntelligenceService.list(tenantId!, { incluirArquivados }),
    staleTime: 30_000,
  });
  const analyze = useMutation({ mutationFn: (processId: string) => processIntelligenceService.analyze(tenantId!, processId), onSuccess: refresh });
  const backfill = useMutation({ mutationFn: () => processIntelligenceService.backfill(tenantId!), onSuccess: refresh });
  const correct = useMutation({
    mutationFn: ({ processId, correction, justification }: { processId: string; correction: ProcessIntelligenceManualOverride; justification: string }) => processIntelligenceService.correct(tenantId!, processId, correction, justification),
    onSuccess: refresh,
  });
  return { items: query.data ?? [], loading: query.isLoading, error: query.error, refetch: query.refetch, analyze, backfill, correct };
}
