import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  editablePermissions,
  overrideState,
  PERMISSION_GROUPS,
  permissionLevel,
  ROLE_LABELS,
  ROLE_ORDER,
  setOverrideState,
  type PermissionOverrideState,
  type PermissionOverrides,
} from "@/lib/permissions";
import {
  TeamManagementError,
  teamManagementService,
} from "@/services/team-management";
import type { TeamMember, TeamRole } from "@/types/team-management";
import { Check, Loader2, Minus, ShieldCheck } from "lucide-react";

interface Props {
  tenantId: string;
  members: TeamMember[];
  canManage: boolean;
  onChanged: () => void;
}

export function PermissoesPanel({
  tenantId,
  members,
  canManage,
  onChanged,
}: Props) {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, PermissionOverrides>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<PermissionOverrides>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const eligible = useMemo(
    () =>
      members.filter(
        (member) => member.membership_id && member.role && member.role !== "owner",
      ),
    [members],
  );

  const selected = eligible.find(
    (member) => member.membership_id === selectedId,
  ) ?? null;
  const selectedRole = (selected?.role ?? "lawyer") as TeamRole;
  const editableRows = selected ? editablePermissions() : [];

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await teamManagementService.readPermissions(tenantId);
      setOverrides(result.permissions ?? {});
    } catch (error) {
      toast({
        title: "Não foi possível carregar as permissões",
        description: error instanceof TeamManagementError
          ? error.message
          : undefined,
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [canManage, tenantId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    setDraft(overrides[selectedId] ?? {});
  }, [overrides, selectedId]);

  const handleSave = async () => {
    if (!selected?.membership_id) return;
    setSaving(true);
    try {
      await teamManagementService.updateMemberPermissions(
        tenantId,
        selected.membership_id,
        draft,
      );
      toast({ title: "Permissões atualizadas" });
      await load();
      onChanged();
    } catch (error) {
      toast({
        title: "Não foi possível salvar",
        description: error instanceof TeamManagementError
          ? error.message
          : undefined,
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            O que cada perfil pode fazer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Estas regras são aplicadas no banco de dados, não apenas na tela.
            Somente o proprietário pode manter a regra do perfil, permitir ou
            negar cada acesso por pessoa.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left font-medium">Ação</th>
                      {ROLE_ORDER.map((role) => (
                        <th key={role} className="px-2 py-2 text-center font-medium">
                          {ROLE_LABELS[role]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={`${row.module}.${row.action}`} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <span className="font-medium">{row.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.description}
                          </span>
                        </td>
                        {ROLE_ORDER.map((role) => {
                          const level = permissionLevel(row, role);
                          return (
                            <td key={role} className="px-2 py-2 text-center">
                              {level === "sempre" && (
                                <Check
                                  className="mx-auto h-4 w-4 text-emerald-600"
                                  aria-label="Permitido"
                                />
                              )}
                              {level === "excecao" && (
                                <Badge variant="outline" className="text-[10px]">
                                  exceção
                                </Badge>
                              )}
                              {level === "nunca" && (
                                <Minus
                                  className="mx-auto h-4 w-4 text-muted-foreground/40"
                                  aria-label="Não permitido"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permissões por pessoa</CardTitle>
          <p className="text-sm text-muted-foreground">
            “Herdar” usa a regra do perfil. “Permitir” libera individualmente e
            “Negar” bloqueia mesmo quando o perfil permitiria o acesso.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManage && (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Somente o proprietário pode alterar permissões.
            </p>
          )}

          <div className="space-y-2 sm:max-w-sm">
            <Label htmlFor="membro-permissao">Membro</Label>
            <Select
              value={selectedId}
              onValueChange={setSelectedId}
              disabled={!canManage || loading || eligible.length === 0}
            >
              <SelectTrigger id="membro-permissao">
                <SelectValue placeholder="Selecione um membro" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((member) => (
                  <SelectItem
                    key={member.membership_id!}
                    value={member.membership_id!}
                  >
                    {member.name} — {ROLE_LABELS[member.role as TeamRole]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eligible.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground">
                O proprietário já tem acesso total e não recebe exceções.
              </p>
            )}
          </div>

          {selected && (
            editableRows.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Não há permissões individuais disponíveis para este membro.
              </p>
            ) : (
              <div className="space-y-2">
                {editableRows.map((row) => (
                  <div
                    key={`${row.module}.${row.action}`}
                    className="flex items-start justify-between gap-4 rounded-lg border p-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {row.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {row.description}
                      </span>
                    </span>
                    <Select
                      value={overrideState(draft, row)}
                      disabled={!canManage || saving}
                      onValueChange={(value: PermissionOverrideState) =>
                        setDraft((current) =>
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

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    disabled={!canManage || saving}
                    onClick={() => void handleSave()}
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar permissões
                  </Button>
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => setDraft(overrides[selectedId] ?? {})}
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
