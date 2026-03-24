/**
 * 🦅 HORUS - Adapter TRT11 (Tribunal Regional do Trabalho da 11ª Região)
 */

import { BaseCourtAdapter } from "./ICourtAdapter";
import type { ProcessoNormalizado, MovimentacaoProcessual } from "@/services/horus/types";

export class TRT11Adapter extends BaseCourtAdapter {
  readonly sigla = "TRT11";
  readonly nome = "Tribunal Regional do Trabalho da 11ª Região";
  readonly tipo = "TRT" as const;
  readonly urlBase = "https://pje.trt11.jus.br/consultaprocessual/";

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
      tipoAcao: "Reclamação Trabalhista",
      status: "ATIVO",
      dataDistribuicao: new Date(),
      partes: [],
      assuntos: ["Direito do Trabalho"],
      segredoJustica: false,
      ultimaAtualizacao: new Date(),
    };
  }
}

export const trt11Adapter = new TRT11Adapter();
