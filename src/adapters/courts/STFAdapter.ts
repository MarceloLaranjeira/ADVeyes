/**
 * 🦅 HORUS - Adapter STF (Supremo Tribunal Federal)
 */

import { BaseCourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class STFAdapter extends BaseCourtAdapter {
  readonly sigla = "STF";
  readonly nome = "Supremo Tribunal Federal";
  readonly tipo = "SUPERIOR" as const;
  readonly urlBase = "https://transparencia.stf.jus.br/extensions/api_rest_v2/api_rest_v2.php";

  async searchByOAB(_oab: string, _seccional: string): Promise<ProcessoNormalizado[]> {
    this.log(`Buscando processos por OAB`);
    return [];
  }

  async getMovements(numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    try {
      this.log(`Buscando movimentações do processo ${numeroCNJ}`);
      const numeroLimpo = this.normalizeCNJ(numeroCNJ);
      const response = await fetch(`${this.urlBase}?action=getMovimentacoes&processo=${numeroLimpo}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return this.normalizarMovimentacoes(data, numeroCNJ);
    } catch (error) {
      this.log(`Erro ao buscar movimentações: ${error}`, "error");
      return [];
    }
  }

  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    this.log(`Buscando detalhes do processo ${numeroCNJ}`);
    const numeroLimpo = this.normalizeCNJ(numeroCNJ);
    const response = await fetch(`${this.urlBase}?action=getProcesso&numero=${numeroLimpo}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return this.normalizarProcesso(data, numeroCNJ);
  }

  private normalizarProcesso(data: any, numeroCNJ: string): ProcessoNormalizado {
    return {
      id: crypto.randomUUID(),
      numeroCNJ,
      tribunal: this.sigla,
      instancia: "SUPREMA",
      tipoAcao: data.classe || "N/A",
      status: "ATIVO",
      dataDistribuicao: data.dataDistribuicao ? new Date(data.dataDistribuicao) : new Date(),
      partes: [],
      assuntos: [data.assunto || "N/A"],
      segredoJustica: false,
      ultimaAtualizacao: new Date(),
    };
  }

  private normalizarMovimentacoes(data: any, numeroCNJ: string): MovimentacaoProcessual[] {
    if (!Array.isArray(data)) return [];
    return data.map((mov: any) => ({
      id: mov.id || crypto.randomUUID(),
      processoId: "",
      numeroCNJ,
      dataMovimentacao: new Date(mov.data || Date.now()),
      tipoMovimentacao: this.classificarTipo(mov.descricao || ""),
      descricao: mov.descricao || "Movimentação",
      urgencia: "MEDIA" as const,
      jaLida: false,
      hash: crypto.randomUUID(),
    }));
  }

  private classificarTipo(descricao: string): string {
    const d = descricao.toLowerCase();
    if (d.includes("sentença") || d.includes("acórdão")) return "SENTENCA";
    if (d.includes("intimação")) return "INTIMACAO";
    if (d.includes("despacho")) return "DESPACHO";
    return "GERAL";
  }
}

export const stfAdapter = new STFAdapter();
