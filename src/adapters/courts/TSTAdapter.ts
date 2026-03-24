/**
 * 🦅 HORUS - Adapter TST (Tribunal Superior do Trabalho)
 */

import { BaseCourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class TSTAdapter extends BaseCourtAdapter {
  readonly sigla = "TST";
  readonly nome = "Tribunal Superior do Trabalho";
  readonly tipo = "SUPERIOR" as const;
  readonly urlBase = "https://pje.tst.jus.br/consultaprocessual/";

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
      tipoAcao: "Recurso de Revista",
      status: "ATIVO",
      dataDistribuicao: new Date(),
      partes: [],
      assuntos: ["Direito do Trabalho"],
      segredoJustica: false,
      ultimaAtualizacao: new Date(),
    };
  }
}

export const tstAdapter = new TSTAdapter();
