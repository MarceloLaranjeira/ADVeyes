import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MemberFormDialog } from "@/components/equipe/MemberFormDialog";
import { MemberAccessDialog } from "@/components/equipe/MemberAccessDialog";
import { MemberProfileDialog } from "@/components/equipe/MemberProfileDialog";
import { MemberTable } from "@/components/equipe/MemberTable";
import { PermissoesPanel } from "@/components/equipe/PermissoesPanel";
import { PendingInvitations } from "@/components/equipe/PendingInvitations";
import { AccessLinkPanel } from "@/components/equipe/AccessLinkPanel";
import {
  AccessRequestHistory,
  AccessRequestsPanel,
} from "@/components/equipe/AccessRequestsPanel";
import { AccessRequestDecisionDialog } from "@/components/equipe/AccessRequestDecisionDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { usePlatformSupport } from "@/contexts/PlatformSupportContext";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useAccessRequests } from "@/hooks/useAccessRequests";
import { canManagePermissions } from "@/lib/permissions";
import { describeEdgeError } from "@/lib/edge-errors";
import { teamManagementService } from "@/services/team-management";
import { useToast } from "@/hooks/use-toast";
import type {
  InviteMemberInput,
  PendingInvitation,
  TeamDataScope,
  TeamMember,
  TeamRole,
} from "@/types/team-management";
import type { PendingAccessRequest } from "@/types/access-requests";
import { Clock, Link2, Plus, ShieldCheck, UserCheck, Users } from "lucide-react";

