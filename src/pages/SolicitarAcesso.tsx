import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LogIn, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccessRequestStatus } from "@/components/access/AccessRequestStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { describeEdgeError } from "@/lib/edge-errors";
import { accessRequestService } from "@/services/access-requests";
import type {
  AccessLinkLookup,
  AccessRequestStatus as Status,
} from "@/types/access-requests";

/**
 * Solicitação de acesso por link privado.
 *
 * Rota pública de propósito: uma conta sem escritório não pode cair no
 * redirecionamento de "conclua seu cadastro" enquanto está pedindo entrada em
 * um escritório que já existe.
 */
export default function SolicitarAcesso() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const token = params.get("token") ?? "";

  const [lookup, setLookup] = useState<AccessLinkLookup | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [oab, setOab] = useState("");

  const tenantName = lookup?.valid ? lookup.tenant_name : "este escritório";

  const check = useCallback(async () => {
    if (!token) {
      setLookup({ valid: false, reason: "invalid_token" });
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const result = await accessRequestService.lookupLink(token);
      setLookup(result);

      // Já autenticado: talvez este pedido já exista e só falte a decisão.
      if (result.valid && session) {
        const mine = await accessRequestService.myRequests();
        const existing = mine.requests.find(
          (request) => request.tenant_id === result.tenant_id,
        );
        if (existing) {
          setStatus(existing.status);
          setRejectionReason(existing.rejection_reason);
        }
      }
    } catch (error) {
      toast({
        title: "Não foi possível abrir o link",
        description: describeEdgeError(error, "Tente novamente."),
        variant: "destructive",
      });
    }
    setChecking(false);
  }, [session, token, toast]);

  useEffect(() => {
    if (authLoading) return;
    void check();
  }, [authLoading, check]);

  useEffect(() => {
    if (user && !name) {
      const metadata = user.user_metadata as Record<string, unknown> | undefined;
      const suggested = metadata?.nome ?? metadata?.full_name;
      if (typeof suggested === "string") setName(suggested);
    }
  }, [name, user]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await accessRequestService.submit(token, {
        name: name.trim(),
        phone: phone.trim() || null,
        oab: oab.trim() || null,
      });
      setStatus("pending");
      toast({
        title: result.already_pending
          ? "Você já tinha um pedido em aberto"
          : "Solicitação enviada",
      });
    } catch (error) {
      toast({
        title: "Não foi possível enviar a solicitação",
        description: describeEdgeError(error, "Tente novamente."),
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };

  const goToLogin = () => {
    const next = encodeURIComponent(`/solicitar-acesso?token=${token}`);
    navigate(`/login?next=${next}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 sm:p-8">
          {checking || authLoading
            ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )
            : !lookup?.valid
            ? (
              <div className="text-center">
                <ShieldQuestion className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h1 className="text-lg font-semibold">
                  {lookup?.reason === "revoked_token"
                    ? "Este link foi revogado"
                    : "Link inválido"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lookup?.reason === "revoked_token"
                    ? "Peça um link novo a quem administra o escritório."
                    : "Confira o endereço recebido ou peça um link novo."}
                </p>
              </div>
            )
            : status
            ? (
              <AccessRequestStatus
                status={status}
                tenantName={tenantName}
                rejectionReason={rejectionReason}
                onContinue={() => navigate("/")}
              />
            )
            : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Solicitação de acesso
                  </p>
                  <h1 className="mt-1 text-xl font-bold">{tenantName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirme seus dados profissionais. O proprietário decide a
                    entrada e as permissões.
                  </p>
                </div>

                {!session
                  ? (
                    <div className="space-y-3">
                      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        Entre com sua conta para pedir acesso. Se ainda não
                        tiver uma, você pode criá-la no mesmo passo.
                      </p>
                      <Button className="w-full gap-2" onClick={goToLogin}>
                        <LogIn className="h-4 w-4" /> Entrar para solicitar
                      </Button>
                    </div>
                  )
                  : (
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submit();
                      }}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="solicitacao-nome">Nome completo</Label>
                        <Input
                          id="solicitacao-nome"
                          value={name}
                          required
                          minLength={2}
                          onChange={(event) => setName(event.target.value)}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="solicitacao-telefone">Telefone</Label>
                          <Input
                            id="solicitacao-telefone"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="solicitacao-oab">OAB</Label>
                          <Input
                            id="solicitacao-oab"
                            value={oab}
                            onChange={(event) => setOab(event.target.value)}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Entrando como {user?.email}.
                      </p>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={submitting || name.trim().length < 2}
                      >
                        {submitting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Solicitar acesso
                      </Button>
                    </form>
                  )}
              </div>
            )}
        </CardContent>
      </Card>
    </main>
  );
}
