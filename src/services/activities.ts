import { supabase } from "@/integrations/supabase/client";
import type {
  ActivityInsert,
  ActivityBulkInput,
  ActivityBulkResult,
  ActivityUpdate,
  ActivityUserState,
  ActivityWithUserState,
} from "@/types/activities";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const activitiesService = {
  async list(tenantId: string, userId: string): Promise<ActivityWithUserState[]> {
    const [activitiesResult, stateResult] = await Promise.all([
      supabase
        .from("tarefas")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("tarefa_user_state")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId),
    ]);

    fail(activitiesResult.error);
    fail(stateResult.error);

    const activities = activitiesResult.data ?? [];
    const processIds = [...new Set(
      activities.flatMap(activity => activity.processo_id ? [activity.processo_id] : []),
    )];
    const processResult = processIds.length
      ? await supabase
        .from("processos")
        .select("id, numero, cliente_id, cliente_nome")
        .eq("tenant_id", tenantId)
        .in("id", processIds)
      : { data: [], error: null };
    fail(processResult.error);

    const states = new Map(
      (stateResult.data ?? []).map((state) => [state.tarefa_id, state]),
    );
    const processes = new Map(
      (processResult.data ?? []).map(process => [process.id, process]),
    );

    return activities.map((activity) => ({
      ...activity,
      process: activity.processo_id && processes.has(activity.processo_id) ? {
        id: processes.get(activity.processo_id)!.id,
        number: processes.get(activity.processo_id)!.numero,
        clientId: processes.get(activity.processo_id)!.cliente_id,
        clientName: processes.get(activity.processo_id)!.cliente_nome,
      } : null,
      userState: states.get(activity.id) ?? null,
    })) as ActivityWithUserState[];
  },

  async create(input: ActivityInsert): Promise<void> {
    const { error } = await supabase.from("tarefas").insert(input);
    fail(error);
  },

  async update(
    tenantId: string,
    activityId: string,
    input: ActivityUpdate,
  ): Promise<void> {
    const { error } = await supabase
      .from("tarefas")
      .update(input)
      .eq("tenant_id", tenantId)
      .eq("id", activityId);
    fail(error);
  },

  async remove(tenantId: string, activityId: string): Promise<void> {
    const { error } = await supabase
      .from("tarefas")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", activityId);
    fail(error);
  },

  async setUserState(
    state: Pick<ActivityUserState, "tenant_id" | "tarefa_id" | "user_id"> &
      Partial<Pick<ActivityUserState, "favorita" | "lida_em">>,
  ): Promise<void> {
    const { error } = await supabase.from("tarefa_user_state").upsert(state, {
      onConflict: "tenant_id,tarefa_id,user_id",
    });
    fail(error);
  },

  async bulk(
    tenantId: string,
    userId: string,
    input: ActivityBulkInput,
  ): Promise<ActivityBulkResult> {
    const results = await Promise.allSettled(input.ids.map(async id => {
      if (input.remove) {
        await activitiesService.remove(tenantId, id);
      } else if (input.update) {
        await activitiesService.update(tenantId, id, input.update);
      }
      if (input.markReadAt) {
        await activitiesService.setUserState({
          tenant_id: tenantId,
          tarefa_id: id,
          user_id: userId,
          lida_em: input.markReadAt,
        });
      }
      return id;
    }));

    return results.reduce<ActivityBulkResult>((result, item, index) => {
      const id = input.ids[index];
      if (item.status === "fulfilled") result.succeeded.push(id);
      else result.failed.push({
        id,
        message: item.reason instanceof Error ? item.reason.message : "Operação não concluída",
      });
      return result;
    }, { succeeded: [], failed: [] });
  },
};