export default function Equipe() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const platformSupport = usePlatformSupport();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [accessMember, setAccessMember] = useState<TeamMember | null>(null);
  const [profileMember, setProfileMember] = useState<TeamMember | null>(null);
  const management = useTeamManagement(currentTenant?.tenantId ?? null);
  const canManage = currentTenant?.accessMode === "platform"
    ? platformSupport.active
    : currentTenant?.role === "owner" || currentTenant?.role === "admin";

  // Decidir quem entra e administrar a matriz individual são autoridades do
  // proprietário. Administrador continua gerindo a equipe, mas não a entrada.
  const isOwner = currentTenant?.role === "owner";
  const canManagePerms = isOwner
    ? canManagePermissions("owner")
    : false;

  const [linkOpen, setLinkOpen] = useState(false);
  const [decidingRequest, setDecidingRequest] = useState<
    PendingAccessRequest | null
  >(null);
  const accessRequests = useAccessRequests(
    currentTenant?.tenantId ?? null,
    Boolean(isOwner),
  );

  const notifyError = (error: unknown) =>
    toast({
      title: "Não foi possível concluir",
      description: describeEdgeError(error, "Tente novamente."),
      variant: "destructive",
    });

  const invite = async (
    input: Omit<InviteMemberInput, "tenantId">,
  ) => {
    if (!currentTenant) return;
    if (
      user?.email &&
      input.profile.email.trim().toLowerCase() === user.email.toLowerCase()
    ) {
      notifyError(
        new Error(
          "Seu e-mail já possui acesso ao escritório e não precisa de convite.",
        ),
      );
      return;
    }
    try {
      const result = await management.inviteMember({
        ...input,
        tenantId: currentTenant.tenantId,
      });
      setFormOpen(false);
      toast({
        title: "Convite criado",
        description: result.emailQueued
          ? "O e-mail foi colocado na fila de envio."
          : "O convite foi salvo, mas o e-mail precisa ser reenviado.",
      });
    } catch (error) {
      notifyError(error);
    }
  };

  const suspend = async (member: TeamMember) => {
    if (
      !member.membership_id ||
      !window.confirm(
        `Suspender o acesso de ${member.name}? O histórico será preservado.`,
      )
    ) return;
    try {
      await management.suspendMember(member.membership_id);
      toast({ title: "Acesso suspenso" });
    } catch (error) {
      notifyError(error);
    }
  };

  const reactivate = async (member: TeamMember) => {
    if (!member.membership_id) return;
    try {
      await management.reactivateMember(member.membership_id);
      toast({ title: "Acesso reativado" });
    } catch (error) {
      notifyError(error);
    }
  };

  const updateAccess = async (
    role: Exclude<TeamRole, "owner">,
    scope: TeamDataScope,
    teamId: string | null,
  ) => {
    if (!accessMember?.membership_id) return;
    try {
      await management.updateAccess(
        accessMember.membership_id,
        role,
        scope,
        teamId,
      );
      setAccessMember(null);
      toast({ title: "Acesso atualizado" });
    } catch (error) {
      notifyError(error);
    }
  };

  const updateProfile = async (profile: {
    name: string;
    email: string;
    phone: string | null;
    jobTitle: string | null;
    oab: string | null;
  }) => {
    if (!currentTenant || !profileMember?.membership_id) return;
    try {
      await teamManagementService.updateMemberProfile(
        currentTenant.tenantId,
        profileMember.membership_id,
        profile,
      );
      setProfileMember(null);
      await management.refresh();
      toast({ title: "Perfil atualizado" });
    } catch (error) {
      notifyError(error);
    }
  };

  const resend = async (invitation: PendingInvitation) => {
    try {
      const result = await management.resendInvitation(invitation.id);
      toast({
        title: result.emailQueued ? "Convite reenviado" : "Convite renovado",
        description: result.emailQueued
          ? "Um novo link válido por 7 dias foi enviado."
          : "O link foi renovado, mas houve falha ao enfileirar o e-mail.",
      });
    } catch (error) {
      notifyError(error);
    }
  };

  const revoke = async (invitation: PendingInvitation) => {
    if (!window.confirm(`Revogar o convite enviado para ${invitation.email}?`)) {
      return;
    }
    try {
      await management.revokeInvitation(invitation.id);
      toast({ title: "Convite revogado" });
    } catch (error) {
      notifyError(error);
    }
  };

  const decide = async (
    decision: "approve" | "reject",
    payload: {
      role?: Exclude<TeamRole, "owner">;
      dataScope?: TeamDataScope;
      teamId?: string | null;
      overrides?: Record<string, Record<string, "allow" | "deny">>;
      reason?: string | null;
    },
  ) => {
    if (!currentTenant || !decidingRequest) return;
    try {
      await accessRequests.decide({
        tenantId: currentTenant.tenantId,
        requestId: decidingRequest.id,
        decision,
        access: decision === "approve"
          ? {
            role: payload.role!,
            dataScope: payload.dataScope!,
            teamId: payload.teamId ?? null,
            overrides: payload.overrides ?? {},
          }
          : undefined,
        reason: payload.reason ?? null,
      });
      setDecidingRequest(null);
      // A aprovação cria a membership, então a lista de integrantes muda.
      await management.refresh();
      toast({
        title: decision === "approve" ? "Acesso liberado" : "Solicitação recusada",
      });
    } catch (error) {
      notifyError(error);
    }
  };

  const manageLink = async (action: "generate" | "revoke") => {
    try {
      if (action === "generate") await accessRequests.generateLink();
      else await accessRequests.revokeLink();
      toast({
        title: action === "generate" ? "Link gerado" : "Link revogado",
        description: action === "generate"
          ? "Copie agora: o endereço completo não é exibido de novo."
          : "As solicitações já decididas continuam válidas.",
      });
    } catch (error) {
      notifyError(error);
    }
  };

  const activeCount = management.members.filter(
    (member) => member.status === "active",
  ).length;
  const suspendedCount = management.members.filter(
    (member) => member.status === "suspended",
  ).length;

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight">
              Gestão de Equipe
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acessos, perfis e convites de {currentTenant?.displayName}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <Button
                variant="outline"
                onClick={() => setLinkOpen(true)}
                className="gap-2"
              >
                <Link2 className="h-4 w-4" /> Link de solicitação
              </Button>
            )}
            {canManage && (
              <Button onClick={() => setFormOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Convidar membro
              </Button>
            )}
          </div>
        </div>

        {management.error && (
          <Card className="border-destructive/40">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <p className="text-sm text-destructive">{management.error}</p>
              <Button variant="outline" onClick={() => void management.refresh()}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="flex items-center gap-4 p-5">
            <UserCheck className="h-8 w-8 text-primary" />
            <div><p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold">{activeCount}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-5">
            <Clock className="h-8 w-8 text-amber-500" />
            <div><p className="text-xs text-muted-foreground">Convites</p>
              <p className="text-2xl font-bold">{management.invitations.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-5">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <div><p className="text-xs text-muted-foreground">Suspensos</p>
              <p className="text-2xl font-bold">{suspendedCount}</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" /> Pessoas e acessos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {management.loading
              ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Carregando equipe...
                </div>
              )
              : (
                <Tabs defaultValue="members">
                  <TabsList>
                    <TabsTrigger value="members">Integrantes</TabsTrigger>
                    {isOwner && (
                      <TabsTrigger value="requests">
                        Solicitações ({accessRequests.pending.length})
                      </TabsTrigger>
                    )}
                    {canManage && (
                      <TabsTrigger value="invitations">
                        Convites ({management.invitations.length})
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="permissions">Permissões</TabsTrigger>
                    {isOwner && (
                      <TabsTrigger value="history">Histórico</TabsTrigger>
                    )}
                  </TabsList>
                  <TabsContent value="members">
                    <MemberTable
                      members={management.members}
                      canManage={canManage}
                      busy={management.mutating}
                      onSuspend={(member) => void suspend(member)}
                      onReactivate={(member) => void reactivate(member)}
                      onEdit={setAccessMember}
                      onEditProfile={setProfileMember}
                      currentUserId={user?.id ?? null}
                    />
                  </TabsContent>
                  {isOwner && (
                    <TabsContent value="requests">
                      <AccessRequestsPanel
                        pending={accessRequests.pending}
                        decided={accessRequests.decided}
                        loading={accessRequests.loading}
                        busy={accessRequests.mutating}
                        error={accessRequests.error}
                        onDecide={setDecidingRequest}
                        onRetry={() => void accessRequests.refresh()}
                      />
                    </TabsContent>
                  )}
                  {isOwner && (
                    <TabsContent value="history">
                      <AccessRequestHistory
                        decided={accessRequests.decided}
                        loading={accessRequests.loading}
                      />
                    </TabsContent>
                  )}
                  {canManage && (
                    <TabsContent value="invitations">
                      <PendingInvitations
                        invitations={management.invitations}
                        busy={management.mutating}
                        onResend={(invitation) => void resend(invitation)}
                        onRevoke={(invitation) => void revoke(invitation)}
                      />
                    </TabsContent>
                  )}
                  <TabsContent value="permissions">
                    <PermissoesPanel
                      tenantId={currentTenant.tenantId}
                      members={management.members}
                      canManage={canManagePerms}
                      onChanged={() => void management.refresh()}
                    />
                  </TabsContent>
                </Tabs>
              )}
          </CardContent>
        </Card>
      </div>

      <MemberFormDialog
        open={formOpen}
        teams={management.teams}
        busy={management.mutating}
        onOpenChange={setFormOpen}
        onSubmit={invite}
      />
      <MemberAccessDialog
        member={accessMember}
        teams={management.teams}
        busy={management.mutating}
        onOpenChange={(open) => {
          if (!open) setAccessMember(null);
        }}
        onSubmit={updateAccess}
      />
      <MemberProfileDialog
        member={profileMember}
        busy={management.mutating}
        onOpenChange={(open) => {
          if (!open) setProfileMember(null);
        }}
        onSubmit={updateProfile}
      />
      <AccessLinkPanel
        open={linkOpen}
        link={accessRequests.link}
        busy={accessRequests.mutating}
        onOpenChange={setLinkOpen}
        onGenerate={() => manageLink("generate")}
        onRevoke={() => manageLink("revoke")}
      />
      <AccessRequestDecisionDialog
        request={decidingRequest}
        teams={management.teams}
        busy={accessRequests.mutating}
        onOpenChange={(open) => {
          if (!open) setDecidingRequest(null);
        }}
        onApprove={(input) => decide("approve", input)}
        onReject={(reason) => decide("reject", { reason })}
      />
    </AppLayout>
  );
}
