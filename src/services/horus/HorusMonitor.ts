/**
 * HORUS MONITOR — Sistema de Monitoramento 24/7
 *
 * Monitora continuamente todos os processos vinculados à OAB do advogado.
 * Detecta novas movimentações, intimações, sentenças e prazos.
 *
 * ARQUITETURA:
 * - CRON jobs por tribunal (intervalo configurável)
 * - Workers paralelos para consultas
 * - Comparação de hash para evitar duplicatas
 * - Classificação automática de urgência
 * - Notificações multi-canal via HorusNotifier
 */

import type {
  ProcessoNormalizado,
  MovimentacaoProcessual,
  MetricasHorus,
} from "./types";
import { HorusNotifier } from "./HorusNotifier";

export class HorusMonitor {
  private static instance: HorusMonitor;
  private monitorando = false;
  private intervalos: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  static getInstance(): HorusMonitor {
    if (!HorusMonitor.instance) {
      HorusMonitor.instance = new HorusMonitor();
    }
    return HorusMonitor.instance;
  }

  /**
   * Inicia monitoramento contínuo
   */
  async iniciar(): Promise<void> {
    if (this.monitorando) {
      console.log("🦅 Horus Monitor já está ativo.");
      return;
    }

    this.monitorando = true;
    console.log("🦅 Horus Monitor iniciado. Monitoramento contínuo ativo.");

    // TODO: Configurar CRON jobs para cada tribunal
    // Frequências definidas no prompt:
    // - STF, STJ, TST, TSE: 30 min
    // - TRFs, TRTs: 1h
    // - TJs: 2h
    // - Juizados: 3h
    // - Varredura completa: 1x/dia às 06:00

    // Por enquanto, inicia verificação periódica básica
    this.agendarVerificacaoPeriodica();
  }

  /**
   * Para monitoramento
   */
  async parar(): Promise<void> {
    this.monitorando = false;

    // Limpa todos os intervalos
    this.intervalos.forEach((intervalo) => clearInterval(intervalo));
    this.intervalos.clear();

    console.log("🦅 Horus Monitor parado.");
  }

  /**
   * Agenda verificações periódicas
   */
  private agendarVerificacaoPeriodica(): void {
    // Verificação a cada 30 minutos (tribunais superiores)
    const intervaloSuperiores = setInterval(() => {
      this.verificarTribunaisSuperiores();
    }, 30 * 60 * 1000);

    // Verificação a cada 1 hora (TRFs, TRTs)
    const intervaloRegionais = setInterval(() => {
      this.verificarTribunaisRegionais();
    }, 60 * 60 * 1000);

    // Verificação a cada 2 horas (TJs)
    const intervaloEstaduais = setInterval(() => {
      this.verificarTribunaisEstaduais();
    }, 2 * 60 * 60 * 1000);

    this.intervalos.set("superiores", intervaloSuperiores);
    this.intervalos.set("regionais", intervaloRegionais);
    this.intervalos.set("estaduais", intervaloEstaduais);

    // Execução imediata da primeira verificação
    this.verificarTribunaisSuperiores();
  }

  /**
   * Verifica tribunais superiores (STF, STJ, TST, TSE, STM)
   */
  private async verificarTribunaisSuperiores(): Promise<void> {
    console.log("🦅 Horus verificando tribunais superiores...");

    const tribunais = ["STF", "STJ", "TST", "TSE", "STM"];

    for (const tribunal of tribunais) {
      await this.verificarTribunal(tribunal);
    }
  }

  /**
   * Verifica tribunais regionais (TRFs, TRTs)
   */
  private async verificarTribunaisRegionais(): Promise<void> {
    console.log("🦅 Horus verificando tribunais regionais...");

    const trfs = ["TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6"];
    const trts = Array.from({ length: 24 }, (_, i) => `TRT${i + 1}`);

    for (const tribunal of [...trfs, ...trts]) {
      await this.verificarTribunal(tribunal);
    }
  }

