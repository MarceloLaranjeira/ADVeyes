import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InvitationAuthOptions } from "@/components/auth/InvitationAuthOptions";
import { LogoFull } from "@/components/common/Logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { teamManagementService } from "@/services/team-management";
import { CheckCircle2, Loader2 } from "lucide-react";

const TOKEN_KEY = "adveyes:tenant-invitation-token";

export default function ConviteAceite() {
  const { user, loading: authLoading } = useAuth();
  const { refresh } = useTenant();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "reading" | "auth" | "accepting" | "success" | "error"
  >("reading");
  const [message, setMessage] = useState<string | null>(null);
  const acceptedForUser = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get("token");
    if (queryToken) {
      sessionStorage.setItem(TOKEN_KEY, queryToken);
      window.history.replaceState(
        {},
        document.title,
        "/convite/aceitar",
      );
    }
    const stored = queryToken ?? sessionStorage.getItem(TOKEN_KEY);
    setToken(stored);
    if (!stored) {
      setMessage("O link do convite está ausente ou incompleto.");
      setStatus("error");
    } else {
      setStatus("auth");
    }
  }, []);

  useEffect(() => {
    if (
      authLoading || !user || !token || status === "success" ||
      acceptedForUser.current === user.id
    ) return;

    acceptedForUser.current = user.id;
    setStatus("accepting");
    setMessage(null);
    void teamManagementService.acceptInvitation(token).then(async () => {
      sessionStorage.removeItem(TOKEN_KEY);
      await refresh();
      setStatus("success");
    }).catch((error: unknown) => {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível aceitar.",
      );
      setStatus("error");
    });
  }, [authLoading, refresh, status, token, user]);

  const waitingForAuth = status === "auth" && !authLoading && !user;
  const processing = status === "reading" || authLoading ||
    status === "accepting";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        <LogoFull size="lg" className="justify-center" />
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Convite para o escritório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {processing && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {status === "accepting"
                    ? "Validando seu convite..."
                    : "Preparando acesso..."}
                </p>
              </div>
            )}

            {waitingForAuth && (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Entre ou crie sua conta usando exatamente o e-mail que recebeu
                  o convite.
                </p>
                <InvitationAuthOptions onMessage={setMessage} />
              </>
            )}

            {status === "success" && (
              <div className="space-y-5 py-5 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
                <div>
                  <h2 className="text-lg font-semibold">Convite aceito</h2>
                  <p className="text-sm text-muted-foreground">
                    Seu acesso ao escritório está ativo.
                  </p>
                </div>
                <Button onClick={() => navigate("/")}>
                  Entrar no ADVeyes
                </Button>
              </div>
            )}

            {message && (
              <Alert variant={status === "error" ? "destructive" : "default"}>
                <AlertTitle>
                  {status === "error" ? "Não foi possível aceitar" : "Aviso"}
                </AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {status === "error" && user && token && (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    acceptedForUser.current = null;
                    setStatus("auth");
                  }}
                >
                  Tentar novamente
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    acceptedForUser.current = null;
                    void supabase.auth.signOut({ scope: "local" }).then(() => {
                      setMessage(null);
                      setStatus("auth");
                    });
                  }}
                >
                  Entrar com outro e-mail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
