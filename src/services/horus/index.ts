/**
 * HORUS — Motor de Inteligência Artificial do ADVeyes
 *
 * Horus é a IA interna que opera dentro do ADVeyes.
 * Responsável por:
 * - Descoberta automática de processos por OAB
 * - Monitoramento contínuo 24/7 de tribunais
 * - Classificação e organização inteligente
 * - Notificações proativas multi-canal
 * - Análise e resumo de movimentações
 * - Cálculo automático de prazos
 *
 * IDENTIDADE:
 * - ADVeyes: A plataforma (o produto visível)
 * - Horus: A IA interna (o motor inteligente)
 *
 * Todas as interações da IA são assinadas com "🦅 Horus"
 */

// Tipos e interfaces
export * from "./types";

// Engines principais
export { HorusDiscoveryEngine, horusDiscovery } from "./HorusDiscoveryEngine";
export { HorusMonitor, horusMonitor } from "./HorusMonitor";
export { HorusNotifier } from "./HorusNotifier";

// Utilitários
export { horusUtils } from "./utils";

/**
 * Inicializa o motor Horus
 * Deve ser chamado uma vez quando o app carrega
 */
export async function inicializarHorus(): Promise<void> {
  console.log("🦅 Horus inicializando...");

  // Inicia monitoramento automático
  const { horusMonitor } = await import("./HorusMonitor");
  await horusMonitor.iniciar();

  console.log("🦅 Horus pronto. Monitoramento ativo.");
}

/**
 * Para o motor Horus
 * Usado ao fazer logout ou fechar o app
 */
export async function pararHorus(): Promise<void> {
  console.log("🦅 Horus encerrando...");

  const { horusMonitor } = await import("./HorusMonitor");
  await horusMonitor.parar();

  console.log("🦅 Horus encerrado.");
}
