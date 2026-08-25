import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";
import type {
  InviteMemberInput,
  TeamDataScope,
  TeamOverview,
  TeamRole,
} from "@/types/team-management";
import type { PermissionOverrides } from "@/lib/permissions";
import { EdgeFunctionError, readEdgeError } from "@/lib/edge-errors";

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
  owner_required: "Somente o proprietário pode fazer isso.",
  forbidden_override:
    "As autoridades do proprietário não podem ser concedidas a outra pessoa.",
  request_not_found: "A solicitação não foi encontrada.",
  request_not_pending: "Esta solicitação já foi decidida.",
  already_member: "Esta pessoa já faz parte do escritório.",
  invalid_token: "Este link de solicitação não é válido.",
  revoked_token: "Este link foi revogado. Peça um link novo ao escritório.",
  link_not_found: "Este escritório ainda não tem um link de solicitação.",
  invalid_role: "Escolha um perfil válido.",
  invalid_data_scope: "Escolha um alcance de dados válido.",
  team_required: "Selecione a equipe para o alcance escolhido.",
  invalid_team: "A equipe selecionada não está disponível.",
  operation_failed: "Não foi possível concluir a operação.",
};

export class TeamManagementError extends EdgeFunctionError {
  constructor(code: string, diagnosticId: string | null = null) {
    super(code, messages, diagnosticId);
    this.name = "TeamManagementError";
  }
}

export { messages as teamManagementMessages };

async function invoke<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke(functionName, { body }),
    15_000,
  );
  if (error) {
    const { code, diagnosticId } = await readEdgeError(error);
    throw new TeamManagementError(code, diagnosticId);
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
