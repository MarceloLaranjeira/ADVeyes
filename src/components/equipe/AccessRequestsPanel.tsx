import { Clock, Inbox, ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DecidedAccessRequest,
  PendingAccessRequest,
} from "@/types/access-requests";

interface Props {
  pending: PendingAccessRequest[];
  decided: DecidedAccessRequest[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  onDecide: (request: PendingAccessRequest) => void;
  onRetry: () => void;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Solicitações aguardando decisão e o histórico do que já foi decidido.
 * Visível apenas para o proprietário.
 */
export function AccessRequestsPanel({
  pending,
  decided,
  loading,
  busy,
  error,
  onDecide,
  onRetry,
}: Props) {
  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4 text-primary" />
            Aguardando sua decisão ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading
            ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Carregando solicitações...
              </p>
            )
            : pending.length === 0
            ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                Nenhuma solicitação pendente.
              </p>
            )
            : (
              <ul className="space-y-2">
                {pending.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {request.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {request.email}
                        {request.oab ? ` - OAB ${request.oab}` : ""}
                        {request.phone ? ` - ${request.phone}` : ""}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Pedido em {formatDate(request.created_at)}
                      </p>
                    </div>
                    <Button
                      className="shrink-0 gap-2"
                      disabled={busy}
                      onClick={() => onDecide(request)}
                    >
                      <UserPlus className="h-4 w-4" /> Decidir
                    </Button>
                  </li>
                ))}
              </ul>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Histórico das decisões. A auditoria completa (incluindo antes/depois das
 * permissões) fica em tenant_audit_events; aqui mostramos o essencial.
 */
export function AccessRequestHistory({
  decided,
  loading,
}: {
  decided: DecidedAccessRequest[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Decisões registradas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading
          ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Carregando histórico...
            </p>
          )
          : decided.length === 0
          ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              Nenhuma decisão registrada ainda.
            </p>
          )
          : (
            <ul className="space-y-2">
              {decided.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {request.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {request.email}
                    </p>
                    {request.rejection_reason && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Motivo: {request.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge
                      variant={request.status === "approved"
                        ? "default"
                        : "outline"}
                    >
                      {request.status === "approved" ? "Aprovado" : "Recusado"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(request.decided_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </CardContent>
    </Card>
  );
}
