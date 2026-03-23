/**
 * 🦅 HORUS - Adapter TST (Tribunal Superior do Trabalho)
 *
 * Consulta processos no TST através da API pública PJe.
 * URL base: https://pje.tst.jus.br/
 */

import type { ICourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class TSTAdapter implements ICourtAdapter {
  readonly sigla = "TST";
  readonly nome = "Tribunal Superior do Trabalho";
  readonly tipo = "SUPERIOR" as const;

  private baseURL = "https://pje.tst.jus.br/consultaprocessual/";

  /**
   * Busca processos por OAB
   */
  async searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]> {
    try {
      console.log(`🦅 TST: Buscando processos para OAB ${oab}/${seccional}`);

      // TST possui consulta por advogado no PJe
      // Endpoint (requer autenticação): /api/processos/advogado/{oab}
      // Para acesso público, usar web scraping do portal de consulta

      // Placeholder - em produção implementar:
      // 1. Autenticação via certificado digital (e-PJe)
      // 2. Scraping da consulta pública
      // 3. Integração com API DataJud do CNJ

      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar processos no TST:", error);
      throw new Error(`Erro ao consultar TST: ${error}`);
    }
  }

  /**
   * Busca movimentações de um processo específico
   */
  async getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    try {
      console.log(`🦅 TST: Buscando movimentações do processo ${numeroCNJ}`);

      const numeroLimpo = numeroCNJ.replace(/\D/g, "");

      // Consulta pública disponível em:
      // https://pje.tst.jus.br/consultaprocessual/detalhe-processo/{numero}
      // Requer parsing do HTML retornado

      // Placeholder - retorna vazio
      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar movimentações no TST:", error);
      return [];
    }
  }

  /**
   * Busca detalhes completos de um processo
   */
  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    try {
      console.log(`🦅 TST: Buscando detalhes do processo ${numeroCNJ}`);

      // Placeholder - estrutura mínima
      return {
        numeroCNJ,
        tribunal: this.sigla,
        classe: "Recurso de Revista",
        assunto: "Direito do Trabalho",
        dataDistribuicao: new Date(),
        polo: {
          ativo: "Reclamante",
          passivo: "Reclamada",
        },
        advogados: [],
        status: "Em tramitação",
        orgaoJulgador: "TST",
      };
    } catch (error) {
      console.error("❌ Erro ao buscar detalhes no TST:", error);
      throw error;
    }
  }

  /**
   * Verifica disponibilidade do PJe
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch("https://pje.tst.jus.br", { method: "HEAD" });
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
      classe: data.classe || "Recurso de Revista",
      assunto: data.assunto || "Direito do Trabalho",
      dataDistribuicao: data.dataAutuacao ? new Date(data.dataAutuacao) : new Date(),
      polo: {
        ativo: data.reclamante || data.recorrente || "Reclamante",
        passivo: data.reclamado || data.recorrido || "Reclamada",
      },
      advogados: this.extrairAdvogados(data.advogados),
      status: data.situacao || "Em tramitação",
      valorCausa: data.valorCausa,
      orgaoJulgador: data.orgaoJulgador || "TST",
      relator: data.ministroRelator,
      ultimaMovimentacao: data.ultimaMovimentacao ? new Date(data.ultimaMovimentacao) : undefined,
    };
  }

  private extrairAdvogados(advogadosData: any): string[] {
    if (!advogadosData) return [];
    if (Array.isArray(advogadosData)) {
      return advogadosData.map((adv) => {
        if (typeof adv === "string") return adv;
        return `${adv.nome} (OAB ${adv.oab})`;
      });
    }
    return [];
  }

  private normalizarMovimentacoes(data: any): MovimentacaoProcessual[] {
    if (!Array.isArray(data)) return [];

    return data.map((mov: any) => ({
      id: mov.id || crypto.randomUUID(),
      data: new Date(mov.dataHora || Date.now()),
      descricao: mov.descricao || "Movimentação",
      tipo: this.classificarTipoMovimentacao(mov.descricao || ""),
      complemento: mov.complemento,
      temPrazo: mov.prazo ? true : false,
      prazoFatal: mov.prazo ? new Date(mov.prazo) : undefined,
    }));
  }

  private classificarTipoMovimentacao(descricao: string): string {
    const desc = descricao.toLowerCase();

    if (desc.includes("acórdão") || desc.includes("julgado")) return "SENTENCA";
    if (desc.includes("intimação") || desc.includes("publicação")) return "INTIMACAO";
    if (desc.includes("recurso") || desc.includes("agravo")) return "RECURSO";
    if (desc.includes("audiência") || desc.includes("pauta")) return "AUDIENCIA";
    if (desc.includes("decisão") || desc.includes("despacho")) return "DECISAO";
    if (desc.includes("prazo")) return "PRAZO";

    return "GERAL";
  }
}

// Export singleton instance
export const tstAdapter = new TSTAdapter();