  /**
   * Verifica tribunais estaduais
   */
  private async verificarTribunaisEstaduais(): Promise<void> {
    console.log("🦅 Horus verificando tribunais estaduais...");

    // Lista completa de TJs será carregada do banco
    const tjs = [
      "TJAC", "TJAL", "TJAM", "TJAP", "TJBA", "TJCE", "TJDFT", "TJES",
      "TJGO", "TJMA", "TJMG", "TJMS", "TJMT", "TJPA", "TJPB", "TJPE",
      "TJPI", "TJPR", "TJRJ", "TJRN", "TJRO", "TJRR", "TJRS", "TJSC",
      "TJSE", "TJSP", "TJTO",
    ];

    for (const tribunal of tjs) {
      await this.verificarTribunal(tribunal);
    }
  }

  /**
   * Verifica movimentações em um tribunal específico
   */
  private async verificarTribunal(tribunal: string): Promise<void> {
    try {
      // TODO: Carregar processos monitorados deste tribunal
      const processos = await this.getProcessosMonitorados(tribunal);

      for (const processo of processos) {
        const novasMovimentacoes = await this.buscarNovasMovimentacoes(processo);

        for (const movimentacao of novasMovimentacoes) {
          // Salvar movimentação
          await this.salvarMovimentacao(movimentacao);

          // Notificar advogado
          await HorusNotifier.notificarNovaMovimentacao(
            processo.numeroCNJ,
            movimentacao.tipoMovimentacao,
            movimentacao.descricaoResumida || movimentacao.descricao,
            movimentacao.urgencia
          );

          // Se for sentença, notificação especial
          if (movimentacao.tipoMovimentacao === "SENTENÇA") {
            await HorusNotifier.notificarSentenca(
              processo.numeroCNJ,
              movimentacao.descricaoResumida || movimentacao.descricao,
              movimentacao.prazo
                ? {
                    dias: movimentacao.prazo.quantidade,
                    dataFinal: movimentacao.prazo.dataFinal,
                  }
                : undefined
            );
          }

          // Se houver prazo, notificar
          if (movimentacao.prazo) {
            const diasRestantes = this.calcularDiasRestantes(movimentacao.prazo.dataFinal);

            if (diasRestantes <= 7) {
              await HorusNotifier.notificarPrazoVencendo(
                processo.numeroCNJ,
                movimentacao.descricaoResumida || movimentacao.descricao,
                diasRestantes
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(`🦅 Horus: Erro ao verificar ${tribunal}:`, error);
    }
  }

  /**
   * Carrega processos monitorados de um tribunal
   */
  private async getProcessosMonitorados(tribunal: string): Promise<ProcessoNormalizado[]> {
    // TODO: Carregar do Supabase
    return [];
  }

  /**
   * Busca novas movimentações de um processo
   */
  private async buscarNovasMovimentacoes(
    processo: ProcessoNormalizado
  ): Promise<MovimentacaoProcessual[]> {
    // TODO: Consultar tribunal via adapter
    // TODO: Comparar hash para detectar apenas novas movimentações
    return [];
  }

  /**
   * Salva movimentação no banco
   */
  private async salvarMovimentacao(movimentacao: MovimentacaoProcessual): Promise<void> {
    // TODO: Salvar no Supabase
    console.log(`🦅 Horus salvando movimentação: ${movimentacao.tipoMovimentacao}`);
  }

  /**
   * Calcula dias úteis restantes até uma data
   */
  private calcularDiasRestantes(dataFinal: Date): number {
    const hoje = new Date();
    const diff = dataFinal.getTime() - hoje.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Retorna métricas do Horus
   */
  async getMetricas(): Promise<MetricasHorus> {
    // TODO: Buscar métricas reais do banco
    return {
      processosMonitorados: 0,
      movimentacoesDetectadas24h: 0,
      notificacoesEnviadas24h: 0,
      tribunaisAtivos: 0,
      ultimaVarreduraCompleta: new Date(),
      proximaVarreduraCompleta: new Date(),
      taxaSucesso: 100,
    };
  }

  /**
   * Verifica se monitoramento está ativo
   */
  isMonitorando(): boolean {
    return this.monitorando;
  }
}

export const horusMonitor = HorusMonitor.getInstance();
