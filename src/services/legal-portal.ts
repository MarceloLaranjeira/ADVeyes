import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";

export type LegalPortalStatus =
  | "pending" | "validating" | "active" | "action_required"
  | "invalid" | "paused" | "revoked";

export interface LegalPortalConnection {
  id: string;
  provider: "projudi_tjam";
  courtCode: "TJAM";
  loginMasked: string | null;
  status: LegalPortalStatus;
  capabilities: Record<string, boolean>;
  lastValidatedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
  lastResult: {
    received?: number;
    created?: number;
    updated?: number;
    ignored?: number;
  };
  configured: boolean;
}

export interface LegalPortalCourt {
  courtCode: string;
  displayName: string;
  timezone: string;
  authenticatedStatus: "not_homologated" | "testing" | "pilot" | "active" | "paused";
  authenticatedAvailable: boolean;
  capabilities: Record<string, boolean>;
}

export interface LegalPortalOverview {
  access: { role: string; canManage: boolean };
  selectedCourtCode: string;
  courts: LegalPortalCourt[];
  connection: LegalPortalConnection | null;
  sync?: {
    received: number;
    created: number;
    updated: number;
    ignored: number;
    fetchedAt: string;
  };
}

export const legalPortalMessages: Record<string, string> = {
  invalid_credentials: "O Projudi recusou o login ou a senha.",
  captcha_required: "O Projudi exigiu CAPTCHA. A conexão precisa ser concluída com intervenção humana.",
  certificate_required: "O Projudi exigiu certificado digital para este acesso.",
  portal_unavailable: "O Projudi/TJAM não respondeu. Tente novamente em alguns minutos.",
  portal_timeout: "O Projudi/TJAM demorou demais para responder.",
  login_page_changed: "O TJAM alterou a página de acesso. O conector foi pausado para proteger as credenciais.",
  post_login_navigation_changed: "O acesso foi respondido, mas o TJAM alterou a navegação após o login.",
  agenda_navigation_changed: "O acesso foi aceito, mas o conector não encontrou os links da Mesa do Advogado.",
  agenda_page_changed: "A agenda foi aberta, mas sua estrutura precisa ser atualizada no conector.",
  layout_changed: "O TJAM alterou a tela da agenda. O conector foi pausado para não importar dados errados.",
  portal_not_configured: "Conecte o Projudi/TJAM antes de sincronizar.",
  permission_denied: "Somente proprietário ou administrador pode gerenciar esta conexão.",
  invalid_court: "Selecione um tribunal válido.",
  court_not_available: "A agenda autenticada deste tribunal ainda está em homologação. A cobertura pública DataJud/CNJ permanece ativa.",
  invalid_payload: "Confira o login e a senha informados.",
  operation_failed: "Não foi possível concluir a operação.",
};

export class LegalPortalServiceError extends Error {
  constructor(public readonly code: string) {
    super(legalPortalMessages[code] ?? legalPortalMessages.operation_failed);
  }
}

export const legalPortalMessage = (code: string | null | undefined) =>
  code ? legalPortalMessages[code] ?? legalPortalMessages.operation_failed : null;

async function invoke<T>(body: Record<string, unknown>, timeoutMs = 30_000): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke("legal-portal-admin", { body }),
    timeoutMs,
  );
  if (error) {
    const response = (error as { context?: Response }).context;
    let code = "operation_failed";
    if (response) {
      try {
        const payload = await response.clone().json() as { error?: string };
        if (payload.error) code = payload.error;
      } catch {
        // Mantém mensagem estável sem expor o retorno do portal.
      }
    }
    throw new LegalPortalServiceError(code);
  }
  return data as T;
}

export const legalPortalService = {
  status: (tenantId: string, courtCode = "TJAM") =>
    invoke<LegalPortalOverview>({ action: "status", tenantId, courtCode }),
  connect: (tenantId: string, courtCode: string, login: string, password: string) =>
    invoke<LegalPortalOverview>({ action: "connect", tenantId, courtCode, login, password }, 50_000),
  sync: (tenantId: string, courtCode: string) =>
    invoke<LegalPortalOverview>({ action: "sync", tenantId, courtCode }, 50_000),
  disconnect: (tenantId: string, courtCode: string) =>
    invoke<LegalPortalOverview>({ action: "disconnect", tenantId, courtCode }),
};
