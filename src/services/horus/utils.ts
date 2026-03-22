/**
 * HORUS UTILS — Utilidades do Motor de IA
 */

/**
 * Calcula dias úteis entre duas datas
 * Considera sábados, domingos e feriados nacionais
 */
export function calcularDiasUteis(
  dataInicio: Date,
  dataFim: Date,
  feriados: Date[] = []
): number {
  let dias = 0;
  const atual = new Date(dataInicio);

  while (atual <= dataFim) {
    const diaSemana = atual.getDay();
    const ehFeriadoOuFimDeSemana =
      diaSemana === 0 || // Domingo
      diaSemana === 6 || // Sábado
      feriados.some((feriado) => feriado.toDateString() === atual.toDateString());

    if (!ehFeriadoOuFimDeSemana) {
      dias++;
    }

    atual.setDate(atual.getDate() + 1);
  }

  return dias;
}

/**
 * Adiciona dias úteis a uma data
 */
export function adicionarDiasUteis(
  dataBase: Date,
  diasUteis: number,
  feriados: Date[] = []
): Date {
  const resultado = new Date(dataBase);
  let diasAdicionados = 0;

  while (diasAdicionados < diasUteis) {
    resultado.setDate(resultado.getDate() + 1);

    const diaSemana = resultado.getDay();
    const ehFeriadoOuFimDeSemana =
      diaSemana === 0 ||
      diaSemana === 6 ||
      feriados.some((feriado) => feriado.toDateString() === resultado.toDateString());

    if (!ehFeriadoOuFimDeSemana) {
      diasAdicionados++;
    }
  }

  return resultado;
}

/**
 * Gera hash único para movimentação (evitar duplicatas)
 */
export function gerarHashMovimentacao(
  numeroCNJ: string,
  dataMovimentacao: Date,
  descricao: string
): string {
  const conteudo = `${numeroCNJ}-${dataMovimentacao.toISOString()}-${descricao}`;

  // Hash simples (em produção, usar crypto)
  let hash = 0;
  for (let i = 0; i < conteudo.length; i++) {
    const char = conteudo.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Normaliza número CNJ (remove caracteres especiais)
 */
export function normalizarNumeroCNJ(numero: string): string {
  return numero.replace(/\D/g, "");
}

/**
 * Formata número CNJ para exibição
 */
export function formatarNumeroCNJ(numero: string): string {
  const normalizado = normalizarNumeroCNJ(numero);

  if (normalizado.length !== 20) {
    return numero; // Retorna original se não estiver no formato CNJ
  }

  // Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
  return `${normalizado.slice(0, 7)}-${normalizado.slice(7, 9)}.${normalizado.slice(9, 13)}.${normalizado.slice(13, 14)}.${normalizado.slice(14, 16)}.${normalizado.slice(16, 20)}`;
}

/**
 * Classifica urgência de uma movimentação
 */
export function classificarUrgencia(
  tipoMovimentacao: string,
  temPrazo: boolean,
  diasRestantes?: number
): "CRITICA" | "ALTA" | "MEDIA" | "BAIXA" {
  // Tipos críticos automaticamente
  const tiposCriticos = ["SENTENÇA", "INTIMAÇÃO", "CITAÇÃO", "ACÓRDÃO"];
  if (tiposCriticos.some((tipo) => tipoMovimentacao.toUpperCase().includes(tipo))) {
    return "CRITICA";
  }

  // Se tem prazo, urgência baseada em dias restantes
  if (temPrazo && diasRestantes !== undefined) {
    if (diasRestantes <= 2) return "CRITICA";
    if (diasRestantes <= 5) return "ALTA";
    if (diasRestantes <= 10) return "MEDIA";
  }

  // Tipos de alta prioridade
  const tiposAlta = ["DECISÃO", "DESPACHO", "JUNTADA"];
  if (tiposAlta.some((tipo) => tipoMovimentacao.toUpperCase().includes(tipo))) {
    return "ALTA";
  }

  return "MEDIA";
}

/**
 * Formata mensagem do Horus (sempre com 🦅)
 */
export function formatarMensagemHorus(mensagem: string): string {
  if (!mensagem.startsWith("🦅")) {
    return `🦅 ${mensagem}`;
  }
  return mensagem;
}

/**
 * Feriados nacionais brasileiros (2026)
 * TODO: Atualizar anualmente ou buscar de API
 */
export function getFeriadosNacionais(ano: number = 2026): Date[] {
  return [
    new Date(ano, 0, 1),   // Ano Novo
    new Date(ano, 3, 18),  // Paixão de Cristo (2026)
    new Date(ano, 3, 21),  // Tiradentes
    new Date(ano, 4, 1),   // Dia do Trabalho
    new Date(ano, 5, 20),  // Corpus Christi (2026)
    new Date(ano, 8, 7),   // Independência
    new Date(ano, 9, 12),  // Nossa Senhora Aparecida
    new Date(ano, 10, 2),  // Finados
    new Date(ano, 10, 15), // Proclamação da República
    new Date(ano, 11, 25), // Natal
  ];
}

/**
 * Extrai OAB de texto
 */
export function extrairOAB(texto: string): { numero: string; seccional: string } | null {
  const regex = /OAB[\/\s-]*([A-Z]{2})[\/\s-]*(\d+)/i;
  const match = texto.match(regex);

  if (match) {
    return {
      seccional: match[1].toUpperCase(),
      numero: match[2],
    };
  }

  return null;
}

export const horusUtils = {
  calcularDiasUteis,
  adicionarDiasUteis,
  gerarHashMovimentacao,
  normalizarNumeroCNJ,
  formatarNumeroCNJ,
  classificarUrgencia,
  formatarMensagemHorus,
  getFeriadosNacionais,
  extrairOAB,
};
