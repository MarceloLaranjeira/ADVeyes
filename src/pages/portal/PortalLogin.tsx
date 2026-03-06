import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PortalLogin = () => {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("portal-data", {
        body: { token: token.trim(), action: "validate" },
      });

      if (error || !data?.valid) {
        toast({ title: "Token inválido", description: "Verifique o token de acesso fornecido pelo seu advogado.", variant: "destructive" });
        setLoading(false);
        return;
      }

      sessionStorage.setItem("portal_token", token.trim());
      sessionStorage.setItem("portal_cliente_id", data.cliente_id);
      navigate("/portal/dashboard");
    } catch {
      toast({ title: "Erro", description: "Não foi possível validar o token. Tente novamente.", variant: "destructive" });
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
          <h1 className="text-2xl font-bold font-serif text-foreground">Portal do Cliente</h1>
          <p className="text-xs text-muted-foreground tracking-widest uppercase mt-1">
            Albertino & Advogados Associados
          </p>
        </div>

        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-center">Acesso ao Portal</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Token de Acesso</Label>
              <Input
                id="token"
                type="text"
                placeholder="Cole aqui o token fornecido pelo seu advogado"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                O token de acesso é fornecido pelo escritório. Caso não possua, entre em contato.
              </p>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <LogIn className="w-4 h-4" />
              {loading ? "Verificando..." : "Acessar Portal"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PortalLogin;
