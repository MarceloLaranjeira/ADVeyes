/**
 * 🦅 HORUS - Adapter STF (Supremo Tribunal Federal)
 *
 * Consulta processos no STF através da API pública.
 * URL base: https://transparencia.stf.jus.br/
 */

import type { ICourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class STFAdapter implements ICourtAdapter {
  readonly sigla = "STF";
  readonly nome = "Supremo Tribunal Federal";
  readonly tipo = "SUPERIOR" as const;

  private baseURL = "https://transparencia.stf.jus.br/extensions/api_rest_v2/api_rest_v2.php";

  /**
   * Busca processos por OAB
   */
  async searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]> {
    try {
      // STF não possui busca direta por OAB na API pública
      // Simulação para demonstração - em produção, seria necessário:
      // 1. Scraping do portal ou
      // 2. Integração com API oficial (caso exista) ou
      // 3. Uso de serviços third-party

      console.log(`🦅 STF: Buscando processos para OAB ${oab}/${seccional}`);

      // Placeholder - retorna array vazio
      // Em produção, implementar chamada real à API ou scraping
      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar processos no STF:", error);
      throw new Error(`Erro ao consultar STF: ${error}`);
    }
  }

  /**
   * Busca movimentações de um processo específico
   */
  async getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    try {
      console.log(`🦅 STF: Buscando movimentações do processo ${numeroCNJ}`);

      // Extrai número do processo (remove formatação CNJ)
      const numeroLimpo = numeroCNJ.replace(/\D/g, "");

      // Placeholder - em produção, fazer requisição real
      const response = await fetch(`${this.baseURL}?action=getMovimentacoes&processo=${numeroLimpo}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Normalizar resposta para formato padrão
      return this.normalizarMovimentacoes(data);
    } catch (error) {
      console.error("❌ Erro ao buscar movimentações no STF:", error);
      return [];
    }
  }

  /**
   * Busca detalhes completos de um processo
   */
  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    try {
      console.log(`🦅 STF: Buscando detalhes do processo ${numeroCNJ}`);

      const numeroLimpo = numeroCNJ.replace(/\D/g, "");

      // Placeholder - em produção, fazer requisição real
      const response = await fetch(`${this.baseURL}?action=getProcesso&numero=${numeroLimpo}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return this.normalizarProcesso(data, numeroCNJ);
    } catch (error) {
      console.error("❌ Erro ao buscar detalhes no STF:", error);
      throw error;
    }
  }

  /**
   * Verifica disponibilidade da API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.baseURL, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Métodos auxiliares de normalização ───

  private normalizarProcesso(data: any, numeroCNJ: string): ProcessoNormalizado {
    return {
      numeroCNJ,
      tribunal: this.sigla,
      classe: data.classe || "N/A",
      assunto: data.assunto || "N/A",
      dataDistribuicao: data.dataDistribuicao ? new Date(data.dataDistribuicao) : new Date(),
      polo: {
        ativo: data.parteAtiva || "Não informado",
        passivo: data.partePassiva || "Não informado",
      },
      advogados: data.advogados || [],
      status: data.situacao || "Em andamento",
      valorCausa: data.valorCausa,
      orgaoJulgador: data.orgao || "STF",
      relator: data.relator,
      ultimaMovimentacao: data.ultimaMovimentacao ? new Date(data.ultimaMovimentacao) : undefined,
    };
  }

  private normalizarMovimentacoes(data: any): MovimentacaoProcessual[] {
    if (!Array.isArray(data)) return [];

    return data.map((mov: any) => ({
      id: mov.id || crypto.randomUUID(),
      data: new Date(mov.data || Date.now()),
      descricao: mov.descricao || "Movimentação",
      tipo: this.classificarTipoMovimentacao(mov.descricao || ""),
      complemento: mov.complemento,
      temPrazo: mov.temPrazo || false,
      prazoFatal: mov.prazoFatal ? new Date(mov.prazoFatal) : undefined,
    }));
  }

  private classificarTipoMovimentacao(descricao: string): string {
    const desc = descricao.toLowerCase();

    if (desc.includes("sentença") || desc.includes("acórdão")) return "SENTENCA";
    if (desc.includes("intimação") || desc.includes("citação")) return "INTIMACAO";
    if (desc.includes("recurso")) return "RECURSO";
    if (desc.includes("audiência")) return "AUDIENCIA";
    if (desc.includes("despacho")) return "DESPACHO";
    if (desc.includes("decisão")) return "DECISAO";

    return "GERAL";
  }
}

// Export singleton instance
export const stfAdapter = new STFAdapter();
