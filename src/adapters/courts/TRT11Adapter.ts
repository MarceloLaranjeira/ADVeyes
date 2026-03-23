/**
 * 🦅 HORUS - Adapter TRT11 (Tribunal Regional do Trabalho da 11ª Região)
 *
 * Consulta processos no TRT11 através do sistema PJe-JT.
 * URL base: https://pje.trt11.jus.br/
 * Jurisdição: Amazonas e Roraima
 */

import type { ICourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class TRT11Adapter implements ICourtAdapter {
  readonly sigla = "TRT11";
  readonly nome = "Tribunal Regional do Trabalho da 11ª Região";
  readonly tipo = "TRT" as const;

  private baseURL = "https://pje.trt11.jus.br/consultaprocessual/";

  /**
   * Busca processos por OAB
   */
  async searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]> {
    try {
      console.log(`🦅 TRT11: Buscando processos para OAB ${oab}/${seccional}`);

      // TRT11 utiliza PJe-JT (Processo Judicial Eletrônico da Justiça do Trabalho)
      // Consulta pública: /consultaprocessual/pages/consultas/ConsultaProcessual.seam

      // Placeholder - implementação futura via:
      // 1. Scraping do PJe-JT consulta pública
      // 2. API DataJud (CNJ)
      // 3. Certificado digital para acesso autenticado

      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar processos no TRT11:", error);
      throw new Error(`Erro ao consultar TRT11: ${error}`);
    }
  }

  /**
   * Busca movimentações de um processo específico
   */
  async getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    try {
      console.log(`🦅 TRT11: Buscando movimentações do processo ${numeroCNJ}`);

      const numeroLimpo = numeroCNJ.replace(/\D/g, "");

      // Consulta pública PJe-JT:
      // /consultaprocessual/detalhe-processo/{numero}

      // Placeholder - requer scraping
      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar movimentações no TRT11:", error);
      return [];
    }
  }

  /**
   * Busca detalhes completos de um processo
   */
  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    try {
      console.log(`🦅 TRT11: Buscando detalhes do processo ${numeroCNJ}`);

      // Placeholder - estrutura básica
      return {
        numeroCNJ,
        tribunal: this.sigla,
        classe: "Reclamação Trabalhista",
        assunto: "Direito do Trabalho",
        dataDistribuicao: new Date(),
        polo: {
          ativo: "Reclamante",
          passivo: "Reclamada",
        },
        advogados: [],
        status: "Em andamento",
        orgaoJulgador: "TRT11",
        valorCausa: undefined,
      };
    } catch (error) {
      console.error("❌ Erro ao buscar detalhes no TRT11:", error);
      throw error;
    }
  }

  /**
   * Verifica disponibilidade do PJe-JT
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch("https://pje.trt11.jus.br", { method: "HEAD" });
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
      classe: data.classe || "Reclamação Trabalhista",
      assunto: data.assunto || "Direito do Trabalho",
      dataDistribuicao: data.dataAutuacao ? new Date(data.dataAutuacao) : new Date(),
      polo: {
        ativo: this.extrairParte(data.partes, "RECLAMANTE") || "Reclamante",
        passivo: this.extrairParte(data.partes, "RECLAMADA") || "Reclamada",
      },
      advogados: this.extrairAdvogados(data.advogados),
      status: data.situacao || "Em andamento",
      valorCausa: data.valorCausa,
      orgaoJulgador: data.vara || data.unidade || "TRT11",
      relator: data.relator || data.juiz,
      ultimaMovimentacao: data.ultimaMovimentacao ? new Date(data.ultimaMovimentacao) : undefined,
    };
  }

  private extrairParte(partes: any[], tipo: "RECLAMANTE" | "RECLAMADA"): string | undefined {
    if (!Array.isArray(partes)) return undefined;

    const parte = partes.find((p) => {
      const tipoParte = p.tipo?.toUpperCase() || p.tipoParte?.toUpperCase() || "";
      return tipoParte.includes(tipo);
    });

    return parte?.nome;
  }

  private extrairAdvogados(advogadosData: any): string[] {
    if (!advogadosData) return [];
    if (Array.isArray(advogadosData)) {
      return advogadosData.map((adv) => {
        if (typeof adv === "string") return adv;
        const oabInfo = adv.oab && adv.uf ? ` (OAB ${adv.oab}/${adv.uf})` : "";
        return `${adv.nome}${oabInfo}`;
      });
    }
    return [];
  }

  private normalizarMovimentacoes(data: any): MovimentacaoProcessual[] {
    if (!Array.isArray(data)) return [];

    return data.map((mov: any) => ({
      id: mov.id || crypto.randomUUID(),
      data: new Date(mov.dataHora || mov.data || Date.now()),
      descricao: mov.descricao || mov.movimento || "Movimentação",
      tipo: this.classificarTipoMovimentacao(mov.descricao || mov.movimento || ""),
      complemento: mov.complemento,
      temPrazo: this.verificarPrazo(mov.descricao || mov.movimento || ""),
      prazoFatal: mov.dataPrazo ? new Date(mov.dataPrazo) : this.calcularPrazo(mov),
    }));
  }

  private classificarTipoMovimentacao(descricao: string): string {
    const desc = descricao.toLowerCase();

    if (desc.includes("sentença") || desc.includes("acórdão")) return "SENTENCA";
    if (desc.includes("intimação") || desc.includes("publicação")) return "INTIMACAO";
    if (desc.includes("recurso") || desc.includes("agravo")) return "RECURSO";
    if (desc.includes("audiência") || desc.includes("pauta")) return "AUDIENCIA";
    if (desc.includes("decisão") || desc.includes("despacho")) return "DECISAO";
    if (desc.includes("prazo")) return "PRAZO";
    if (desc.includes("juntada") || desc.includes("petição")) return "JUNTADA";
    if (desc.includes("perícia")) return "PERICIA";

    return "GERAL";
  }

  private verificarPrazo(descricao: string): boolean {
    const desc = descricao.toLowerCase();
    return (
      desc.includes("prazo") ||
      desc.includes("intimação") ||
      desc.includes("manifestar") ||
      desc.includes("cumpra-se")
    );
  }

  private calcularPrazo(mov: any): Date | undefined {
    if (!this.verificarPrazo(mov.descricao || "")) return undefined;

    const dataBase = new Date(mov.dataHora || mov.data || Date.now());

    // Extrair prazo específico se mencionado
    const desc = mov.descricao || "";
    const matchDias = desc.match(/prazo\s+de\s+(\d+)\s+dias/i);

    if (matchDias) {
      const dias = parseInt(matchDias[1]);
      dataBase.setDate(dataBase.getDate() + dias);
      return dataBase;
    }

    // Prazo padrão Justiça do Trabalho: 8 dias
    dataBase.setDate(dataBase.getDate() + 8);
    return dataBase;
  }
}

// Export singleton instance
export const trt11Adapter = new TRT11Adapter();
