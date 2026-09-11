import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  editablePermissions,
  overrideState,
  ROLE_LABELS,
  setOverrideState,
  type PermissionOverrides,
  type PermissionOverrideState,
} from "@/lib/permissions";
import type { PendingAccessRequest } from "@/types/access-requests";
import type {
  TeamDataScope,
  TeamRole,
  TenantTeam,
} from "@/types/team-management";

type AssignableRole = Exclude<TeamRole, "owner">;

const ASSIGNABLE_ROLES: AssignableRole[] = [
  "admin",
  "lawyer",
  "assistant",
  "finance",
];

const SCOPE_LABELS: Record<TeamDataScope, string> = {
  tenant: "Todo o escritório",
  team: "Apenas a equipe",
  assigned: "Apenas o que for atribuído",
};

interface Props {
  request: PendingAccessRequest | null;
  teams: TenantTeam[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (input: {
    role: AssignableRole;
    dataScope: TeamDataScope;
    teamId: string | null;
    overrides: PermissionOverrides;
  }) => Promise<void>;
  onReject: (reason: string | null) => Promise<void>;
}

/**
 * Decisão do proprietário. Perfil, alcance e exceções saem daqui numa única
 * operação: o banco aplica tudo na mesma transação ou nada.
 */
export function AccessRequestDecisionDialog({
  request,
  teams,
  busy,
  onOpenChange,
  onApprove,
  onReject,
}: Props) {
  const [role, setRole] = useState<AssignableRole>("lawyer");
  const [dataScope, setDataScope] = useState<TeamDataScope>("assigned");
  const [teamId, setTeamId] = useState<string>("");
  const [overrides, setOverrides] = useState<PermissionOverrides>({});
  const [reason, setReason] = useState("");

  // Cada solicitação começa com a decisão em branco.
  useEffect(() => {
    if (!request) return;
    setRole("lawyer");
    setDataScope("assigned");
    setTeamId("");
    setOverrides({});
    setReason("");
  }, [request]);

  const rows = editablePermissions();
  const teamMissing = dataScope === "team" && !teamId;

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Decidir acesso de {request?.name}</DialogTitle>
          <DialogDescription>
            {request?.email}
            {request?.oab ? ` - OAB ${request.oab}` : ""}
            {request?.phone ? ` - ${request.phone}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="decisao-perfil">Perfil</Label>
              <Select
                value={role}
                onValueChange={(value: AssignableRole) => setRole(value)}
              >
                <SelectTrigger id="decisao-perfil">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="decisao-alcance">Alcance dos dados</Label>
              <Select
                value={dataScope}
                onValueChange={(value: TeamDataScope) => {
                  setDataScope(value);
                  if (value !== "team") setTeamId("");
                }}
              >
                <SelectTrigger id="decisao-alcance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCOPE_LABELS) as TeamDataScope[]).map((item) => (
                    <SelectItem key={item} value={item}>
                      {SCOPE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {dataScope === "team" && (
            <div className="space-y-2 sm:max-w-sm">
              <Label htmlFor="decisao-equipe">Equipe</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger id="decisao-equipe">
                  <SelectValue placeholder="Selecione a equipe" />
                </SelectTrigger>
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

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Permissões específicas</h3>
            <p className="text-xs text-muted-foreground">
              “Herdar” usa a regra do perfil escolhido. Use “Permitir” ou “Negar”
              apenas onde esta pessoa precisa fugir da regra.
            </p>
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={`${row.module}.${row.action}`}
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{row.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {row.description}
                    </span>
                  </span>
                  <Select
                    value={overrideState(overrides, row)}
                    onValueChange={(value: PermissionOverrideState) =>
                      setOverrides((current) =>
                        setOverrideState(current, row, value)
                      )}
                  >
                    <SelectTrigger className="w-[130px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Herdar</SelectItem>
                      <SelectItem value="allow">Permitir</SelectItem>
                      <SelectItem value="deny">Negar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="decisao-motivo">Motivo da recusa (opcional)</Label>
            <Textarea
              id="decisao-motivo"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Fica registrado na auditoria e explica a recusa."
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void onReject(reason.trim() || null)}
            >
              Recusar
            </Button>
            <Button
              disabled={busy || teamMissing}
              onClick={() =>
                void onApprove({
                  role,
                  dataScope,
                  teamId: dataScope === "team" ? teamId : null,
                  overrides,
                })}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aprovar acesso
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
