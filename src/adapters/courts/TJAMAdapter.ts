/**
 * 🦅 HORUS - Adapter TJAM (Tribunal de Justiça do Amazonas)
 *
 * Consulta processos no TJAM através do sistema Projudi/e-SAJ.
 * URL base: https://consultasaj.tjam.jus.br/
 */

import type { ICourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class TJAMAdapter implements ICourtAdapter {
  readonly sigla = "TJAM";
  readonly nome = "Tribunal de Justiça do Amazonas";
  readonly tipo = "TJ" as const;

  private baseURL = "https://consultasaj.tjam.jus.br/cposgtj/";

  /**
   * Busca processos por OAB
   */
  async searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]> {
    try {
      console.log(`🦅 TJAM: Buscando processos para OAB ${oab}/${seccional}`);

      // TJAM usa e-SAJ (Sistema de Automação da Justiça)
      // Endpoint de busca: /cposgtj/open.do
      // Parâmetros: conversationId, dadosConsulta.valorConsulta (OAB)

      // Placeholder - implementação futura via:
      // 1. Scraping do portal e-SAJ
      // 2. Integração DataJud (CNJ)
      // 3. API estadual (se disponível)

      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar processos no TJAM:", error);
      throw new Error(`Erro ao consultar TJAM: ${error}`);
    }
  }

  /**
   * Busca movimentações de um processo específico
   */
  async getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    try {
      console.log(`🦅 TJAM: Buscando movimentações do processo ${numeroCNJ}`);

      // e-SAJ endpoint: /cposgtj/show.do?processo.codigo={codigo}
      const numeroLimpo = numeroCNJ.replace(/\D/g, "");

      // Placeholder - requer implementação de scraping
      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar movimentações no TJAM:", error);
      return [];
    }
  }

  /**
   * Busca detalhes completos de um processo
   */
  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    try {
      console.log(`🦅 TJAM: Buscando detalhes do processo ${numeroCNJ}`);

      // Placeholder - retorna estrutura básica
      return {
        numeroCNJ,
        tribunal: this.sigla,
        classe: "Procedimento Comum Cível",
        assunto: "Direito Civil",
        dataDistribuicao: new Date(),
        polo: {
          ativo: "Autor",
          passivo: "Réu",
        },
        advogados: [],
        status: "Em andamento",
        orgaoJulgador: "TJAM",
        valorCausa: undefined,
      };
    } catch (error) {
      console.error("❌ Erro ao buscar detalhes no TJAM:", error);
      throw error;
    }
  }

  /**
   * Verifica disponibilidade do e-SAJ
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
      classe: data.classe || "Procedimento Comum",
      assunto: data.assunto || "N/A",
      dataDistribuicao: data.dataAutuacao ? new Date(data.dataAutuacao) : new Date(),
      polo: {
        ativo: this.extrairParte(data.partes, "AUTOR") || "Autor",
        passivo: this.extrairParte(data.partes, "REU") || "Réu",
      },
      advogados: this.extrairAdvogados(data.advogados),
      status: data.situacao || "Em andamento",
      valorCausa: data.valorCausa,
      orgaoJulgador: data.vara || data.comarca || "TJAM",
      relator: data.relator,
      ultimaMovimentacao: data.ultimaMovimentacao ? new Date(data.ultimaMovimentacao) : undefined,
    };
  }

  private extrairParte(partes: any[], tipo: "AUTOR" | "REU"): string | undefined {
    if (!Array.isArray(partes)) return undefined;

    const parte = partes.find((p) => p.tipo?.toUpperCase().includes(tipo));
    return parte?.nome;
  }

  private extrairAdvogados(advogadosData: any): string[] {
    if (!advogadosData) return [];
    if (Array.isArray(advogadosData)) {
      return advogadosData.map((adv) => {
        if (typeof adv === "string") return adv;
        return `${adv.nome}${adv.oab ? ` (OAB ${adv.oab})` : ""}`;
      });
    }
    return [];
  }

  private normalizarMovimentacoes(data: any): MovimentacaoProcessual[] {
    if (!Array.isArray(data)) return [];

    return data.map((mov: any) => ({
      id: mov.id || crypto.randomUUID(),
      data: new Date(mov.dataMovimentacao || Date.now()),
      descricao: mov.descricao || "Movimentação",
      tipo: this.classificarTipoMovimentacao(mov.descricao || ""),
      complemento: mov.complemento,
      temPrazo: this.verificarPrazo(mov.descricao),
      prazoFatal: this.extrairPrazo(mov.descricao, mov.dataMovimentacao),
    }));
  }

  private classificarTipoMovimentacao(descricao: string): string {
    const desc = descricao.toLowerCase();

    if (desc.includes("sentença")) return "SENTENCA";
    if (desc.includes("intimação") || desc.includes("citação")) return "INTIMACAO";
    if (desc.includes("recurso") || desc.includes("apelação")) return "RECURSO";
    if (desc.includes("audiência")) return "AUDIENCIA";
    if (desc.includes("decisão") || desc.includes("despacho")) return "DECISAO";
    if (desc.includes("prazo")) return "PRAZO";
    if (desc.includes("juntada")) return "JUNTADA";

    return "GERAL";
  }

  private verificarPrazo(descricao: string): boolean {
    const desc = descricao.toLowerCase();
    return desc.includes("prazo") || desc.includes("intimação") || desc.includes("cumpra-se");
  }

  private extrairPrazo(descricao: string, dataMovimentacao: string): Date | undefined {
    // Lógica simplificada - em produção, fazer parsing mais robusto
    if (!this.verificarPrazo(descricao)) return undefined;

    const dataBase = new Date(dataMovimentacao || Date.now());

    // Se mencionar prazo específico, extrair (exemplo: "prazo de 15 dias")
    const matchDias = descricao.match(/prazo\s+de\s+(\d+)\s+dias/i);
    if (matchDias) {
      const dias = parseInt(matchDias[1]);
      dataBase.setDate(dataBase.getDate() + dias);
      return dataBase;
    }

    // Prazo padrão: 15 dias úteis para intimações
    dataBase.setDate(dataBase.getDate() + 15);
    return dataBase;
  }
}

// Export singleton instance
export const tjamAdapter = new TJAMAdapter();
