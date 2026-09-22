/**
 * Recebe notificações em tempo real via Supabase Realtime.
 *
 * O realtime é a camada de atualização, não a de memória: ele entrega apenas
 * o que é inserido enquanto o canal está aberto. O histórico vem do banco pelo
 * `notificationsService` — antes o painel dependia só deste hook e perdia toda
 * notificação gerada com a aba fechada.
 *
 * O recorte por tenant é feito no cliente porque o filtro do canal aceita uma
 * única igualdade: a assinatura já limita ao `user_id`, e aqui descartamos o
 * que pertence a outro escritório do mesmo advogado.
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapNotificacao, type NotificacaoRow } from "@/lib/notificacoes";
import type { Notificacao } from "@/types/notificacoes";

export function useNotificacoesRealtime(
  userId: string | undefined,
  tenantId: string | null | undefined,
  onNova: (n: Notificacao) => void,
) {
  // O callback muda a cada render do painel. Sem a ref, o efeito recriaria a
  // inscrição a cada mudança e o canal ficaria reconectando sem parar.
  const callbackRef = useRef(onNova);
  callbackRef.current = onNova;

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
          const row = payload.new as NotificacaoRow;
          // Notificação de outro escritório do mesmo advogado não entra na
          // caixa do escritório aberto agora. Linha sem tenant é histórico
          // anterior ao multi-tenant e pertence ao usuário.
          if (tenantId && row.tenant_id && row.tenant_id !== tenantId) return;
          callbackRef.current(mapNotificacao(row));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, tenantId]);
}
