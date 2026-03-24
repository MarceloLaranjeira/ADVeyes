/**
 * 🦅 HORUS - Adapter TJAM (Tribunal de Justiça do Amazonas)
 */

import { BaseCourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class TJAMAdapter extends BaseCourtAdapter {
  readonly sigla = "TJAM";
  readonly nome = "Tribunal de Justiça do Amazonas";
  readonly tipo = "TJ" as const;
  readonly urlBase = "https://consultasaj.tjam.jus.br/cposgtj/";

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
      instancia: "PRIMEIRA",
      tipoAcao: "Procedimento Comum Cível",
      status: "ATIVO",
      dataDistribuicao: new Date(),
      partes: [],
      assuntos: ["Direito Civil"],
      segredoJustica: false,
      ultimaAtualizacao: new Date(),
    };
  }
}

export const tjamAdapter = new TJAMAdapter();
