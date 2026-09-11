import { useCallback, useEffect, useRef, useState } from "react";
import { accessRequestService } from "@/services/access-requests";
import { describeEdgeError } from "@/lib/edge-errors";
import type {
  AccessDecisionInput,
  AccessLinkState,
  AccessRequestsOverview,
} from "@/types/access-requests";

const emptyOverview: AccessRequestsOverview = { pending: [], decided: [] };

/**
 * Solicitações e link privado do escritório.
 *
 * Só carrega quando quem está na tela é o proprietário: para os demais perfis
 * a Edge Function recusaria a leitura, e insistir só geraria erro na interface.
 */
export function useAccessRequests(tenantId: string | null, enabled: boolean) {
  const [overview, setOverview] = useState<AccessRequestsOverview>(
    emptyOverview,
  );
  const [link, setLink] = useState<AccessLinkState>({ exists: false });
  const [loading, setLoading] = useState(enabled);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    if (!tenantId || !enabled) {
      setOverview(emptyOverview);
      setLink({ exists: false });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [requests, currentLink] = await Promise.all([
        accessRequestService.list(tenantId),
        accessRequestService.readLink(tenantId),
      ]);
      if (current === requestId.current) {
        setOverview(requests ?? emptyOverview);
        setLink(currentLink ?? { exists: false });
        setError(null);
      }
    } catch (caught) {
      if (current === requestId.current) {
        setError(
          describeEdgeError(
            caught,
            "Não foi possível carregar as solicitações.",
          ),
        );
      }
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [enabled, tenantId]);

  useEffect(() => {
    void refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const mutate = useCallback(async <T>(operation: () => Promise<T>) => {
    setMutating(true);
    try {
      return await operation();
    } finally {
      setMutating(false);
    }
  }, []);

  return {
    ...overview,
    link,
    loading,
    mutating,
    error,
    refresh,
    decide: (input: AccessDecisionInput) =>
      mutate(async () => {
        const result = await accessRequestService.decide(input);
        await refresh();
        return result;
      }),
    generateLink: () =>
      mutate(async () => {
        const result = await accessRequestService.generateLink(tenantId!);
        // O token em claro só chega aqui; guardamos para exibir uma única vez.
        setLink(result);
        return result;
      }),
    revokeLink: () =>
      mutate(async () => {
        const result = await accessRequestService.revokeLink(tenantId!);
        await refresh();
        return result;
      }),
  };
}
