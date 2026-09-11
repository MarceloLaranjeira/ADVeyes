import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";
import { EdgeFunctionError, readEdgeError } from "@/lib/edge-errors";
import { teamManagementMessages } from "@/services/team-management";
import type {
  AccessDecisionInput,
  AccessLinkLookup,
  AccessLinkState,
  AccessRequestsOverview,
  MyAccessRequest,
} from "@/types/access-requests";

/**
 * As mensagens são as mesmas da gestão de equipe: o usuário não deve perceber
 * de qual Edge Function veio a falha.
 */
export class AccessRequestError extends EdgeFunctionError {
  constructor(code: string, diagnosticId: string | null = null) {
    super(code, teamManagementMessages, diagnosticId);
    this.name = "AccessRequestError";
  }
}

async function invoke<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke(functionName, { body }),
    15_000,
  );
  if (error) {
    const { code, diagnosticId } = await readEdgeError(error);
    throw new AccessRequestError(code, diagnosticId);
  }
  return data as T;
}

export const accessRequestService = {
  /** Identidade pública do escritório; funciona antes do login. */
  lookupLink: (token: string) =>
    invoke<AccessLinkLookup>("tenant-request-access", {
      action: "lookup",
      token,
    }),

  submit: (
    token: string,
    profile: { name: string; phone?: string | null; oab?: string | null },
  ) =>
    invoke<{
      request_id: string;
      tenant_id: string;
      tenant_name?: string;
      status: string;
      already_pending: boolean;
    }>("tenant-request-access", { action: "submit", token, profile }),

  myRequests: () =>
    invoke<{ requests: MyAccessRequest[] }>("tenant-request-access", {
      action: "status",
    }),

  readLink: (tenantId: string) =>
    invoke<AccessLinkState>("tenant-access-link", {
      tenantId,
      action: "read",
    }),

  generateLink: (tenantId: string) =>
    invoke<AccessLinkState>("tenant-access-link", {
      tenantId,
      action: "generate",
    }),

  revokeLink: (tenantId: string) =>
    invoke<{ link_id: string; status: string }>("tenant-access-link", {
      tenantId,
      action: "revoke",
    }),

  list: (tenantId: string) =>
    invoke<AccessRequestsOverview>("tenant-decide-access", {
      action: "list",
      tenantId,
    }),

  decide: (input: AccessDecisionInput) =>
    invoke<{ request_id: string; status: string; membership_id?: string }>(
      "tenant-decide-access",
      { action: "decide", ...input } as unknown as Record<string, unknown>,
    ),
};
