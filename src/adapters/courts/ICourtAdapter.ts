/**
 * INTERFACE PADRONIZADA PARA ADAPTERS DE TRIBUNAIS
 *
 * Todos os adapters de tribunais devem implementar esta interface.
 * Isso garante consistência na comunicação entre o Horus e os tribunais.
 */

import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export interface ICourtAdapter {
  /**
   * Sigla do tribunal (ex: "STF", "TJAM", "TRF1")
   */
  readonly sigla: string;

  /**
   * Nome completo do tribunal
   */
  readonly nome: string;

  /**
   * Tipo de tribunal
   */
  readonly tipo: "TJ" | "TRF" | "TRT" | "SUPERIOR";

  /**
   * URL base do tribunal
   */
  readonly urlBase: string;

  /**
   * Busca processos vinculados a uma OAB
   *
   * @param oab Número da OAB (apenas números)
   * @param seccional Sigla da seccional (ex: "AM", "SP")
   * @returns Lista de processos encontrados
   */
  searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]>;

  /**
   * Busca movimentações de um processo específico
   *
   * @param numeroCNJ Número CNJ do processo
   * @returns Lista de movimentações
   */
  getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]>;

  /**
   * Busca detalhes completos de um processo
   *
   * @param numeroCNJ Número CNJ do processo
   * @returns Dados do processo
   */
  getDetails(numeroCNJ: string): Promise<ProcessoNormalizado>;

  /**
   * Verifica se o adapter está funcionando
   *
   * @returns true se o tribunal está acessível
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Adapter base com implementações comuns
 */
export abstract class BaseCourtAdapter implements ICourtAdapter {
  abstract readonly sigla: string;
  abstract readonly nome: string;
  abstract readonly tipo: "TJ" | "TRF" | "TRT" | "SUPERIOR";
  abstract readonly urlBase: string;

  abstract searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]>;
  abstract getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]>;
  abstract getDetails(numeroCNJ: string): Promise<ProcessoNormalizado>;

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.urlBase, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Normaliza número de OAB (remove caracteres especiais)
   */
  protected normalizeOAB(oab: string): string {
    return oab.replace(/\D/g, "");
  }

  /**
   * Normaliza número CNJ
   */
  protected normalizeCNJ(numeroCNJ: string): string {
    return numeroCNJ.replace(/\D/g, "");
  }

  /**
   * Gera delay entre requisições (respeita rate limiting)
   */
  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log de operações do adapter
   */
  protected log(mensagem: string, tipo: "info" | "error" | "warn" = "info"): void {
    const prefixo = `🦅 [${this.sigla}]`;

    switch (tipo) {
      case "error":
        console.error(prefixo, mensagem);
        break;
      case "warn":
        console.warn(prefixo, mensagem);
        break;
      default:
        console.log(prefixo, mensagem);
    }
  }
}
