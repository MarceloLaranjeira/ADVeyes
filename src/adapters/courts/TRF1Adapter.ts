/**
 * 🦅 HORUS - Adapter TRF1 (Tribunal Regional Federal da 1ª Região)
 */

import { BaseCourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class TRF1Adapter extends BaseCourtAdapter {
  readonly sigla = "TRF1";
  readonly nome = "Tribunal Regional Federal da 1ª Região";
  readonly tipo = "TRF" as const;
  readonly urlBase = "https://pje1g.trf1.jus.br/consultapublica/";

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
      instancia: "SEGUNDA",
      tipoAcao: "Apelação Cível",
      status: "ATIVO",
      dataDistribuicao: new Date(),
      partes: [],
      assuntos: ["Direito Tributário"],
      segredoJustica: false,
      ultimaAtualizacao: new Date(),
    };
  }
}

export const trf1Adapter = new TRF1Adapter();
