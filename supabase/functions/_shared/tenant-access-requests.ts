/**
 * Contratos do fluxo de solicitação de acesso por link privado.
 *
 * O token vive apenas no link enviado pelo proprietário: o banco guarda o
 * hash. Nenhuma função aqui decide autorização — isso é do banco.
 */

export type TenantRole = "admin" | "lawyer" | "assistant" | "finance";
export type TenantDataScope = "tenant" | "team" | "assigned";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function optionalString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function createAccessToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function hashAccessToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function accessRequestUrl(token: string): string {
  const configured = Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ??
    "https://adveyes.automatikus.com.br";
  return `${configured.replace(/\/+$/, "")}/solicitar-acesso?token=${
    encodeURIComponent(token)
  }`;
}

export interface AccessLinkPayload {
  tenantId: string;
  action: "read" | "generate" | "revoke";
}

export function validateAccessLinkPayload(
  value: unknown,
): AccessLinkPayload | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const actions = ["read", "generate", "revoke"];
  if (!isUuid(body.tenantId)) return null;
  if (typeof body.action !== "string" || !actions.includes(body.action)) {
    return null;
  }
  return {
    tenantId: body.tenantId,
    action: body.action as AccessLinkPayload["action"],
  };
}

export interface RequestAccessPayload {
  token: string;
  profile: { name: string; phone: string | null; oab: string | null };
}

export function validateRequestAccessPayload(
  value: unknown,
): RequestAccessPayload | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const profile = body.profile as Record<string, unknown> | undefined;
  if (typeof body.token !== "string" || !TOKEN_PATTERN.test(body.token)) {
    return null;
  }
  const name = optionalString(profile?.name);
  if (!name || name.length < 2) return null;

  return {
    token: body.token,
    profile: {
      name,
      phone: optionalString(profile?.phone, 40),
      oab: optionalString(profile?.oab, 40),
    },
  };
}

export interface LookupLinkPayload {
  token: string;
}

export function validateLookupPayload(
  value: unknown,
): LookupLinkPayload | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.token !== "string" || !TOKEN_PATTERN.test(body.token)) {
    return null;
  }
  return { token: body.token };
}

export interface DecideAccessPayload {
  tenantId: string;
  requestId: string;
  decision: "approve" | "reject";
  role: TenantRole | null;
  dataScope: TenantDataScope | null;
  teamId: string | null;
  overrides: Record<string, Record<string, "allow" | "deny">>;
  reason: string | null;
}

/** Autoridades do proprietário nunca são delegadas por exceção individual. */
const FORBIDDEN_OVERRIDE_MODULES = new Set([
  "ownership",
  "access_requests",
  "permissions",
]);

function sanitizeOverrides(
  value: unknown,
): Record<string, Record<string, "allow" | "deny">> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const result: Record<string, Record<string, "allow" | "deny">> = {};
  for (const [module, actions] of Object.entries(value)) {
    if (FORBIDDEN_OVERRIDE_MODULES.has(module)) return null;
    if (!actions || typeof actions !== "object" || Array.isArray(actions)) {
      return null;
    }
    const entries: Record<string, "allow" | "deny"> = {};
    for (const [action, state] of Object.entries(actions)) {
      if (state !== "allow" && state !== "deny") return null;
      entries[action] = state;
    }
    if (Object.keys(entries).length > 0) result[module] = entries;
  }
  return result;
}

export function validateDecidePayload(
  value: unknown,
): DecideAccessPayload | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const roles = ["admin", "lawyer", "assistant", "finance"];
  const scopes = ["tenant", "team", "assigned"];

  if (!isUuid(body.tenantId) || !isUuid(body.requestId)) return null;
  if (body.decision !== "approve" && body.decision !== "reject") return null;

  if (body.decision === "reject") {
    return {
      tenantId: body.tenantId,
      requestId: body.requestId,
      decision: "reject",
      role: null,
      dataScope: null,
      teamId: null,
      overrides: {},
      reason: optionalString(body.reason, 500),
    };
  }

  const access = body.access as Record<string, unknown> | undefined;
  if (
    typeof access?.role !== "string" || !roles.includes(access.role) ||
    typeof access.dataScope !== "string" || !scopes.includes(access.dataScope)
  ) {
    return null;
  }
  if (access.dataScope === "team" && !isUuid(access.teamId)) return null;

  const overrides = sanitizeOverrides(access.overrides);
  if (!overrides) return null;

  return {
    tenantId: body.tenantId,
    requestId: body.requestId,
    decision: "approve",
    role: access.role as TenantRole,
    dataScope: access.dataScope as TenantDataScope,
    teamId: access.dataScope === "team" ? access.teamId as string : null,
    overrides,
    reason: null,
  };
}
