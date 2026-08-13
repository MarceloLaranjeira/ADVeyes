import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { activitiesService } from "@/services/activities";
import type { ActivityInsert, ActivityUpdate, ActivityWithUserState } from "@/types/activities";

export function useActivities(tenantId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["activities", tenantId, userId] as const;
  const query = useQuery({
    queryKey,
    enabled: Boolean(tenantId && userId),
    queryFn: () => activitiesService.list(tenantId!, userId!),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: (input: ActivityInsert) => activitiesService.create(input),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActivityUpdate }) =>
      activitiesService.update(tenantId!, id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ActivityWithUserState[]>(queryKey);
      queryClient.setQueryData<ActivityWithUserState[]>(queryKey, (current = []) =>
        current.map(activity => activity.id === id ? { ...activity, ...input } : activity),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => activitiesService.remove(tenantId!, id),
    onSuccess: refresh,
  });
  const setUserState = useMutation({
    mutationFn: ({
      id,
      favorita,
      lidaEm,
    }: {
      id: string;
      favorita?: boolean;
      lidaEm?: string | null;
    }) =>
      activitiesService.setUserState({
        tenant_id: tenantId!,
        tarefa_id: id,
        user_id: userId!,
        ...(favorita === undefined ? {} : { favorita }),
        ...(lidaEm === undefined ? {} : { lida_em: lidaEm }),
      }),
    onMutate: async ({ id, favorita, lidaEm }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ActivityWithUserState[]>(queryKey);
      queryClient.setQueryData<ActivityWithUserState[]>(queryKey, (current = []) =>
        current.map(activity => activity.id === id ? {
          ...activity,
          userState: {
            tenant_id: tenantId!,
            tarefa_id: id,
            user_id: userId!,
            favorita: favorita ?? activity.userState?.favorita ?? false,
            lida_em: lidaEm === undefined ? activity.userState?.lida_em ?? null : lidaEm,
            updated_at: new Date().toISOString(),
          },
        } : activity),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: refresh,
  });

  return {
    activities: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
    create,
    update,
    remove,
    setUserState,
  };
}
