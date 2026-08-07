/**
 * Hook para receber notificações em tempo real via Supabase Realtime.
 * Conecta ao canal da tabela `notificacoes` e dispara `onNova` a cada INSERT.
 */

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Notificacao, UrgenciaNotificacao } from "@/types/notificacoes";

/** Linha crua da tabela `notificacoes`. Os campos chegam soltos do realtime. */
interface NotificacaoRow {
  id: string;
  tipo?: string | null;
  urgencia?: string | null;
  titulo?: string | null;
  mensagem?: string | null;
  processo_numero?: string | null;
  created_at?: string | null;
  lida?: boolean | null;
}

function mapRowToNotificacao(row: NotificacaoRow): Notificacao {
  return {
    id: row.id,
    tipo: row.tipo === "movimentacao" ? "NOVA_MOVIMENTACAO"
      : row.tipo === "alerta" ? "PRAZO_VENCENDO"
      : "GERAL",
    urgencia: (row.urgencia ?? "MEDIA").toUpperCase() as UrgenciaNotificacao,
    titulo: row.titulo ?? "Notificação",
    mensagem: row.mensagem ?? "",
    processoId: row.processo_numero ?? undefined,
    dataNotificacao: new Date(row.created_at ?? Date.now()),
    lida: row.lida ?? false,
  };
}

export function useNotificacoesRealtime(userId: string | undefined, onNova: (n: Notificacao) => void) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notificacoes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNova(mapRowToNotificacao(payload.new as NotificacaoRow));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onNova]);
}
