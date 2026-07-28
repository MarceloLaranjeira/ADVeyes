import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, HardDrive, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Scale className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-serif text-foreground">ALBERTINO</h1>
          <p className="text-xs text-muted-foreground tracking-widest uppercase mt-1">
            Advogados Associados
          </p>
        </div>

        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-center">Entrar no Sistema</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="advogado@albertino.com"
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
