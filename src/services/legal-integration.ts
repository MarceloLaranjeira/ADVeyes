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
  usage: ProviderUsage | null;
  professionals: LegalProfessional[];
  registrations: LawyerRegistration[];
  discoveries: ProcessDiscovery[];
  monitors: LegalMonitor[];
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
    }),
};
