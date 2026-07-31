import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  TeamDataScope,
  TeamMember,
  TeamRole,
  TenantTeam,
} from "@/types/team-management";

interface Props {
  member: TeamMember | null;
  teams: TenantTeam[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    role: Exclude<TeamRole, "owner">,
    scope: TeamDataScope,
    teamId: string | null,
  ) => Promise<void>;
}

export function MemberAccessDialog({
  member,
  teams,
  busy,
  onOpenChange,
  onSubmit,
}: Props) {
  const [role, setRole] =
    useState<Exclude<TeamRole, "owner">>("lawyer");
  const [scope, setScope] = useState<TeamDataScope>("assigned");
  const [teamId, setTeamId] = useState("");

  useEffect(() => {
    if (!member) return;
    setRole(member.role === "owner" || !member.role ? "lawyer" : member.role);
    setScope(member.data_scope ?? "assigned");
    setTeamId(member.team_id ?? "");
  }, [member]);

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar acesso de {member?.name}</DialogTitle>
          <DialogDescription>
            Ajuste o perfil e quais dados este usuário poderá consultar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(value) =>
              setRole(value as Exclude<TeamRole, "owner">)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="lawyer">Advogado</SelectItem>
                <SelectItem value="assistant">Assistente</SelectItem>
                <SelectItem value="finance">Financeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Alcance</Label>
            <Select value={scope} onValueChange={(value) =>
              setScope(value as TeamDataScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="assigned">Somente atribuídos</SelectItem>
                <SelectItem value="team">Equipe definida</SelectItem>
                <SelectItem value="tenant">Todo o escritório</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "team" && (
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {teams.filter((team) => team.active).map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={busy || (scope === "team" && !teamId)}
              onClick={() =>
                void onSubmit(
                  role,
                  scope,
                  scope === "team" ? teamId : null,
                )}
            >
              {busy ? "Salvando..." : "Salvar acesso"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
