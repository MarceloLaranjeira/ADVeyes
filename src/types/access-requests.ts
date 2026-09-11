import type { PermissionOverrides } from "@/lib/permissions";
import type { TeamDataScope, TeamRole } from "@/types/team-management";

export type AccessRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

/** Solicitação aguardando decisão, na visão do proprietário. */
export interface PendingAccessRequest {
  id: string;
  user_id: string;
  email: string;
  name: string;
  phone: string | null;
  oab: string | null;
  created_at: string;
}

/** Solicitação já decidida, exibida no histórico. */
export interface DecidedAccessRequest {
  id: string;
  email: string;
  name: string;
  status: Exclude<AccessRequestStatus, "pending" | "cancelled">;
  membership_id: string | null;
  rejection_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
}

export interface AccessRequestsOverview {
  pending: PendingAccessRequest[];
  decided: DecidedAccessRequest[];
}

/** Situação das solicitações do próprio usuário, na tela de espera. */
export interface MyAccessRequest {
  request_id: string;
  tenant_id: string;
  tenant_name: string;
  status: AccessRequestStatus;
  rejection_reason: string | null;
  created_at: string;
  decided_at: string | null;
}

/** Identidade pública do escritório por trás de um link privado. */
export type AccessLinkLookup =
  | { valid: true; tenant_id: string; tenant_name: string; link_id: string }
  | { valid: false; reason: "invalid_token" | "revoked_token" };

export interface AccessLinkState {
  exists: boolean;
  link_id?: string;
  created_at?: string;
  /** O token em claro só existe no instante da geração. */
  url?: string | null;
}

export interface AccessDecisionInput {
  tenantId: string;
  requestId: string;
  decision: "approve" | "reject";
  access?: {
    role: Exclude<TeamRole, "owner">;
    dataScope: TeamDataScope;
    teamId?: string | null;
    overrides?: PermissionOverrides;
  };
  reason?: string | null;
}
