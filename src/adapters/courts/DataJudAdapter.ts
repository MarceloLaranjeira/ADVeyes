/**
 * DATAJUD ADAPTER — Fonte de Dados Unificada do CNJ
 *
 * O DataJud é a plataforma nacional de dados do Judiciário brasileiro.
 * Criado pelo CNJ, centraliza informações de todos os tribunais.
 *
 * Este adapter serve como FALLBACK quando a API oficial de um
 * tribunal específico está indisponível.
 *
 * URL: https://datajud-wiki.cnj.jus.br/
 */

import { BaseCourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class DataJudAdapter extends BaseCourtAdapter {
  readonly sigla = "DATAJUD";
  readonly nome = "DataJud - CNJ";
  readonly tipo = "SUPERIOR" as const;
  readonly urlBase = "https://datajud.cnj.jus.br";

  private readonly apiKey: string | undefined;

  constructor() {
    super();
    // TODO: Carregar API key do ambiente ou banco
    this.apiKey = process.env.DATAJUD_API_KEY;
  }

  async searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]> {
    this.log(`Buscando processos para OAB ${seccional}-${oab} via DataJud...`);

    try {
      // TODO: Implementar consulta real à API do DataJud
      // Documentação: https://datajud-wiki.cnj.jus.br/api-publica

      this.log("Consulta ao DataJud em desenvolvimento. Retornando lista vazia.", "warn");
      return [];
    } catch (error) {
      this.log(`Erro ao consultar DataJud: ${error}`, "error");
      throw error;
    }
  }

  async getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    this.log(`Buscando movimentações do processo ${numeroCNJ} via DataJud...`);

    try {
      // TODO: Implementar consulta de movimentações
      return [];
    } catch (error) {
      this.log(`Erro ao buscar movimentações: ${error}`, "error");
      throw error;
    }
  }

  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    this.log(`Buscando detalhes do processo ${numeroCNJ} via DataJud...`);

    try {
      // TODO: Implementar consulta de detalhes
      throw new Error("DataJud getDetails não implementado");
    } catch (error) {
      this.log(`Erro ao buscar detalhes: ${error}`, "error");
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Verifica se a API do DataJud está acessível
      const response = await fetch(`${this.urlBase}/api/status`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

export const dataJudAdapter = new DataJudAdapter();
