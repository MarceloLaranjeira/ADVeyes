/**
 * Hook para receber notificações em tempo real via Supabase Realtime.
 * Conecta ao canal da tabela `notificacoes` e dispara `onNova` a cada INSERT.
 */

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NotificacaoHorus } from "@/services/horus/types";

function mapDbToHorus(row: any): NotificacaoHorus {
  return {
    id: row.id,
    tipo: row.tipo === "movimentacao" ? "NOVA_MOVIMENTACAO"
      : row.tipo === "alerta" ? "PRAZO_VENCENDO"
      : "GERAL",
    urgencia: (row.urgencia ?? "MEDIA").toUpperCase() as NotificacaoHorus["urgencia"],
    titulo: row.titulo ?? "Notificação",
    mensagem: row.mensagem ?? "",
    processoId: row.processo_numero,
    dataNotificacao: new Date(row.created_at ?? Date.now()),
    lida: row.lida ?? false,
  };
}

export function useNotificacoesRealtime(userId: string | undefined, onNova: (n: NotificacaoHorus) => void) {
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
          onNova(mapDbToHorus(payload.new));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onNova]);
}
