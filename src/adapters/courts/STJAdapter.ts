/**
 * 🦅 HORUS - Adapter STJ (Superior Tribunal de Justiça)
 */

import { BaseCourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class STJAdapter extends BaseCourtAdapter {
  readonly sigla = "STJ";
  readonly nome = "Superior Tribunal de Justiça";
  readonly tipo = "SUPERIOR" as const;
  readonly urlBase = "https://processo.stj.jus.br/processo/julgamento/eletronico/";

  async searchByOAB(_oab: string, _seccional: string): Promise<ProcessoNormalizado[]> {
    this.log("Buscando processos por OAB");
    return [];
  }

  async getMovements(_numeroCNJ: string): Promise<MovimentacaoProcessual[]> {
    this.log("Buscando movimentações");
    return [];
  }

  async getDetails(numeroCNJ: string): Promise<ProcessoNormalizado> {
    this.log(`Buscando detalhes do processo ${numeroCNJ}`);
    return {
      id: crypto.randomUUID(),
      numeroCNJ,
      tribunal: this.sigla,
      instancia: "SUPERIOR",
      tipoAcao: "N/A",
      status: "ATIVO",
      dataDistribuicao: new Date(),
      partes: [],
      assuntos: ["N/A"],
      segredoJustica: false,
      ultimaAtualizacao: new Date(),
    };
  }
}

export const stjAdapter = new STJAdapter();
