/**
 * HORUS — Tipos e Interfaces Core
 *
 * Define as estruturas de dados usadas pelo motor de IA do ADVeyes.
 */

/**  OAB do advogado */
export interface OABData {
  numero: string;           // Exemplo: "123456"
  seccional: string;        // Exemplo: "AM", "SP", "RJ"
  nomeCompleto: string;     // Nome do advogado
  email: string;
  telefone?: string;
}

/** Processo judicial normalizado */
export interface ProcessoNormalizado {
  id: string;                         // UUID interno ADVeyes
  numeroCNJ: string;                  // Formato CNJ: 0000000-00.0000.0.00.0000
  tribunal: string;                   // Sigla: "TJAM", "STF", "TRF1", etc.
  instancia: "PRIMEIRA" | "SEGUNDA" | "SUPERIOR" | "SUPREMA";
  tipoAcao: string;                   // "CÍVEL", "TRABALHISTA", "CRIMINAL", etc.
  status: "ATIVO" | "SUSPENSO" | "ARQUIVADO" | "BAIXADO";
  dataDistribuicao: Date;
  vara?: string;
  comarca?: string;
  partes: {
    polo: "ATIVO" | "PASSIVO" | "TERCEIRO";
    nome: string;
    tipo: "PESSOA_FISICA" | "PESSOA_JURIDICA";
    advogados?: string[];             // OABs dos advogados
  }[];
  assuntos: string[];
  valorCausa?: number;
  segredoJustica: boolean;
  urlTribunal?: string;               // Link para consulta no site do tribunal
  dadosBrutos?: any;                  // Dados originais da API do tribunal
  ultimaAtualizacao: Date;
}

/** Movimentação processual */
export interface MovimentacaoProcessual {
  id: string;                         // UUID interno
  processoId: string;                 // ID do processo no ADVeyes
  numeroCNJ: string;
  dataMovimentacao: Date;
  tipoMovimentacao: string;           // "DESPACHO", "DECISÃO", "SENTENÇA", etc.
  descricao: string;                  // Texto completo da movimentação
  descricaoResumida?: string;         // Resumo gerado pelo Horus
  urgencia: "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";
  prazo?: {
    tipo: "DIAS_UTEIS" | "DIAS_CORRIDOS";
    quantidade: number;
    dataInicio: Date;
    dataFinal: Date;
    vencido: boolean;
  };
  documentos?: {
    nome: string;
    url: string;
    tipo: "PDF" | "DOC" | "OUTROS";
  }[];
  jaLida: boolean;
  hash: string;                       // Hash para evitar duplicatas
  dadosBrutos?: any;
}

/** Resultado de busca nos tribunais */
export interface ResultadoBuscaTribunal {
  tribunal: string;
  sucesso: boolean;
  processosEncontrados: ProcessoNormalizado[];
  erros?: string[];
  tempoExecucao: number;              // em ms
  timestamp: Date;
}

/** Status da descoberta automática */
export interface StatusDiscovery {
  oab: string;
  seccional: string;
  emAndamento: boolean;
  tribunaisConsultados: number;
  tribunaisPendentes: number;
  processosEncontrados: number;
  ultimaAtualizacao: Date;
  erros: {
    tribunal: string;
    mensagem: string;
  }[];
}

/** Notificação do Horus */
export interface NotificacaoHorus {
  id: string;
  tipo: "NOVA_MOVIMENTACAO" | "PRAZO_VENCENDO" | "SENTENCA" | "INTIMACAO" | "GERAL";
  urgencia: "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";
  titulo: string;
  mensagem: string;                   // Sempre começa com "🦅 Horus..."
  processoId?: string;
  movimentacaoId?: string;
  dataNotificacao: Date;
  lida: boolean;
  acao?: {
    label: string;
    url: string;
  };
}

/** Configuração de tribunais */
export interface TribunalConfig {
  sigla: string;                      // "TJAM", "STF", etc.
  nome: string;                       // Nome completo
  tipo: "TJ" | "TRF" | "TRT" | "SUPERIOR";
  regiao?: string;                    // Para TRFs e TRTs
  uf?: string;                        // Para TJs
  urlBase: string;
  apiDisponivel: boolean;
  metodoConsulta: "API_OFICIAL" | "DATAJUD" | "SCRAPING" | "INDISPONIVEL";
  intervaloMonitoramento: number;     // em minutos
  ativo: boolean;
}

/** Métricas do Horus */
export interface MetricasHorus {
  processosMonitorados: number;
  movimentacoesDetectadas24h: number;
  notificacoesEnviadas24h: number;
  tribunaisAtivos: number;
  ultimaVarreduraCompleta: Date;
  proximaVarreduraCompleta: Date;
  taxaSucesso: number;                // 0-100
}
