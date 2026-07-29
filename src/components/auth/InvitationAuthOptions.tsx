import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";

interface Props {
  onMessage: (message: string | null) => void;
}

export function InvitationAuthOptions({ onMessage }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    onMessage(null);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/convite/aceitar`,
            skipBrowserRedirect: true,
          },
        }),
      );
      if (error) throw error;
      if (!data.url) throw new Error("O Google não retornou a página de acesso.");
      window.location.assign(data.url);
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      );
      setBusy(false);
    }
  };

  const passwordAuth = async (createAccount: boolean) => {
    if (!email || password.length < 6) {
      onMessage("Informe o e-mail convidado e uma senha com pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    onMessage(null);
    try {
      if (createAccount) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/convite/aceitar`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          onMessage(
            "Conta criada. Confirme o e-mail nesta mesma janela para concluir o convite.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "Não foi possível autenticar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-3"
        disabled={busy}
        onClick={() => void google()}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
          <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9.2L6.5 14Z" />
          <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 3.1 7.5l3.4 2.7A5.9 5.9 0 0 1 12 6.1Z" />
        </svg>
        Continuar com Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">ou</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="invite-email">E-mail convidado</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-password">Senha</Label>
          <Input
            id="invite-password"
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void passwordAuth(false)}
          >
            Entrar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void passwordAuth(true)}
          >
            Criar acesso
          </Button>
        </div>
      </div>
    </div>
  );
}
