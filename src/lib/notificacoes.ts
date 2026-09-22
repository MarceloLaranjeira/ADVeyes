/**
 * Tradução entre a linha da tabela `notificacoes` e o tipo que a interface usa.
 *
 * Vive separado do service porque é a parte que erra em silêncio: um `tipo`
 * novo gravado por uma Edge Function, uma urgência fora do vocabulário ou um
 * `created_at` nulo não podem derrubar o painel nem exibir "Invalid Date" para
 * o advogado. Aqui cada caso tem um destino explícito e testável.
 */

import type {
  Notificacao,
  TipoNotificacao,
  UrgenciaNotificacao,
} from "@/types/notificacoes";

/** Linha crua como ela chega do banco ou do canal de realtime. */
export interface NotificacaoRow {
  id: string;
  tipo?: string | null;
  urgencia?: string | null;
  titulo?: string | null;
  mensagem?: string | null;
  processo_numero?: string | null;
  created_at?: string | null;
  lida?: boolean | null;
  lida_em?: string | null;
  arquivada_em?: string | null;
  tenant_id?: string | null;
  user_id?: string | null;
}

/**
 * As Edge Functions gravam `tipo` em snake_case; a interface trabalha com um
 * vocabulário fechado. O que não estiver mapeado vira GERAL — aparecer sem
 * categoria é melhor do que não aparecer.
 */
const TIPOS: Record<string, TipoNotificacao> = {
  movimentacao: "NOVA_MOVIMENTACAO",
  nova_movimentacao: "NOVA_MOVIMENTACAO",
  alerta: "PRAZO_VENCENDO",
  prazo: "PRAZO_VENCENDO",
  prazo_vencendo: "PRAZO_VENCENDO",
  sentenca: "SENTENCA",
  intimacao: "INTIMACAO",
};

const URGENCIAS: readonly UrgenciaNotificacao[] = [
  "CRITICA",
  "ALTA",
  "MEDIA",
  "BAIXA",
];

export function mapTipo(value: string | null | undefined): TipoNotificacao {
  const key = value?.trim().toLowerCase() ?? "";
  return TIPOS[key] ?? "GERAL";
}

export function mapUrgencia(
  value: string | null | undefined,
): UrgenciaNotificacao {
  const upper = value?.trim().toUpperCase() ?? "";
  return (URGENCIAS as string[]).includes(upper)
    ? upper as UrgenciaNotificacao
    : "MEDIA";
}

/**
 * Data da notificação. Um `created_at` ausente ou corrompido não pode virar
 * `Invalid Date` na tela: cai para o instante da leitura, que ordena de forma
 * previsível e não quebra a formatação.
 */
export function mapData(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function mapNotificacao(row: NotificacaoRow): Notificacao {
  const processoNumero = row.processo_numero?.trim() || undefined;
  return {
    id: row.id,
    tipo: mapTipo(row.tipo),
    urgencia: mapUrgencia(row.urgencia),
    titulo: row.titulo?.trim() || "Notificação",
    mensagem: row.mensagem ?? "",
    processoId: processoNumero,
    dataNotificacao: mapData(row.created_at),
    // `lida_em` é a fonte da verdade; `lida` fica como compatibilidade com as
    // linhas gravadas antes da coluna existir.
    lida: Boolean(row.lida_em) || row.lida === true,
    // A tabela guarda o número CNJ, não o UUID interno de `processos`. Abrir
    // `/processos/:id` com esse número daria 404; a Central aceita `q` e resolve
    // o processo pelo número correto.
    acao: processoNumero
      ? {
        label: "Abrir processo",
        url: `/processos?tab=lista&q=${encodeURIComponent(processoNumero)}`,
      }
      : undefined,
  };
}

/**
 * Insere uma notificação vinda do realtime na lista já carregada.
 *
 * O mesmo INSERT pode chegar duas vezes (reconexão do canal, ou a linha já
 * estava na carga inicial). Duplicar inflaria o contador de não lidas e
 * mostraria o mesmo prazo duas vezes — por isso a checagem por id vem antes.
 */
export function mergeNotificacao(
  current: Notificacao[],
  incoming: Notificacao,
): Notificacao[] {
  if (current.some((item) => item.id === incoming.id)) return current;
  return [incoming, ...current];
}

/**
 * Reconcilia o snapshot do banco com eventos que já chegaram pelo realtime.
 * O item mais novo por id vence e a lista volta ordenada por data. Isso fecha
 * a corrida "INSERT chegou enquanto list() ainda estava pendente" sem perder
 * nenhum dos dois lados.
 */
export function reconciliarNotificacoes(
  current: Notificacao[],
  loaded: Notificacao[],
  touchedAfterSnapshot: ReadonlySet<string> = new Set(),
): Notificacao[] {
  // O snapshot fresco do banco é autoritativo: linha ausente foi arquivada e
  // linha presente carrega o estado de leitura atual. A única exceção são ids
  // que o realtime tocou DEPOIS que a consulta começou — nesses casos o estado
  // da tela é mais novo que o snapshot retornado.
  const byId = new Map(loaded.map((item) => [item.id, item]));
  const currentById = new Map(current.map((item) => [item.id, item]));
  for (const id of touchedAfterSnapshot) {
    const item = currentById.get(id);
    if (item) byId.set(id, item);
    else byId.delete(id); // UPDATE de arquivamento removeu durante a consulta
  }
  return [...byId.values()].sort(
    (a, b) => b.dataNotificacao.getTime() - a.dataNotificacao.getTime(),
  );
}

/** Aplica UPDATE realtime ou remove a linha que foi arquivada em outra tela. */
export function aplicarAtualizacaoNotificacao(
  current: Notificacao[],
  updated: Notificacao,
  archived: boolean,
): Notificacao[] {
  if (archived) return current.filter((item) => item.id !== updated.id);
  const index = current.findIndex((item) => item.id === updated.id);
  if (index < 0) return mergeNotificacao(current, updated);
  return current.map((item) => item.id === updated.id ? updated : item);
}

/** Não lidas na lista carregada — o número que aparece no sino. */
export function contarNaoLidas(items: Notificacao[]): number {
  return items.filter((item) => !item.lida).length;
}

/** Uma linha pertence ao tenant aberto; sem tenant, apenas legado sem tenant. */
export function notificacaoPertenceAoTenant(
  rowTenantId: string | null | undefined,
  tenantId: string | null | undefined,
): boolean {
  return tenantId
    ? !rowTenantId || rowTenantId === tenantId
    : !rowTenantId;
}

/** Callback já enfileirado de outro usuário/tenant nunca toca o escopo atual. */
export function eventoPertenceAoEscopo(
  eventScope: string,
  currentScope: string,
): boolean {
  return eventScope === currentScope;
}
