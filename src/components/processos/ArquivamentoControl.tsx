/**
 * Sobreposição manual do arquivamento vindo do tribunal.
 *
 * A regra da carteira é "o tribunal decide, o advogado pode sobrepor". Sem
 * este controle a segunda metade não existia: um processo que o tribunal
 * marcasse como arquivado por engano sumia da listagem principal sem caminho
 * de volta, e mudar o status para "Em andamento" não resolvia — esse é o
 * valor padrão do cadastro, não uma decisão.
 *
 * O que a tela precisa deixar claro, em ordem de importância:
 *
 *   1. Se o processo está fora da carteira ativa agora.
 *   2. Quem decidiu isso — tribunal ou advogado.
 *   3. Quando os dois discordam, os dois lados, nunca só o vencedor.
 *
 * O terceiro é o que evita perder processo. Divergência escondida faz o
 * advogado achar que o sistema concorda com ele.
 */

import { useState } from "react";
import { Archive, ArchiveRestore, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { situacaoNaCarteira } from "@/lib/carteira";

interface Props {
  processoId: string;
  tenantId: string;
  status: string | null;
  /** `processos.arquivado_manual`: null = sem decisão do advogado. */
  arquivadoManual: boolean | null;
  /** Fase de `process_intelligence_current`, quando já analisada. */
  fase: string | null;
  onChange: () => void;
}

export function ArquivamentoControl({
  processoId,
  tenantId,
  status,
  arquivadoManual,
  fase,
  onChange,
}: Props) {
  const { toast } = useToast();
  const [salvando, setSalvando] = useState(false);

  const situacao = situacaoNaCarteira({ status, arquivadoManual, fase });

  // Nada a mostrar num processo ativo sobre o qual ninguém se pronunciou:
  // seria ruído no cabeçalho de todo processo normal da carteira.
  if (!situacao.arquivado && !situacao.divergente && arquivadoManual === null) {
    return null;
  }

  const gravar = async (valor: boolean | null) => {
    setSalvando(true);
    // A coluna é nova e ainda não entrou nos tipos gerados do Supabase.
    const { error } = await (supabase as unknown as {
      from: (tabela: string) => {
        update: (valores: Record<string, unknown>) => {
          eq: (coluna: string, valor: string) => {
            eq: (
              coluna: string,
              valor: string,
            ) => Promise<{ error: unknown }>;
          };
        };
      };
    })
      .from("processos")
      .update({ arquivado_manual: valor })
      .eq("tenant_id", tenantId)
      .eq("id", processoId);

    setSalvando(false);

    if (error) {
      toast({
        title: "Não foi possível alterar o arquivamento",
        description: "Tente novamente. Se persistir, avise o suporte.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: valor === true
        ? "Processo arquivado"
        : valor === false
          ? "Processo reativado na carteira"
          : "Decisão manual removida",
      description: valor === null
        ? "O arquivamento volta a seguir o tribunal."
        : undefined,
    });
    onChange();
  };

  return (
    <div className="mb-5 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {situacao.arquivado ? (
              <Badge variant="outline" className="gap-1.5">
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                Fora da carteira ativa
              </Badge>
            ) : (
              <Badge variant="secondary">Na carteira ativa</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {situacao.origem === "manual"
                ? "por decisão do escritório"
                : situacao.origem === "tribunal"
                  ? "pelo andamento do tribunal"
                  : "sem arquivamento registrado"}
            </span>
          </div>

          {situacao.divergente ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-500">
              <TriangleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                {arquivadoManual
                  ? "O escritório arquivou este processo, mas o tribunal ainda o mostra em andamento."
                  : "O tribunal considera este processo arquivado, e o escritório o mantém ativo."}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2">
          {situacao.arquivado ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={salvando}
              onClick={() => void gravar(false)}
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
              )}
              Reativar na carteira
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={salvando}
              onClick={() => void gravar(true)}
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Archive className="h-4 w-4" aria-hidden="true" />
              )}
              Arquivar
            </Button>
          )}

          {arquivadoManual !== null ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={salvando}
              onClick={() => void gravar(null)}
              title="Volta a seguir o tribunal"
            >
              Seguir o tribunal
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
