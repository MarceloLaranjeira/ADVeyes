/**
 * 🦅 HORUS - Adapter STJ (Superior Tribunal de Justiça)
 *
 * Consulta processos no STJ através da API pública.
 * URL base: https://www.stj.jus.br/SCON/
 */

import type { ICourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class STJAdapter implements ICourtAdapter {
  readonly sigla = "STJ";
  readonly nome = "Superior Tribunal de Justiça";
  readonly tipo = "SUPERIOR" as const;

  private baseURL = "https://processo.stj.jus.br/processo/julgamento/eletronico/";

  /**
   * Busca processos por OAB
   */
  async searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]> {
    try {
      console.log(`🦅 STJ: Buscando processos para OAB ${oab}/${seccional}`);

      // STJ não possui API pública de busca por OAB
      // Placeholder para integração futura via:
      // 1. Web scraping do portal
      // 2. Parceria institucional
      // 3. Serviços third-party (Jusbrasil, Escavador, etc)

      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar processos no STJ:", error);
      throw new Error(`Erro ao consultar STJ: ${error}`);
    }
  }

  /**
   * Busca movimentações de um processo específico
   */
  async getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    try {
      console.log(`🦅 STJ: Buscando movimentações do processo ${numeroCNJ}`);

      const numeroLimpo = numeroCNJ.replace(/\D/g, "");

      // Placeholder - em produção implementar scraping ou API oficial
      // O STJ possui consulta pública em:
      // https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroRegistro

      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar movimentações no STJ:", error);
      return [];
    }
  }

  /**
   * Busca detalhes completos de um processo
   */
  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    try {
      console.log(`🦅 STJ: Buscando detalhes do processo ${numeroCNJ}`);

      // Placeholder - retorna estrutura mínima
      return {
        numeroCNJ,
        tribunal: this.sigla,
        classe: "N/A",
        assunto: "N/A",
        dataDistribuicao: new Date(),
        polo: {
          ativo: "Não informado",
          passivo: "Não informado",
        },
        advogados: [],
        status: "Consulta indisponível - API em desenvolvimento",
        orgaoJulgador: "STJ",
      };
    } catch (error) {
      console.error("❌ Erro ao buscar detalhes no STJ:", error);
      throw error;
    }
  }

  /**
   * Verifica disponibilidade do portal
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch("https://www.stj.jus.br", { method: "HEAD" });
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
      dataDistribuicao: data.dataAutuacao ? new Date(data.dataAutuacao) : new Date(),
      polo: {
        ativo: data.recorrente || "Não informado",
        passivo: data.recorrido || "Não informado",
      },
      advogados: this.extrairAdvogados(data.advogados),
      status: data.situacao || "Em tramitação",
      valorCausa: data.valorCausa,
      orgaoJulgador: data.orgao || "STJ",
      relator: data.ministroRelator,
      ultimaMovimentacao: data.ultimaMovimentacao ? new Date(data.ultimaMovimentacao) : undefined,
    };
  }

  private extrairAdvogados(advogadosData: any): string[] {
    if (!advogadosData) return [];
    if (Array.isArray(advogadosData)) {
      return advogadosData.map((adv) => adv.nome || adv);
    }
    return [];
  }

  private normalizarMovimentacoes(data: any): MovimentacaoProcessual[] {
    if (!Array.isArray(data)) return [];

    return data.map((mov: any) => ({
      id: mov.id || crypto.randomUUID(),
      data: new Date(mov.dataHora || Date.now()),
      descricao: mov.nome || "Movimentação",
      tipo: this.classificarTipoMovimentacao(mov.nome || ""),
      complemento: mov.complemento,
      temPrazo: false,
    }));
  }

  private classificarTipoMovimentacao(descricao: string): string {
    const desc = descricao.toLowerCase();

    if (desc.includes("acórdão") || desc.includes("julgamento")) return "SENTENCA";
    if (desc.includes("intimação") || desc.includes("publicação")) return "INTIMACAO";
    if (desc.includes("agravo") || desc.includes("recurso")) return "RECURSO";
    if (desc.includes("vista")) return "VISTA";
    if (desc.includes("decisão") || desc.includes("despacho")) return "DECISAO";

    return "GERAL";
  }
}

// Export singleton instance
export const stjAdapter = new STJAdapter();
