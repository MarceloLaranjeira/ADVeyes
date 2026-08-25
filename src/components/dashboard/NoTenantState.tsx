import { useNavigate } from "react-router-dom";
import { Building2, LinkIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  /** Mostra o atalho de volta quando a conta administra a plataforma. */
  canAccessPlatform?: boolean;
}

/**
 * Conta autenticada que ainda não pertence a nenhum escritório.
 *
 * Antes esta situação caía no skeleton do painel: como a ausência de
 * escritório não muda sozinha, a tela ficava carregando para sempre. O estado
 * vazio precisa oferecer as saídas reais em vez de simular carregamento.
 */
export function NoTenantState({ canAccessPlatform = false }: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center p-6 text-center">
        <Building2 className="mb-3 h-9 w-9 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Nenhum escritório ativo</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Sua conta está ativa, mas ainda não faz parte de um escritório. Peça o
          link privado a quem administra o escritório ou crie o seu.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button className="gap-2" onClick={() => navigate("/solicitar-acesso")}>
            <LinkIcon className="h-4 w-4" /> Solicitar acesso
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate("/onboarding")}
          >
            <Building2 className="h-4 w-4" /> Criar escritório
          </Button>
          {canAccessPlatform && (
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => navigate("/admin")}
            >
              <ShieldCheck className="h-4 w-4" /> Administração da plataforma
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
