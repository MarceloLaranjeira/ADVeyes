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
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  // `nao_identificada` já é tratada como ausência de classificação dentro de
  // `situacaoNaCarteira`, então a fase vai crua.
  const situacao = situacaoNaCarteira({ status, arquivadoManual, fase });

  const gravar = async (valor: boolean | null) => {
    setSalvando(true);
    // `select()` no fim não é enfeite: quando a RLS barra a escrita, o
    // PostgREST responde sucesso com zero linhas afetadas, sem erro. Sem
    // pedir a linha de volta e conferir que ela veio, a tela dizia "Processo
    // arquivado" para quem não tem permissão de gravar — e o processo seguia
    // como estava. Erro silencioso numa decisão que tira processo da
    // carteira é o pior lugar para um falso positivo.
    //
    // A coluna é nova e ainda não entrou nos tipos gerados do Supabase.
    const { data, error } = await (supabase as unknown as {
      from: (tabela: string) => {
        update: (valores: Record<string, unknown>) => {
          eq: (coluna: string, valor: string) => {
            eq: (coluna: string, valor: string) => {
              select: (
                colunas: string,
              ) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        };
      };
    })
      .from("processos")
      .update({ arquivado_manual: valor })
      .eq("tenant_id", tenantId)
      .eq("id", processoId)
      .select("id");

    setSalvando(false);

    if (!error && (data ?? []).length === 0) {
      toast({
        title: "Sem permissão para alterar o arquivamento",
        description:
          "A alteração não foi gravada. Fale com quem administra o escritório.",
        variant: "destructive",
      });
      return;
    }

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
    // `onChange` recarrega só o processo aberto. A listagem central vive em
    // outro cache, com `staleTime` de 30 segundos e duas variantes de chave
    // (com e sem arquivados) — sem invalidar as duas, voltar para a lista
    // dentro desse intervalo mostra o estado velho, e ficar obsoleto sozinho
    // não dispara refetch: depende de um foco de janela ou refresh manual.
    // O processo apareceria ou sumiria com atraso, sem explicação.
    void queryClient.invalidateQueries({ queryKey: ["process-intelligence"] });
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
              {/*
                `arquivadoManual` vem antes de `origem` porque `false` é uma
                decisão tão explícita quanto `true`. Ler só a origem mostrava
                um processo reativado pelo escritório como "sem arquivamento
                registrado", escondendo quem respondeu pelo estado atual. A
                origem "manual" entra junto porque cobre o processo legado,
                arquivado pelo status antes de a coluna existir.
              */}
              {arquivadoManual !== null || situacao.origem === "manual"
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
                {/*
                  A frase segue `situacao.arquivado`, a decisão que de fato
                  vale, e não `arquivadoManual` cru. No processo legado —
                  status "Arquivado" com a coluna ainda nula — o valor cru é
                  falso e a mensagem saía invertida: dizia que o tribunal
                  arquivou e o escritório manteve ativo, exatamente o oposto
                  do que o rótulo logo acima afirmava. Contradizer a si mesmo
                  num aviso de divergência destrói a razão de o aviso existir.
                */}
                {situacao.arquivado
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
