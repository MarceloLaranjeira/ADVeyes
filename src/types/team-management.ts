export type TeamRole = "owner" | "admin" | "lawyer" | "assistant" | "finance";
export type TeamDataScope = "tenant" | "team" | "assigned";
export type MemberStatus = "active" | "suspended" | "invited";

export interface TeamMember {
  id: string;
  membership_id: string | null;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string;
  oab: string | null;
  hourly_rate: number | null;
  monthly_hours_target: number | null;
  avatar_url: string | null;
  active: boolean;
  role: TeamRole | null;
  data_scope: TeamDataScope | null;
  status: "active" | "suspended" | null;
  team_id: string | null;
}

export interface PendingInvitation {
  id: string;
  member_id: string | null;
  email: string;
  role: Exclude<TeamRole, "owner">;
  data_scope: TeamDataScope;
  team_id: string | null;
  status: "pending";
  expires_at: string;
  created_at: string;
}

export interface TenantTeam {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface TeamOverview {
  members: TeamMember[];
  invitations: PendingInvitation[];
  teams: TenantTeam[];
}

export interface InviteMemberInput {
  tenantId: string;
  profile: {
    name: string;
    email: string;
    phone?: string | null;
    jobTitle?: string | null;
    oab?: string | null;
    hourlyRate?: number | null;
    monthlyHoursTarget?: number | null;
  };
  access: {
    role: Exclude<TeamRole, "owner">;
    dataScope: TeamDataScope;
    teamId?: string | null;
  };
}
