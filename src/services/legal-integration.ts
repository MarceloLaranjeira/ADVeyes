import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";

export interface LegalProfessional {
  id: string;
  nome: string;
  email: string | null;
  oab: string | null;
  cargo: string | null;
  ativo: boolean;
}

export interface LawyerRegistration {
  id: string;
  professional_id: string;
  oab_number: string;
  oab_state: string;
  oab_type: string;
  status: string;
  verified_name: string | null;
  last_discovery_at: string | null;
}

export interface ProcessDiscovery {
  id: string;
  lawyer_registration_id: string;
  numero_cnj: string;
  state: "candidate" | "confirmed" | "ignored" | "conflict";
  title_active_party: string | null;
  title_passive_party: string | null;
  tribunal: string | null;
  court_unit: string | null;
  process_status: string | null;
  last_movement_at: string | null;
}

export interface LegalMonitor {
  id: string;
  process_id: string;
  external_id: string | null;
  frequency: "DIARIA" | "SEMANAL";
  status: string;
  last_error_code: string | null;
  updated_at: string;
}

export interface LegalSyncSourceStatus {
  id: string;
  source_kind: "oab" | "process";
  provider: "djen" | "datajud" | "escavador";
  lawyer_registration_id: string | null;
  process_id: string | null;
  reference: string;
  active: boolean;
  last_attempt_at: string | null;
  last_success_at: string | null;
  next_sync_at: string | null;
  failure_count: number;
  last_error_code: string | null;
  paused_reason: string | null;
}

export interface ProviderUsage {
  provider: string;
  period_start: string;
  /** Orçamento e gasto do mês em centavos. */
  budget_cents: number;
  spent_cents: number;
  monitors: { used: number; limit: number };
}

export interface LegalOverview {
  providerConfigured: boolean;
  access: {
    role: string;
    canManageAll: boolean;
    canMutate: boolean;
  };
  usage: ProviderUsage | null;
  professionals: LegalProfessional[];
  registrations: LawyerRegistration[];
  discoveries: ProcessDiscovery[];
  monitors: LegalMonitor[];
  sources: LegalSyncSourceStatus[];
}

const messages: Record<string, string> = {
  unauthorized: "Sua sessão expirou. Entre novamente.",
  permission_denied: "Somente proprietário ou administrador pode gerenciar a integração.",
  invalid_payload: "Confira os dados informados.",
  candidate_not_found: "Um dos processos selecionados não está mais disponível.",
  integration_not_configured: "O cadastro foi salvo e aguarda o token do Escavador.",
  escavador_unauthorized: "O token do Escavador foi recusado.",
  escavador_insufficient_balance: "A conta do Escavador está sem saldo.",
  escavador_rate_limited: "O limite de consultas do Escavador foi atingido.",
  escavador_request_failed: "O Escavador não respondeu corretamente.",
  tenant_budget_exceeded:
    "O orçamento de consultas do plano acabou neste mês.",
  platform_budget_exceeded:
    "O orçamento global da plataforma acabou neste mês.",
  datajud_unauthorized: "A chave do DataJud foi recusada.",
  datajud_rate_limited: "O limite de consultas do DataJud foi atingido.",
  datajud_request_failed: "O DataJud não respondeu a tempo.",
  datajud_court_not_supported:
    "O DataJud não cobre os tribunais dessa seccional.",
  registration_owned_by_other_professional:
    "Esta OAB já pertence a outro profissional do escritório.",
  registration_not_found: "A OAB não está mais disponível.",
  registration_already_exists: "Esta OAB já está cadastrada no escritório.",
  professional_not_found: "O profissional não está ativo ou não foi encontrado.",
  operation_failed: "Não foi possível concluir a operação.",
};

export class LegalIntegrationError extends Error {
  constructor(
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(messages[code] ?? messages.operation_failed);
  }
}

/**
 * Parte dos processos foi confirmada antes da falha. Dizer apenas "não foi
 * possível confirmar" seria mentira: os primeiros já estão monitorados.
 */
export class PartialConfirmationError extends Error {
  constructor(
    public readonly confirmed: number,
    public readonly total: number,
    public readonly code: string,
  ) {
    super(
      `${confirmed} de ${total} processos foram confirmados antes da falha. ` +
        `Os demais continuam na lista.`,
    );
  }
}

