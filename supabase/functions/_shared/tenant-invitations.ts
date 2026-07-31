export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TenantRole = "admin" | "lawyer" | "assistant" | "finance";
export type TenantDataScope = "tenant" | "team" | "assigned";

export interface InviteMemberPayload {
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
    role: TenantRole;
    dataScope: TenantDataScope;
    teamId?: string | null;
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function validateInvitePayload(
  value: unknown,
): InviteMemberPayload | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const profile = body.profile as Record<string, unknown> | undefined;
  const access = body.access as Record<string, unknown> | undefined;
  const roles = ["admin", "lawyer", "assistant", "finance"];
  const scopes = ["tenant", "team", "assigned"];

  if (
    !isUuid(body.tenantId) || !profile || !access ||
    typeof profile.name !== "string" || !profile.name.trim() ||
    typeof profile.email !== "string" ||
    !EMAIL_PATTERN.test(normalizeEmail(profile.email)) ||
    typeof access.role !== "string" || !roles.includes(access.role) ||
    typeof access.dataScope !== "string" ||
    !scopes.includes(access.dataScope) ||
    (access.dataScope === "team" && !isUuid(access.teamId))
  ) {
    return null;
  }

  return {
    tenantId: body.tenantId,
    profile: {
      name: profile.name.trim(),
      email: normalizeEmail(profile.email),
      phone: optionalString(profile.phone),
      jobTitle: optionalString(profile.jobTitle),
      oab: optionalString(profile.oab),
      hourlyRate: optionalNumber(profile.hourlyRate),
      monthlyHoursTarget: optionalNumber(profile.monthlyHoursTarget),
    },
    access: {
      role: access.role as TenantRole,
      dataScope: access.dataScope as TenantDataScope,
      teamId: access.dataScope === "team" ? access.teamId as string : null,
    },
  };
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function createInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    "",
  );
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function hashInvitationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function invitationExpiresAt(now = Date.now()): string {
  return new Date(now + INVITATION_TTL_MS).toISOString();
}

export function invitationUrl(token: string): string {
  const configured = Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ??
    "https://adveyes.automatikus.com.br";
  return `${configured.replace(/\/+$/, "")}/convite/aceitar?token=${
    encodeURIComponent(token)
  }`;
}
