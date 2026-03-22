/**
 * HORUS NOTIFIER
 *
 * Sistema de notificações multi-canal do ADVeyes.
 * Todas as notificações são assinadas com "🦅 Horus" para
 * identificar que vêm da IA interna.
 *
 * CANAIS:
 * - Web: Toast notifications + Badge no sino
 * - Mobile: Push notifications (PWA)
 * - Email: Resumos diários + alertas críticos
 */

import type { OABData, NotificacaoHorus } from "./types";
import { toast } from "sonner";

export class HorusNotifier {
  /**
   * Notifica conclusão da descoberta de processos
   */
  static async notificarDescobertaConcluida(
    oabData: OABData,
    totalProcessos: number
  ): Promise<void> {
    const mensagem =
      totalProcessos === 0
        ? `🦅 Horus concluiu a varredura inicial. Nenhum processo encontrado vinculado à OAB ${oabData.seccional}-${oabData.numero}.`
        : `🦅 Horus concluiu a varredura inicial!\n\nEncontrei ${totalProcessos} processo${totalProcessos > 1 ? "s" : ""} vinculado${totalProcessos > 1 ? "s" : ""} à sua OAB.\nTudo já está organizado no seu painel ADVeyes.`;

    // Notificação web
    toast.success(mensagem, {
      duration: 8000,
      description: totalProcessos > 0 ? "Acesse o menu Publicações para visualizar." : undefined,
    });

    // TODO: Enviar push notification mobile
    // TODO: Enviar email (se configurado)

    // Salvar notificação no banco
    await this.salvarNotificacao({
      id: crypto.randomUUID(),
      tipo: "GERAL",
      urgencia: "MEDIA",
      titulo: "🦅 Descoberta de Processos Concluída",
      mensagem,
      dataNotificacao: new Date(),
      lida: false,
    });
  }

  /**
   * Notifica nova movimentação processual
   */
  static async notificarNovaMovimentacao(
    numeroCNJ: string,
    tipoMovimentacao: string,
    resumo: string,
    urgencia: "CRITICA" | "ALTA" | "MEDIA" | "BAIXA" = "MEDIA"
  ): Promise<void> {
    const mensagem = `🦅 Processo ${numeroCNJ}\n${resumo}`;

    const toastConfig = {
      duration: urgencia === "CRITICA" ? 0 : 6000, // Crítica não fecha automaticamente
      description: `Tipo: ${tipoMovimentacao}`,
    };

    if (urgencia === "CRITICA") {
      toast.error(mensagem, toastConfig);
    } else if (urgencia === "ALTA") {
      toast.warning(mensagem, toastConfig);
    } else {
      toast.info(mensagem, toastConfig);
    }

    await this.salvarNotificacao({
      id: crypto.randomUUID(),
      tipo: "NOVA_MOVIMENTACAO",
      urgencia,
      titulo: `🦅 ${tipoMovimentacao}`,
      mensagem,
      dataNotificacao: new Date(),
      lida: false,
    });
  }

  /**
   * Notifica prazo vencendo
   */
  static async notificarPrazoVencendo(
    numeroCNJ: string,
    descricaoPrazo: string,
    diasRestantes: number
  ): Promise<void> {
    const urgencia = diasRestantes <= 2 ? "CRITICA" : diasRestantes <= 5 ? "ALTA" : "MEDIA";

    const mensagem =
      diasRestantes === 0
        ? `🚨 HORUS — ALERTA CRÍTICO!\n\nProcesso ${numeroCNJ}\n${descricaoPrazo}\n\n⏰ PRAZO VENCE HOJE!`
        : `🦅 Processo ${numeroCNJ}\n${descricaoPrazo}\n\n⏰ Vence em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""} úteis.`;

    toast.error(mensagem, {
      duration: urgencia === "CRITICA" ? 0 : 8000,
      action:
        urgencia === "CRITICA"
          ? {
              label: "Ver Processo",
              onClick: () => {
                // TODO: Navegar para o processo
              },
            }
          : undefined,
    });

    await this.salvarNotificacao({
      id: crypto.randomUUID(),
      tipo: "PRAZO_VENCENDO",
      urgencia,
      titulo: `🦅 Prazo Processual ${urgencia === "CRITICA" ? "— VENCE HOJE" : ""}`,
      mensagem,
      dataNotificacao: new Date(),
      lida: false,
    });
  }

  /**
   * Notifica sentença publicada
   */
  static async notificarSentenca(
    numeroCNJ: string,
    resultado: string,
    prazoRecurso?: { dias: number; dataFinal: Date }
  ): Promise<void> {
    let mensagem = `🚨 SENTENÇA PUBLICADA!\n\nProcesso ${numeroCNJ}\n${resultado}`;

    if (prazoRecurso) {
      mensagem += `\n\n⏰ Prazo para recurso: ${prazoRecurso.dias} dias úteis (até ${prazoRecurso.dataFinal.toLocaleDateString("pt-BR")})`;
    }

    toast.error(mensagem, {
      duration: 0, // Não fecha automaticamente
      action: {
        label: "Ver Sentença",
        onClick: () => {
          // TODO: Abrir detalhes da sentença
        },
      },
    });

    await this.salvarNotificacao({
      id: crypto.randomUUID(),
      tipo: "SENTENCA",
      urgencia: "CRITICA",
      titulo: "🦅 Sentença Publicada",
      mensagem,
      dataNotificacao: new Date(),
      lida: false,
    });
  }

  /**
   * Resumo diário
   */
  static async enviarResumoDiario(
    nomeAdvogado: string,
    dados: {
      prazosHoje: number;
      prazosSemana: number;
      novasMovimentacoes: number;
      audiencias: number;
    }
  ): Promise<void> {
    const mensagem = `☀️ Bom dia, Dr(a). ${nomeAdvogado}! Horus preparou seu resumo:

Hoje você tem:
• ${dados.prazosHoje} prazo${dados.prazosHoje !== 1 ? "s" : ""} vencendo
• ${dados.audiencias} audiência${dados.audiencias !== 1 ? "s" : ""}
• ${dados.novasMovimentacoes} nova${dados.novasMovimentacoes !== 1 ? "s" : ""} movimentação${dados.novasMovimentacoes !== 1 ? "ões" : ""}

Esta semana: ${dados.prazosSemana} prazo${dados.prazosSemana !== 1 ? "s" : ""} para acompanhar.

Tudo organizado e pronto no ADVeyes. 🦅`;

    toast.info(mensagem, {
      duration: 10000,
    });

    // TODO: Enviar email com resumo completo
  }

  /**
   * Salva notificação no banco de dados
   */
  private static async salvarNotificacao(notificacao: NotificacaoHorus): Promise<void> {
    try {
      // TODO: Salvar no Supabase
      console.log("🦅 Horus salvando notificação:", notificacao.titulo);
    } catch (error) {
      console.error("🦅 Horus: Erro ao salvar notificação:", error);
    }
  }

  /**
   * Marca notificação como lida
   */
  static async marcarComoLida(notificacaoId: string): Promise<void> {
    try {
      // TODO: Atualizar no Supabase
      console.log("🦅 Horus: Notificação marcada como lida:", notificacaoId);
    } catch (error) {
      console.error("🦅 Horus: Erro ao marcar notificação:", error);
    }
  }
}
