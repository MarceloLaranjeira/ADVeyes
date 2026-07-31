import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  InviteMemberInput,
  TeamDataScope,
  TeamRole,
  TenantTeam,
} from "@/types/team-management";

interface Props {
  open: boolean;
  teams: TenantTeam[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: Omit<InviteMemberInput, "tenantId">) => Promise<void>;
}

const initial = {
  name: "",
  email: "",
  phone: "",
  jobTitle: "advogado",
  oab: "",
  role: "lawyer" as Exclude<TeamRole, "owner">,
  dataScope: "assigned" as TeamDataScope,
  teamId: "",
  hourlyRate: "",
  monthlyHoursTarget: "160",
};

export function MemberFormDialog({
  open,
  teams,
  busy,
  onOpenChange,
  onSubmit,
}: Props) {
  const [form, setForm] = useState(initial);
  useEffect(() => {
    if (!open) setForm(initial);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Convidar membro da equipe</DialogTitle>
          <DialogDescription>
            Cadastre o perfil profissional e envie o acesso por e-mail.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              profile: {
                name: form.name,
                email: form.email,
                phone: form.phone || null,
                jobTitle: form.jobTitle,
                oab: form.oab || null,
                hourlyRate: form.hourlyRate
                  ? Number(form.hourlyRate)
                  : null,
                monthlyHoursTarget: form.monthlyHoursTarget
                  ? Number(form.monthlyHoursTarget)
                  : 160,
              },
              access: {
                role: form.role,
                dataScope: form.dataScope,
                teamId: form.dataScope === "team" ? form.teamId : null,
              },
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="member-name">Nome completo</Label>
              <Input
                id="member-name"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">E-mail do convite</Label>
              <Input
                id="member-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-phone">Telefone</Label>
              <Input
                id="member-phone"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-oab">OAB</Label>
              <Input
                id="member-oab"
                value={form.oab}
                onChange={(event) =>
                  setForm({ ...form, oab: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Perfil de acesso</Label>
              <Select
                value={form.role}
                onValueChange={(role: Exclude<TeamRole, "owner">) =>
                  setForm({ ...form, role })}
              >
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
              <Label>Alcance dos dados</Label>
              <Select
                value={form.dataScope}
                onValueChange={(dataScope: TeamDataScope) =>
                  setForm({ ...form, dataScope })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">Somente atribuídos</SelectItem>
                  <SelectItem value="team">Equipe definida</SelectItem>
                  <SelectItem value="tenant">Todo o escritório</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.dataScope === "team" && (
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Select
                value={form.teamId}
                onValueChange={(teamId) => setForm({ ...form, teamId })}
                required
              >
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

          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            O convite expira em 7 dias e só poderá ser aceito usando exatamente
            o e-mail informado.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy || (form.dataScope === "team" && !form.teamId)}
            >
              {busy ? "Enviando..." : "Enviar convite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
