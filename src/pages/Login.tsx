import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HardDrive, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { LogoFull } from "@/components/common/Logo";
import { withTimeout } from "@/lib/async-timeout";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenFileName, setTokenFileName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleTokenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTokenFileName(file.name);
    setLoadingToken(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.access_token && data.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (error) {
          toast({ title: "Token inválido ou expirado", description: error.message, variant: "destructive" });
        } else {
          navigate("/");
        }
      } else if (data.email && data.password) {
        const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
        if (error) {
          toast({ title: "Credenciais inválidas", description: error.message, variant: "destructive" });
        } else {
          navigate("/");
        }
      } else {
        toast({ title: "Arquivo inválido", description: "O arquivo não contém credenciais reconhecidas.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao ler arquivo", description: "Verifique se o arquivo é um JSON válido.", variant: "destructive" });
    } finally {
      setLoadingToken(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Informe o e-mail", description: "Digite seu e-mail no campo acima para receber o link de redefinição.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Erro ao enviar e-mail", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/`,
            skipBrowserRedirect: true,
          },
        }),
      );
      if (error) throw error;
      if (!data.url) throw new Error("O Google não retornou uma URL de acesso.");
      window.location.assign(data.url);
    } catch (error) {
      toast({
        title: "Não foi possível entrar com Google",
        description:
          error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LogoFull size="lg" className="mx-auto justify-center" />
        </div>

        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-center">Entrar no Sistema</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Esqueci minha senha
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : "Entrar"}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-3"
            onClick={handleGoogleLogin}
            disabled={loadingGoogle || loading}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
              <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
              <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9.2L6.5 14Z" />
              <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 3.1 7.5l3.4 2.7A5.9 5.9 0 0 1 12 6.1Z" />
            </svg>
            {loadingGoogle ? "Redirecionando..." : "Entrar com Google"}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                ou use um token
              </span>
            </div>
          </div>

          {/* Pendrive token login */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="w-4 h-4" />
              Login com token de pendrive
            </Label>
            <label className={`flex items-center justify-center w-full h-10 px-4 border border-dashed border-input rounded-md cursor-pointer hover:bg-muted/30 transition-colors text-sm gap-2 ${loadingToken ? "opacity-50 pointer-events-none" : "text-muted-foreground"}`}>
              <Upload className="w-4 h-4" />
              {loadingToken ? "Autenticando..." : tokenFileName || "Selecionar arquivo .json"}
              <input
                type="file"
                accept=".json,.token"
                className="hidden"
                onChange={handleTokenFile}
                disabled={loadingToken}
              />
            </label>
            <p className="text-xs text-muted-foreground text-center">Arquivo de token gerado pelo sistema (access_token + refresh_token)</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
