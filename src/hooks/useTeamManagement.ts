import { useCallback, useEffect, useRef, useState } from "react";
import { teamManagementService } from "@/services/team-management";
import type {
  InviteMemberInput,
  TeamDataScope,
  TeamOverview,
  TeamRole,
} from "@/types/team-management";

const emptyOverview: TeamOverview = {
  members: [],
  invitations: [],
  teams: [],
};

export function useTeamManagement(tenantId: string | null) {
  const [overview, setOverview] = useState<TeamOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!tenantId) {
      setOverview(emptyOverview);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await teamManagementService.overview(tenantId);
      if (currentRequest === requestId.current) {
        setOverview(data);
        setError(null);
      }
    } catch (caught) {
      if (currentRequest === requestId.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar a equipe.",
        );
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const mutate = useCallback(async <T>(operation: () => Promise<T>) => {
    setMutating(true);
    try {
      const result = await operation();
      await refresh();
      return result;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  return {
    ...overview,
    loading,
    mutating,
    error,
    refresh,
    inviteMember: (input: InviteMemberInput) =>
      mutate(() => teamManagementService.inviteMember(input)),
    suspendMember: (membershipId: string) =>
      mutate(() =>
        teamManagementService.suspendMember(tenantId!, membershipId)
      ),
    reactivateMember: (membershipId: string) =>
      mutate(() =>
        teamManagementService.reactivateMember(tenantId!, membershipId)
      ),
    updateAccess: (
      membershipId: string,
      role: Exclude<TeamRole, "owner">,
      scope: TeamDataScope,
      teamId?: string | null,
    ) =>
      mutate(() =>
        teamManagementService.updateMemberAccess(
          tenantId!,
          membershipId,
          role,
          scope,
          teamId,
        )
      ),
    resendInvitation: (invitationId: string) =>
      mutate(() =>
        teamManagementService.resendInvitation(tenantId!, invitationId)
      ),
    revokeInvitation: (invitationId: string) =>
      mutate(() =>
        teamManagementService.revokeInvitation(tenantId!, invitationId)
      ),
  };
}
