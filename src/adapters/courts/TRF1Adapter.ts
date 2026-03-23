/**
 * 🦅 HORUS - Adapter TRF1 (Tribunal Regional Federal da 1ª Região)
 *
 * Consulta processos no TRF1 através do sistema e-Proc/PJe.
 * URL base: https://pje1g.trf1.jus.br/
 * Jurisdição: DF, GO, TO, MT, BA, MG, ES, PA, AM, AC, RR, RO, AP
 */

import type { ICourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class TRF1Adapter implements ICourtAdapter {
  readonly sigla = "TRF1";
  readonly nome = "Tribunal Regional Federal da 1ª Região";
  readonly tipo = "TRF" as const;

  private baseURL = "https://pje1g.trf1.jus.br/consultapublica/";

  /**
   * Busca processos por OAB
   */
  async searchByOAB(oab: string, seccional: string): Promise<ProcessoNormalizado[]> {
    try {
      console.log(`🦅 TRF1: Buscando processos para OAB ${oab}/${seccional}`);

      // TRF1 possui consulta pública via PJe
      // Endpoint: /consultapublica/ConsultaPublica/listView.seam
      // Parâmetros: numeroOAB, uf

      // Placeholder - implementação futura via:
      // 1. Scraping do PJe consulta pública
      // 2. API DataJud (CNJ)
      // 3. Certificado digital para e-Proc

      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar processos no TRF1:", error);
      throw new Error(`Erro ao consultar TRF1: ${error}`);
    }
  }

  /**
   * Busca movimentações de um processo específico
   */
  async getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    try {
      console.log(`🦅 TRF1: Buscando movimentações do processo ${numeroCNJ}`);

      const numeroLimpo = numeroCNJ.replace(/\D/g, "");

      // Consulta pública disponível em:
      // https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/DetalheProcessoConsultaPublica/listView.seam?ca={numero}

      // Placeholder - requer scraping
      return [];
    } catch (error) {
      console.error("❌ Erro ao buscar movimentações no TRF1:", error);
      return [];
    }
  }

  /**
   * Busca detalhes completos de um processo
   */
  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    try {
      console.log(`🦅 TRF1: Buscando detalhes do processo ${numeroCNJ}`);

      // Placeholder - estrutura básica
      return {
        numeroCNJ,
        tribunal: this.sigla,
        classe: "Apelação Cível",
        assunto: "Direito Tributário",
        dataDistribuicao: new Date(),
        polo: {
          ativo: "Apelante",
          passivo: "União Federal",
        },
        advogados: [],
        status: "Em tramitação",
        orgaoJulgador: "TRF1",
        valorCausa: undefined,
      };
    } catch (error) {
      console.error("❌ Erro ao buscar detalhes no TRF1:", error);
      throw error;
    }
  }

  /**
   * Verifica disponibilidade do PJe
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch("https://pje1g.trf1.jus.br", { method: "HEAD" });
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
      classe: data.classe || "Apelação",
      assunto: data.assunto || "Direito Federal",
      dataDistribuicao: data.dataAutuacao ? new Date(data.dataAutuacao) : new Date(),
      polo: {
        ativo: this.extrairParte(data.partes, "AUTOR") || "Apelante",
        passivo: this.extrairParte(data.partes, "REU") || "Apelado",
      },
      advogados: this.extrairAdvogados(data.advogados),
      status: data.situacao || "Em tramitação",
      valorCausa: data.valorCausa,
      orgaoJulgador: data.orgaoJulgador || data.secao || "TRF1",
      relator: data.desembargadorRelator || data.relator,
      ultimaMovimentacao: data.ultimaMovimentacao ? new Date(data.ultimaMovimentacao) : undefined,
    };
  }

  private extrairParte(partes: any[], tipo: "AUTOR" | "REU"): string | undefined {
    if (!Array.isArray(partes)) return undefined;

    const parte = partes.find((p) => {
      const tipoParte = p.tipo?.toUpperCase() || p.tipoParticipacao?.toUpperCase() || "";
      return tipoParte.includes(tipo) || tipoParte.includes("APELANTE") || tipoParte.includes("RECORRENTE");
    });

    return parte?.nome;
  }

  private extrairAdvogados(advogadosData: any): string[] {
    if (!advogadosData) return [];
    if (Array.isArray(advogadosData)) {
      return advogadosData.map((adv) => {
        if (typeof adv === "string") return adv;
        const oabInfo = adv.numeroOAB && adv.ufOAB ? ` (OAB ${adv.numeroOAB}/${adv.ufOAB})` : "";
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
      descricao: mov.nome || mov.descricao || "Movimentação",
      tipo: this.classificarTipoMovimentacao(mov.nome || mov.descricao || ""),
      complemento: mov.complemento,
      temPrazo: mov.temPrazo || false,
      prazoFatal: mov.dataPrazo ? new Date(mov.dataPrazo) : undefined,
    }));
  }

  private classificarTipoMovimentacao(descricao: string): string {
    const desc = descricao.toLowerCase();

    if (desc.includes("acórdão") || desc.includes("sentença")) return "SENTENCA";
    if (desc.includes("intimação") || desc.includes("publicação")) return "INTIMACAO";
    if (desc.includes("recurso") || desc.includes("agravo") || desc.includes("apelação")) return "RECURSO";
    if (desc.includes("audiência") || desc.includes("sessão")) return "AUDIENCIA";
    if (desc.includes("vista") || desc.includes("carga")) return "VISTA";
    if (desc.includes("decisão") || desc.includes("despacho")) return "DECISAO";
    if (desc.includes("juntada")) return "JUNTADA";

    return "GERAL";
  }
}

// Export singleton instance
export const trf1Adapter = new TRF1Adapter();
