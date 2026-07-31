import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamMember } from "@/types/team-management";

const roleLabels = {
  owner: "Proprietário",
  admin: "Administrador",
  lawyer: "Advogado",
  assistant: "Assistente",
  finance: "Financeiro",
};
const scopeLabels = {
  tenant: "Escritório",
  team: "Equipe",
  assigned: "Atribuídos",
};

interface Props {
  members: TeamMember[];
  canManage: boolean;
  busy: boolean;
  onSuspend: (member: TeamMember) => void;
  onReactivate: (member: TeamMember) => void;
  onEdit: (member: TeamMember) => void;
}

export function MemberTable({
  members,
  canManage,
  busy,
  onSuspend,
  onReactivate,
  onEdit,
}: Props) {
  if (!members.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum membro cadastrado.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Profissional</TableHead>
          <TableHead>Perfil</TableHead>
          <TableHead>Alcance</TableHead>
          <TableHead>Status</TableHead>
          {canManage && <TableHead className="text-right">Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <p className="font-medium">{member.name}</p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </TableCell>
            <TableCell>
              {member.role ? roleLabels[member.role] : "Convidado"}
            </TableCell>
            <TableCell>
              {member.data_scope
                ? scopeLabels[member.data_scope]
                : "Aguardando aceite"}
            </TableCell>
            <TableCell>
              <Badge
                variant={member.status === "suspended"
                  ? "destructive"
                  : member.membership_id
                  ? "default"
                  : "secondary"}
              >
                {member.status === "suspended"
                  ? "Suspenso"
                  : member.membership_id
                  ? "Ativo"
                  : "Convidado"}
              </Badge>
            </TableCell>
            {canManage && (
              <TableCell className="text-right">
                {member.membership_id && member.role !== "owner" && (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onEdit(member)}
                    >
                      Editar acesso
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        member.status === "suspended"
                          ? onReactivate(member)
                          : onSuspend(member)}
                    >
                      {member.status === "suspended" ? "Reativar" : "Suspender"}
                    </Button>
                  </div>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
