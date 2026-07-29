import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MemberFormDialog } from "@/components/equipe/MemberFormDialog";
import { MemberAccessDialog } from "@/components/equipe/MemberAccessDialog";
import { MemberTable } from "@/components/equipe/MemberTable";
import { PendingInvitations } from "@/components/equipe/PendingInvitations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/contexts/TenantContext";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useToast } from "@/hooks/use-toast";
import type {
  InviteMemberInput,
  PendingInvitation,
  TeamDataScope,
  TeamMember,
  TeamRole,
} from "@/types/team-management";
import { Clock, Plus, ShieldCheck, UserCheck, Users } from "lucide-react";

export default function Equipe() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [accessMember, setAccessMember] = useState<TeamMember | null>(null);
  const management = useTeamManagement(currentTenant?.tenantId ?? null);
  const canManage = currentTenant?.role === "owner" ||
    currentTenant?.role === "admin";

  const notifyError = (error: unknown) =>
    toast({
      title: "Não foi possível concluir",
      description: error instanceof Error ? error.message : "Tente novamente.",
      variant: "destructive",
    });

  const invite = async (
    input: Omit<InviteMemberInput, "tenantId">,
  ) => {
    if (!currentTenant) return;
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
          {canManage && (
            <Button onClick={() => setFormOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Convidar membro
            </Button>
          )}
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
                    <TabsTrigger value="members">Membros</TabsTrigger>
                    {canManage && (
                      <TabsTrigger value="invitations">
                        Convites ({management.invitations.length})
                      </TabsTrigger>
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
                    />
                  </TabsContent>
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
    </AppLayout>
  );
}
