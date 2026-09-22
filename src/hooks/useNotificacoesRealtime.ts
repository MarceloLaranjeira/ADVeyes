/**
 * Recebe notificações em tempo real via Supabase Realtime.
 *
 * O realtime é a camada de atualização, não a de memória: ele entrega apenas
 * o que muda enquanto o canal está aberto. O histórico vem do banco pelo
 * `notificationsService`.
 *
 * INSERT e UPDATE são necessários: sem UPDATE, uma leitura/arquivamento feito
 * em outra aba ou dispositivo deixa este painel com linha e contador antigos.
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  mapNotificacao,
  notificacaoPertenceAoTenant,
  type NotificacaoRow,
} from "@/lib/notificacoes";
import type { Notificacao } from "@/types/notificacoes";

export interface NotificacaoRealtimeEvent {
  kind: "insert" | "update";
  notification: Notificacao;
  archived: boolean;
}

export function useNotificacoesRealtime(
  userId: string | undefined,
  tenantId: string | null | undefined,
  onChange: (event: NotificacaoRealtimeEvent) => void,
  onReady?: () => void,
) {
  // Callbacks mudam a cada render. As refs impedem que o efeito recrie a
  // inscrição a cada mudança e deixe janelas sem canal durante a reconexão.
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notificacoes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") {
            return;
          }
          const row = payload.new as NotificacaoRow;
          if (!notificacaoPertenceAoTenant(row.tenant_id, tenantId)) return;
          changeRef.current({
            kind: payload.eventType === "INSERT" ? "insert" : "update",
            notification: mapNotificacao(row),
            archived: Boolean(row.arquivada_em),
          });
        },
      )
      .subscribe((status) => {
        // Uma carga depois do SUBSCRIBED fecha o intervalo entre o snapshot da
        // primeira consulta e o canal ficar pronto. Ela é mesclada por id, não
        // substitui eventos que já chegaram.
        if (status === "SUBSCRIBED") readyRef.current?.();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, tenantId]);
}