/**
 * A confirmação percorre os candidatos em série no servidor e cada um dispara
 * uma chamada ao provedor. Dez por vez cabe folgado no tempo de espera abaixo.
 */
const CONFIRM_BATCH = 10;
const CONFIRM_TIMEOUT_MS = 45_000;

async function invoke<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke(functionName, { body }),
    timeoutMs,
  );
  if (error) {
    const context = (error as { context?: Response }).context;
    let payload: Record<string, unknown> = {};
    if (context) {
      try {
        payload = await context.clone().json() as Record<string, unknown>;
      } catch {
        // Preserve a stable, non-sensitive error for the interface.
      }
    }
    throw new LegalIntegrationError(
      typeof payload.error === "string" ? payload.error : "operation_failed",
      payload,
    );
  }
  return data as T;
}

export const legalIntegrationService = {
  overview: (tenantId: string) =>
    invoke<LegalOverview>("legal-confirm-processes", {
      action: "overview",
      tenantId,
    }),

  discover: (input: {
    tenantId: string;
    professionalId: string;
    oabNumber: string;
    oabState: string;
  }) =>
    invoke<{
      registrationId: string;
      registrationSaved?: boolean;
      totalCandidates?: number;
      discoveryError?: string;
    }>("legal-discover-lawyer-processes", input, 45_000),

  register: (input: {
    tenantId: string;
    professionalId: string;
    oabNumber: string;
    oabState: string;
  }) =>
    invoke<{
      registrationId: string;
      registrationSaved: true;
      discoveryPending: true;
      totalCandidates: number;
    }>("legal-discover-lawyer-processes", {
      ...input,
      action: "register",
      deferDiscovery: true,
    }),

  updateRegistration: (input: {
    tenantId: string;
    registrationId: string;
    professionalId: string;
    oabNumber: string;
    oabState: string;
  }) =>
    invoke<{
      registrationId: string;
      professionalId: string;
      oabNumber: string;
      oabState: string;
      synchronizationScheduled: true;
    }>("legal-discover-lawyer-processes", {
      ...input,
      action: "update",
    }),

  disableRegistration: (tenantId: string, registrationId: string) =>
    invoke<{
      registrationId: string;
      disabled: true;
      preservedProcesses: true;
    }>("legal-discover-lawyer-processes", {
      action: "disable",
      tenantId,
      registrationId,
    }),

  confirm: (
    tenantId: string,
    candidateIds: string[],
    frequency: "DIARIA" | "SEMANAL",
  ) =>
    invoke<{
      confirmed: number;
      providerConfigured: boolean;
    }>("legal-confirm-processes", {
      action: "confirm",
      tenantId,
      candidateIds,
      frequency,
      includePublicDocuments: true,
    }, CONFIRM_TIMEOUT_MS),

  /**
   * Confirma em lotes, porque a função percorre os candidatos em série e
   * cada um dispara uma chamada ao provedor pela rede. Uma página inteira de
   * uma vez estourava o tempo de espera e o advogado via "a operação demorou
   * mais que o esperado" sem saber o que tinha sido gravado.
   *
   * O lote é pequeno de propósito: falha no meio deixa os anteriores
   * confirmados de verdade, e `onProgress` permite mostrar onde parou.
   */
  async confirmInBatches(
    tenantId: string,
    candidateIds: string[],
    frequency: "DIARIA" | "SEMANAL",
    onProgress?: (confirmed: number, total: number) => void,
  ): Promise<{ confirmed: number; providerConfigured: boolean }> {
    let confirmed = 0;
    let providerConfigured = false;

    for (let start = 0; start < candidateIds.length; start += CONFIRM_BATCH) {
      const batch = candidateIds.slice(start, start + CONFIRM_BATCH);
      try {
        const result = await legalIntegrationService.confirm(
          tenantId,
          batch,
          frequency,
        );
        confirmed += result.confirmed;
        providerConfigured = result.providerConfigured;
        onProgress?.(confirmed, candidateIds.length);
      } catch (error) {
        // O que já entrou continua valendo; quem chamou decide o que dizer.
        if (confirmed > 0 && error instanceof LegalIntegrationError) {
          throw new PartialConfirmationError(confirmed, candidateIds.length, error.code);
        }
        throw error;
      }
    }

    return { confirmed, providerConfigured };
  },
};
