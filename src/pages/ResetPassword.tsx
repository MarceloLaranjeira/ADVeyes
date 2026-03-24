import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Senhas não coincidem", description: "Digite a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({ title: "Erro ao redefinir senha", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha redefinida com sucesso!", description: "Você já pode acessar o sistema." });
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
          <h2 className="text-lg font-semibold mb-4 text-center">Redefinir Senha</h2>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Digite sua nova senha abaixo.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Redefinindo..." : "Redefinir Senha"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              onClick={() => navigate("/login")}
            >
              <ArrowLeft className="w-3 h-3" />
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
