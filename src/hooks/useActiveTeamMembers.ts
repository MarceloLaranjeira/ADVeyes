import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ActivityTeamMember } from "@/types/activities";

export function useActiveTeamMembers(tenantId: string | null) {
  return useQuery({
    queryKey: ["active-team-members", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<ActivityTeamMember[]> => {
      const { data, error } = await supabase
        .from("equipe")
        .select("id, user_id, nome, avatar_url, cargo")
        .eq("tenant_id", tenantId!)
        .eq("ativo", true)
        .not("user_id", "is", null)
        .order("nome");

      if (error) throw new Error(error.message);

      return (data ?? []).map((member) => ({
        id: member.id,
        userId: member.user_id!,
        name: member.nome,
        avatarUrl: member.avatar_url,
        jobTitle: member.cargo,
      }));
    },
  });
}
