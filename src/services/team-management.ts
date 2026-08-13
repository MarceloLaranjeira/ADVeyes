import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";
import type {
  InviteMemberInput,
  TeamDataScope,
  TeamOverview,
  TeamRole,
} from "@/types/team-management";
import type { PermissionOverrides } from "@/lib/permissions";

const messages: Record<string, string> = {
  unauthorized: "Sua sessão expirou. Entre novamente.",
  permission_denied: "Você não tem permissão para gerenciar esta equipe.",
  member_already_active: "Este e-mail já possui acesso ativo ao escritório.",
  member_not_found: "O membro não foi encontrado.",
  owner_requires_transfer:
    "O proprietário não pode ser alterado sem transferir a propriedade.",
  invitation_not_found: "O convite não foi encontrado.",
  invitation_not_pending: "Este convite já foi usado, revogado ou expirou.",
  invalid_invitation: "O convite é inválido.",
  invitation_expired: "O convite expirou. Peça um novo convite.",
  invitation_unavailable: "Este convite não está mais disponível.",
  email_mismatch: "Entre com exatamente o e-mail que recebeu o convite.",
  already_accepted: "Este convite já foi aceito.",
  invalid_payload: "Confira os dados informados.",
  invalid_profile: "Confira os dados do perfil.",
  owner_required_for_subscription:
    "Somente o proprietário pode liberar a alteração do plano.",
  pilot_seat_limit:
    "Durante o teste gratuito, o escritório pode ter o proprietário e mais uma pessoa.",
  operation_failed: "Não foi possível concluir a operação.",
};

export class TeamManagementError extends Error {
  constructor(public readonly code: string) {
    super(messages[code] ?? messages.operation_failed);
    this.name = "TeamManagementError";
  }
}

async function invoke<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke(functionName, { body }),
    15_000,
  );
  if (error) {
    let code = "operation_failed";
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: string };
        code = payload.error ?? code;
      } catch {
        // The stable fallback intentionally hides infrastructure details.
      }
    }
    throw new TeamManagementError(code);
  }
  return data as T;
}

export const teamManagementService = {
  overview: (tenantId: string) =>
    invoke<TeamOverview>("tenant-manage-invitation", {
      tenantId,
      action: "overview",
    }),

  /** Exceções vigentes por membro, indexadas pelo id do vínculo. */
  readPermissions: (tenantId: string) =>
    invoke<{ permissions: Record<string, PermissionOverrides> }>(
      "tenant-manage-member",
      { tenantId, action: "read_permissions" },
    ),

  updateMemberPermissions: (
    tenantId: string,
    membershipId: string,
    permissions: PermissionOverrides,
  ) =>
    invoke("tenant-manage-member", {
      tenantId,
      membershipId,
      action: "update_permissions",
      permissions,
    }),

  updateMemberProfile: (
    tenantId: string,
    membershipId: string,
    profile: {
      name: string;
      email: string;
      phone?: string | null;
      jobTitle?: string | null;
      oab?: string | null;
      avatarUrl?: string | null;
    },
  ) =>
    invoke("tenant-manage-member", {
      tenantId,
      membershipId,
      action: "update_profile",
      profile,
    }),

  inviteMember: (input: InviteMemberInput) =>
    invoke<{
      invitationId: string;
      memberId: string;
      emailQueued: boolean;
      expiresAt: string;
    }>("tenant-invite-member", input as unknown as Record<string, unknown>),

  updateMemberAccess: (
    tenantId: string,
    membershipId: string,
    role: Exclude<TeamRole, "owner">,
    dataScope: TeamDataScope,
    teamId?: string | null,
  ) =>
    invoke("tenant-manage-member", {
      tenantId,
      membershipId,
      action: "update_access",
      role,
      dataScope,
      teamId: teamId ?? null,
    }),

  suspendMember: (tenantId: string, membershipId: string) =>
    invoke("tenant-manage-member", {
      tenantId,
      membershipId,
      action: "suspend",
    }),

  reactivateMember: (tenantId: string, membershipId: string) =>
    invoke("tenant-manage-member", {
      tenantId,
      membershipId,
      action: "reactivate",
    }),

  resendInvitation: (tenantId: string, invitationId: string) =>
    invoke<{ emailQueued: boolean }>("tenant-manage-invitation", {
      tenantId,
      invitationId,
      action: "resend",
    }),

  revokeInvitation: (tenantId: string, invitationId: string) =>
    invoke("tenant-manage-invitation", {
      tenantId,
      invitationId,
      action: "revoke",
    }),

  acceptInvitation: (token: string) =>
    invoke<{ tenant_id: string; membership_id: string }>(
      "tenant-accept-invite",
      { token },
    ),
};
