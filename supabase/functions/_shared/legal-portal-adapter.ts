export type LegalPortalProvider = "projudi_tjam";

export interface LegalPortalSessionState {
  cookies: Record<string, string>;
  entryUrl: string;
  authenticatedAt: string;
  refreshAt: string;
  expiresAt: string;
}

export interface LegalPortalCredentials {
  login: string;
  password: string;
  session?: LegalPortalSessionState;
}

export interface LegalPortalValidation {
  validatedAt: string;
  session: LegalPortalSessionState;
  capabilities: LegalPortalSnapshot["capabilities"];
}

export interface LegalPortalHearing {
  externalId: string;
  processNumber: string | null;
  type: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: "scheduled" | "rescheduled" | "cancelled" | "completed" | "unknown";
  modality: "presential" | "remote" | "hybrid" | "unknown";
  courtBody: string | null;
  location: string | null;
  remoteUrl: string | null;
  evidence: string;
  sourceUrl: string;
}

export interface LegalPortalSnapshot {
  provider: LegalPortalProvider;
  fetchedAt: string;
  hearings: LegalPortalHearing[];
  capabilities: {
    authenticatedHearings: true;
    futureHearings: true;
    historicalHearings: boolean;
  };
  session: LegalPortalSessionState;
  diagnostic?: Record<string, string | number | boolean>;
}

export class LegalPortalError extends Error {
  constructor(
    public readonly code:
      | "invalid_credentials"
      | "credential_missing"
      | "session_expired"
      | "mfa_required"
      | "captcha_required"
      | "certificate_required"
      | "portal_unavailable"
      | "login_page_changed"
      | "post_login_navigation_changed"
      | "agenda_navigation_changed"
      | "agenda_page_changed"
      | "layout_changed"
      | "portal_timeout",
    public readonly diagnostic: Record<string, string | number | boolean> | null = null,
  ) {
    super(code);
    this.name = "LegalPortalError";
  }
}

export interface LegalPortalAdapter {
  readonly provider: LegalPortalProvider;
  validateConnection(credentials: LegalPortalCredentials): Promise<LegalPortalValidation>;
  fetchFutureHearings(credentials: LegalPortalCredentials): Promise<LegalPortalSnapshot>;
}
