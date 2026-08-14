export type ProcessPhase =
  | "conhecimento"
  | "recursal"
  | "cumprimento_execucao"
  | "suspenso_sobrestado"
  | "arquivado_encerrado"
  | "nao_identificada";

export type ProcessStage =
  | "distribuicao"
  | "citacao"
  | "defesa"
  | "instrucao"
  | "pericia"
  | "alegacoes_finais"
  | "sentenca"
  | "preparacao_recurso"
  | "contrarrazoes"
  | "remessa"
  | "julgamento"
  | "transito_julgado"
  | "liquidacao"
  | "cobranca"
  | "penhora"
  | "expropriacao"
  | "pagamento"
  | "suspenso"
  | "arquivado"
  | "nao_identificada";

export type WaitingOn =
  | "escritorio"
  | "cliente"
  | "parte_contraria"
  | "juizo_tribunal"
  | "orgao_externo"
  | "nao_identificado";

export type IntelligenceRisk = "normal" | "atencao" | "alto" | "critico";
export type IntelligenceConfidence = "baixa" | "media" | "alta";
export type IntelligenceOrigin = "automatico" | "manual";
export type IntelligenceRunStatus = "pending" | "processing" | "ready" | "partial" | "failed";

export interface ProcessIntelligenceEvidence {
  id: string;
  kind: "movement" | "publication" | "manual" | "deadline" | "process";
  occurredAt: string | null;
  title: string;
  excerpt: string;
}

export interface ProcessIntelligenceEvent {
  id: string;
  kind: "movement" | "publication" | "manual";
  occurredAt: string | null;
  title: string;
  content: string;
  possibleDeadline?: boolean;
}

export interface ProcessIntelligenceThresholds {
  officeDays: number;
  counterpartyDays: number;
  courtDays: number;
}

export interface ProcessIntelligenceSemanticSuggestion {
  phase: ProcessPhase;
  stage: ProcessStage;
  waitingOn: WaitingOn;
  waitingReason: string | null;
  nextAction: string | null;
  confidence: number;
  evidenceIds: string[];
}

export interface ProcessIntelligenceManualOverride {
  phase?: ProcessPhase;
  stage?: ProcessStage;
  waitingOn?: WaitingOn;
  waitingReason?: string | null;
  nextAction?: string | null;
}

export interface ProcessIntelligenceAssessment {
  phase: ProcessPhase;
  stage: ProcessStage;
  waitingOn: WaitingOn;
  waitingReason: string | null;
  nextAction: string | null;
  lastEventAt: string | null;
  lastAdvanceAt: string | null;
  stalledDays: number;
  isStalled: boolean;
  risk: IntelligenceRisk;
  confidence: IntelligenceConfidence;
  confidenceScore: number;
  evidence: ProcessIntelligenceEvidence[];
  origin: IntelligenceOrigin;
}

export interface ProcessIntelligenceRecord extends ProcessIntelligenceAssessment {
  id: string;
  tenantId: string;
  processId: string;
  runStatus: IntelligenceRunStatus;
  classifierVersion: string;
  analyzedAt: string | null;
  manualOverride: ProcessIntelligenceManualOverride | null;
  manualOverrideBy: string | null;
  manualOverrideAt: string | null;
  updatedAt: string;
}

export interface ProcessIntelligenceItem {
  id: string;
  number: string;
  clientName: string | null;
  clientDocument: string | null;
  area: string | null;
  status: string | null;
  court: string | null;
  courtUnit: string | null;
  lawyer: string | null;
  updatedAt: string;
  intelligence: ProcessIntelligenceRecord | null;
}

export const DEFAULT_PROCESS_INTELLIGENCE_THRESHOLDS: ProcessIntelligenceThresholds = {
  officeDays: 3,
  counterpartyDays: 15,
  courtDays: 30,
};

