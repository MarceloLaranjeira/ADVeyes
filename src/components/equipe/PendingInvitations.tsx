import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PendingInvitation } from "@/types/team-management";

interface Props {
  invitations: PendingInvitation[];
  busy: boolean;
  onResend: (invitation: PendingInvitation) => void;
  onRevoke: (invitation: PendingInvitation) => void;
}

export function PendingInvitations({
  invitations,
  busy,
  onResend,
  onRevoke,
}: Props) {
  if (!invitations.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Não há convites pendentes.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{invitation.email}</p>
              <Badge variant="secondary">Pendente</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Expira em {new Date(invitation.expires_at).toLocaleDateString(
                "pt-BR",
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onResend(invitation)}
            >
              Reenviar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => onRevoke(invitation)}
            >
              Revogar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
