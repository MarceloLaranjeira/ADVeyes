import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";

const STORAGE_PREFIX = "adveyes:self-signup";

const messages: Record<string, string> = {
  unauthorized: "Sua sessão expirou. Entre novamente.",
  invalid_payload: "Confira o nome do escritório e tente novamente.",
  signup_email_not_confirmed: "Confirme seu e-mail antes de criar o escritório.",
  signup_user_already_linked: "Esta conta já está vinculada a um escritório.",
  signup_invitation_pending: "Há um convite pendente para este e-mail.",
  signup_trial_plan_unavailable: "O teste gratuito está temporariamente indisponível.",
  signup_office_name_invalid: "Informe um nome de escritório válido.",
  operation_failed: "Não foi possível preparar seu escritório agora.",
};

export class SelfServiceSignupError extends Error {
  constructor(public readonly code: string) {
    super(messages[code] ?? messages.operation_failed);
    this.name = "SelfServiceSignupError";
  }
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function requestIdFor(userId: string): string {
  const key = storageKey(userId);
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const requestId = crypto.randomUUID();
  window.localStorage.setItem(key, requestId);
  return requestId;
}

export function rememberSignupIntent(input: {
  displayName: string;
  fullName?: string;
}) {
  window.sessionStorage.setItem(
    STORAGE_PREFIX,
    JSON.stringify(input),
  );
}

export function readSignupIntent(): {
  displayName?: string;
  fullName?: string;
} {
  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_PREFIX) ?? "{}") as {
      displayName?: string;
      fullName?: string;
    };
  } catch {
    return {};
  }
}

export async function provisionSelfServiceTenant(displayName: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new SelfServiceSignupError("unauthorized");

  const { data, error } = await withTimeout(
    supabase.functions.invoke("tenant-self-signup", {
      body: { displayName, requestId: requestIdFor(userId) },
    }),
    20_000,
  );
  if (error) {
    let code = "operation_failed";
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: string };
        code = payload.error ?? code;
      } catch {
        // Mantém mensagem estável sem expor detalhes internos.
      }
    }
    throw new SelfServiceSignupError(code);
  }
  return data as {
    tenantId: string;
    slug: string;
    trialEndsAt: string;
    onboardingStep: string;
  };
}
