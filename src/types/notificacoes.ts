/**
 * Notificações exibidas ao advogado.
 *
 * As notificações são gravadas na tabela `notificacoes` pelas Edge Functions
 * de monitoramento e chegam ao frontend por realtime. O frontend apenas lê e
 * marca como lida — nenhuma regra de negócio de monitoramento vive aqui.
 */

export type UrgenciaNotificacao = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";

export type TipoNotificacao =
  | "NOVA_MOVIMENTACAO"
  | "PRAZO_VENCENDO"
  | "SENTENCA"
  | "INTIMACAO"
  | "GERAL";

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao;
  urgencia: UrgenciaNotificacao;
  titulo: string;
  mensagem: string;
  processoId?: string;
  movimentacaoId?: string;
  dataNotificacao: Date;
  lida: boolean;
  acao?: {
    label: string;
    url: string;
  };
}
