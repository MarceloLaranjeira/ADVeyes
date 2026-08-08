import { supabase } from "@/integrations/supabase/client";
import type {
  ActivityInsert,
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

    const states = new Map(
      (stateResult.data ?? []).map((state) => [state.tarefa_id, state]),
    );

    return (activitiesResult.data ?? []).map((activity) => ({
      ...activity,
      userState: states.get(activity.id) ?? null,
    }));
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
};
