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
import type { TeamMember } from "@/types/team-management";

interface MemberProfileInput {
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  oab: string | null;
}

interface Props {
  member: TeamMember | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (profile: MemberProfileInput) => Promise<void>;
}

export function MemberProfileDialog({
  member,
  busy,
  onOpenChange,
  onSubmit,
}: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    jobTitle: "",
    oab: "",
  });

  useEffect(() => {
    if (!member) return;
    setForm({
      name: member.name,
      email: member.email ?? "",
      phone: member.phone ?? "",
      jobTitle: member.job_title ?? "",
      oab: member.oab ?? "",
    });
  }, [member]);

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar perfil profissional</DialogTitle>
          <DialogDescription>
            Atualize os dados exibidos no escritório. O perfil de acesso é
            alterado separadamente.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone.trim() || null,
              jobTitle: form.jobTitle.trim() || null,
              oab: form.oab.trim() || null,
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profile-name">Nome completo</Label>
            <Input id="profile-name" required minLength={2} value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profile-email">E-mail</Label>
            <Input id="profile-email" type="email" required value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Telefone</Label>
            <Input id="profile-phone" value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-oab">OAB</Label>
            <Input id="profile-oab" value={form.oab}
              onChange={(event) => setForm({ ...form, oab: event.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profile-job">Cargo</Label>
            <Input id="profile-job" value={form.jobTitle}
              onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar perfil"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
