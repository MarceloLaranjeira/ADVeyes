/**
 * Leitura e escrita das notificações do advogado.
 *
 * A tabela é a fonte da verdade. O painel carrega daqui ao abrir e o realtime
 * apenas acrescenta o que chega depois — antes disso o estado vivia em
 * `localStorage`, e notificação gerada com a aba fechada nunca era vista.
 *
 * O recorte por tenant existe porque um advogado pode atuar em mais de um
 * escritório: sem ele, a caixa de um cliente aparece no contexto do outro.
 * A política de RLS aplica a mesma regra no banco — o filtro aqui é para a
 * consulta ser precisa, não para ser a barreira de segurança.
 */

import { supabase } from "@/integrations/supabase/client";
import { mapNotificacao, type NotificacaoRow } from "@/lib/notificacoes";
import type { Notificacao } from "@/types/notificacoes";

/** Quantas já lidas ficam visíveis; todas as não lidas são sempre carregadas. */
const LIMITE_RECENTES_LIDAS = 50;

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const notificationsService = {
  /**
   * Notificações recentes não arquivadas, mais novas primeiro.
   *
   * `tenantId` nulo traz apenas as linhas sem tenant (histórico anterior ao
   * multi-tenant). Com tenant, traz as do escritório atual mais as antigas
   * sem vínculo, que continuam pertencendo ao usuário.
   */
  async list(
    userId: string,
    tenantId: string | null,
    limiteRecentesLidas = LIMITE_RECENTES_LIDAS,
  ): Promise<Notificacao[]> {
    // Todas as não lidas precisam estar acessíveis, mesmo quando há mais de 50
    // linhas recentes. Caso contrário, o sino poderia exibir "Tudo em dia"
    // enquanto um prazo antigo ainda não visto estivesse na página seguinte.
    let unreadQuery = supabase
      .from("notificacoes")
      .select("*")
      .eq("user_id", userId)
      .eq("lida", false)
      .is("arquivada_em", null)
      .order("created_at", { ascending: false });

    let recentQuery = supabase
      .from("notificacoes")
      .select("*")
      .eq("user_id", userId)
      .is("arquivada_em", null)
      .order("created_at", { ascending: false })
      .limit(limiteRecentesLidas);

    if (tenantId) {
      const scope = `tenant_id.eq.${tenantId},tenant_id.is.null`;
      unreadQuery = unreadQuery.or(scope);
      recentQuery = recentQuery.or(scope);
    } else {
      unreadQuery = unreadQuery.is("tenant_id", null);
      recentQuery = recentQuery.is("tenant_id", null);
    }

    const [unreadResult, recentResult] = await Promise.all([
      unreadQuery,
      recentQuery,
    ]);
    fail(unreadResult.error);
    fail(recentResult.error);

    const byId = new Map<string, NotificacaoRow>();
    for (const row of recentResult.data ?? []) {
      byId.set(row.id, row as NotificacaoRow);
    }
    for (const row of unreadResult.data ?? []) {
      byId.set(row.id, row as NotificacaoRow);
    }
    return [...byId.values()]
      .map(mapNotificacao)
      .sort((a, b) => b.dataNotificacao.getTime() - a.dataNotificacao.getTime());
  },

  /**
   * Marca uma notificação como lida. Grava o instante, não só o booleano:
   * sem ele não dá para auditar se o aviso foi visto antes do prazo vencer.
   */
  async marcarLida(
    id: string,
    userId: string,
    tenantId: string | null,
  ): Promise<void> {
    let query = supabase
      .from("notificacoes")
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .is("lida_em", null);
    query = tenantId
      ? query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      : query.is("tenant_id", null);
    const { error } = await query;
    fail(error);
  },

  /**
   * Marca todas as pendentes como lidas numa única ida ao banco.
   * O filtro `is("lida_em", null)` preserva o instante original das que já
   * tinham sido lidas em outro dispositivo.
   */
  async marcarTodasLidas(
    userId: string,
    tenantId: string | null,
  ): Promise<void> {
    let query = supabase
      .from("notificacoes")
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq("user_id", userId)
      .is("lida_em", null)
      .is("arquivada_em", null);

    query = tenantId
      ? query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      : query.is("tenant_id", null);

    const { error } = await query;
    fail(error);
  },

  /**
   * Tira a notificação da caixa sem apagar a linha. O histórico continua
   * disponível para auditoria — um aviso de prazo é registro, não rascunho.
   */
  async arquivar(
    id: string,
    userId: string,
    tenantId: string | null,
  ): Promise<void> {
    let query = supabase
      .from("notificacoes")
      .update({ arquivada_em: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .is("arquivada_em", null);
    query = tenantId
      ? query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      : query.is("tenant_id", null);
    const { error } = await query;
    fail(error);
  },
};
