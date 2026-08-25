import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccessRequestStatus as Status } from "@/types/access-requests";

interface Props {
  status: Status;
  tenantName: string;
  rejectionReason?: string | null;
  onContinue?: () => void;
}

/**
 * O que a pessoa vê depois de pedir acesso. Enquanto está pendente ela não
 * entra no ambiente do escritório: a decisão é do proprietário.
 */
export function AccessRequestStatus({
  status,
  tenantName,
  rejectionReason,
  onContinue,
}: Props) {
  if (status === "approved") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
        <h2 className="text-lg font-semibold">Acesso liberado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seu acesso a {tenantName} foi aprovado.
        </p>
        {onContinue && (
          <Button className="mt-4" onClick={onContinue}>
            Entrar no escritório
          </Button>
        )}
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="text-center">
        <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="text-lg font-semibold">Solicitação recusada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tenantName} não autorizou seu acesso.
        </p>
        {rejectionReason && (
          <p className="mt-2 rounded-lg border border-dashed p-3 text-sm">
            {rejectionReason}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="text-center">
      <Clock className="mx-auto mb-3 h-10 w-10 text-amber-500" />
      <h2 className="text-lg font-semibold">Aguardando autorização</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Seu pedido foi enviado a {tenantName}. Somente o proprietário pode
        liberar a entrada, e você ainda não tem acesso aos dados do escritório.
      </p>
    </div>
  );
}
