/**
 * HORUS DISCOVERY ENGINE
 *
 * Motor de descoberta automática de processos.
 * Consulta TODOS os tribunais catalogados em busca de processos
 * vinculados à OAB do advogado.
 *
 * FLUXO:
 * 1. Advogado salva OAB no perfil
 * 2. HorusDiscoveryEngine.discover(oab, seccional) é disparado
 * 3. Consultas paralelas a todos os tribunais ativos
 * 4. Normalização e classificação dos processos encontrados
 * 5. Persistência no banco de dados
 * 6. Notificação ao advogado via HorusNotifier
 */

import type {
  OABData,
  ProcessoNormalizado,
  ResultadoBuscaTribunal,
  StatusDiscovery,
} from "./types";
import { HorusNotifier } from "./HorusNotifier";
import { supabase } from "@/integrations/supabase/client";

export class HorusDiscoveryEngine {
  private static instance: HorusDiscoveryEngine;
  private discovering = false;

  private constructor() {}

  static getInstance(): HorusDiscoveryEngine {
    if (!HorusDiscoveryEngine.instance) {
      HorusDiscoveryEngine.instance = new HorusDiscoveryEngine();
    }
    return HorusDiscoveryEngine.instance;
  }

  /**
   * Inicia descoberta automática de processos por OAB
   */
  async discover(oabData: OABData): Promise<StatusDiscovery> {
    if (this.discovering) {
      throw new Error("Horus já está realizando uma descoberta. Aguarde a conclusão.");
    }

    this.discovering = true;

    console.log(`🦅 Horus iniciando descoberta para OAB ${oabData.seccional}-${oabData.numero}`);

    const status: StatusDiscovery = {
      oab: oabData.numero,
      seccional: oabData.seccional,
      emAndamento: true,
      tribunaisConsultados: 0,
      tribunaisPendentes: 0,
      processosEncontrados: 0,
      ultimaAtualizacao: new Date(),
      erros: [],
    };

    try {
      // TODO: Carregar lista de tribunais ativos do banco
      const tribunais = await this.getTribunaisAtivos();
      status.tribunaisPendentes = tribunais.length;

      // Consultas paralelas a todos os tribunais
      const resultados = await Promise.allSettled(
        tribunais.map((tribunal) => this.consultarTribunal(tribunal, oabData))
      );

      // Processar resultados
      for (const resultado of resultados) {
        status.tribunaisConsultados++;

        if (resultado.status === "fulfilled" && resultado.value.sucesso) {
          const { processosEncontrados } = resultado.value;

          // Persistir processos encontrados
          for (const processo of processosEncontrados) {
            await this.salvarProcesso(processo, oabData);
            status.processosEncontrados++;
          }
        } else if (resultado.status === "rejected") {
          const tribunal = resultado.reason?.tribunal || "Desconhecido";
          status.erros.push({
            tribunal,
            mensagem: resultado.reason?.message || "Erro desconhecido",
          });
        }

        status.tribunaisPendentes--;
        status.ultimaAtualizacao = new Date();
      }

      status.emAndamento = false;

      // Notificar advogado sobre descoberta concluída
      await HorusNotifier.notificarDescobertaConcluida(
        oabData,
        status.processosEncontrados
      );

      console.log(
        `🦅 Horus concluiu descoberta: ${status.processosEncontrados} processos encontrados em ${status.tribunaisConsultados} tribunais.`
      );

      return status;
    } catch (error) {
      status.emAndamento = false;
      status.erros.push({
        tribunal: "SISTEMA",
        mensagem: error instanceof Error ? error.message : "Erro desconhecido",
      });

      console.error("🦅 Horus: Erro na descoberta:", error);
      throw error;
    } finally {
      this.discovering = false;
    }
  }

  /**
   * Carrega lista de tribunais ativos
   */
  private async getTribunaisAtivos(): Promise<string[]> {
    // TODO: Carregar do banco de dados
    // Por enquanto, retorna lista hardcoded dos tribunais prioritários
    return [
      "STF",
      "STJ",
      "TST",
      "TJAM", // Amazonas (exemplo da screenshot)
      "TRF1",
      "TRT11",
      // ... mais tribunais serão adicionados na FASE 5
    ];
  }

  /**
   * Consulta um tribunal específico por OAB
   */
  private async consultarTribunal(
    tribunal: string,
    oabData: OABData
  ): Promise<ResultadoBuscaTribunal> {
    const inicio = Date.now();

    try {
      console.log(`🦅 Horus consultando ${tribunal}...`);

      // TODO: Implementar adapters reais para cada tribunal
      // Por enquanto, retorna mock
      const processosEncontrados: ProcessoNormalizado[] = [];

      // Simula consulta (remover quando adapters reais forem implementados)
      await new Promise((resolve) => setTimeout(resolve, 500));

      return {
        tribunal,
        sucesso: true,
        processosEncontrados,
        tempoExecucao: Date.now() - inicio,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`🦅 Horus: Erro ao consultar ${tribunal}:`, error);

      return {
        tribunal,
        sucesso: false,
        processosEncontrados: [],
        erros: [error instanceof Error ? error.message : "Erro desconhecido"],
        tempoExecucao: Date.now() - inicio,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Salva processo descoberto no banco de dados
   */
  private async salvarProcesso(
    processo: ProcessoNormalizado,
    oabData: OABData
  ): Promise<void> {
    try {
      const { data: session } = await supabase.auth.getUser();
      if (!session?.user) {
        throw new Error("Usuário não autenticado");
      }

      // TODO: Salvar no Supabase
      // Estrutura: tabela processos_monitorados
      console.log(`🦅 Horus salvando processo ${processo.numeroCNJ}...`);

      // Implementação real virá aqui
    } catch (error) {
      console.error(`🦅 Horus: Erro ao salvar processo ${processo.numeroCNJ}:`, error);
      throw error;
    }
  }

  /**
   * Verifica se há descoberta em andamento
   */
  isDiscovering(): boolean {
    return this.discovering;
  }
}

export const horusDiscovery = HorusDiscoveryEngine.getInstance();
