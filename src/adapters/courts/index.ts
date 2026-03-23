/**
 * 🦅 HORUS - Court Adapters Index
 *
 * Exporta todos os adapters de tribunais disponíveis.
 */

export * from "./ICourtAdapter";
export * from "./STFAdapter";
export * from "./STJAdapter";
export * from "./TSTAdapter";
export * from "./TJAMAdapter";
export * from "./TRF1Adapter";
export * from "./TRT11Adapter";

// Re-export singleton instances
export { stfAdapter } from "./STFAdapter";
export { stjAdapter } from "./STJAdapter";
export { tstAdapter } from "./TSTAdapter";
export { tjamAdapter } from "./TJAMAdapter";
export { trf1Adapter } from "./TRF1Adapter";
export { trt11Adapter } from "./TRT11Adapter";

/**
 * Mapa de todos os adapters disponíveis por sigla
 */
import { stfAdapter } from "./STFAdapter";
import { stjAdapter } from "./STJAdapter";
import { tstAdapter } from "./TSTAdapter";
import { tjamAdapter } from "./TJAMAdapter";
import { trf1Adapter } from "./TRF1Adapter";
import { trt11Adapter } from "./TRT11Adapter";
import type { ICourtAdapter } from "./ICourtAdapter";

export const COURT_ADAPTERS: Record<string, ICourtAdapter> = {
  STF: stfAdapter,
  STJ: stjAdapter,
  TST: tstAdapter,
  TJAM: tjamAdapter,
  TRF1: trf1Adapter,
  TRT11: trt11Adapter,
};

/**
 * Retorna adapter por sigla do tribunal
 */
export function getCourtAdapter(sigla: string): ICourtAdapter | undefined {
  return COURT_ADAPTERS[sigla.toUpperCase()];
}

/**
 * Lista todos os adapters disponíveis
 */
export function getAllAdapters(): ICourtAdapter[] {
  return Object.values(COURT_ADAPTERS);
}

/**
 * Verifica se um tribunal possui adapter implementado
 */
export function hasAdapter(sigla: string): boolean {
  return sigla.toUpperCase() in COURT_ADAPTERS;
}
