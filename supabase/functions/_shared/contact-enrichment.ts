export type ContactEnrichmentProvider = "brasilapi" | "opencnpj" | "serpro";

export interface ContactEnrichmentData {
  provider: ContactEnrichmentProvider;
  cnpj: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  corporateName: string | null;
  tradeName: string | null;
  checkedAt: string;
}

export class ContactEnrichmentError extends Error {
  constructor(
    public readonly code: "invalid_cnpj" | "not_found" | "provider_unavailable" | "invalid_response",
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "ContactEnrichmentError";
  }
}

const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeCnpj(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).toUpperCase().replace(/[^0-9A-Z]/g, "");
  return /^[0-9A-Z]{12}[0-9]{2}$/.test(normalized) ? normalized : null;
}

function cnpjCharacterValue(character: string): number {
  return character.charCodeAt(0) - 48;
}

function checkDigit(base: string, weights: number[]): number {
  const sum = [...base].reduce(
    (total, character, index) => total + cnpjCharacterValue(character) * weights[index],
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Valida CNPJ numérico e o formato alfanumérico vigente desde 2026. */
export function isValidCnpj(value: unknown): boolean {
  const cnpj = normalizeCnpj(value);
  if (!cnpj || /^([0-9A-Z])\1{11}[0-9]{2}$/.test(cnpj)) return false;
  const first = checkDigit(cnpj.slice(0, 12), FIRST_WEIGHTS);
  const second = checkDigit(`${cnpj.slice(0, 12)}${first}`, SECOND_WEIGHTS);
  return cnpj.endsWith(`${first}${second}`);
}

function scalar(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizePhone(value: unknown): string | null {
  const digits = scalar(value)?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return null;
}

function normalizeEmail(value: unknown): string | null {
  const email = scalar(value)?.toLocaleLowerCase("pt-BR") ?? null;
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function addressFrom(input: Record<string, unknown>): string | null {
  const street = [input.tipo_logradouro, input.logradouro, input.numero, input.complemento]
    .map(scalar).filter(Boolean).join(" ");
  const locality = [input.bairro, input.municipio, input.uf]
    .map(scalar).filter(Boolean).join(" - ");
  const postalCode = scalar(input.cep);
  return [street, locality, postalCode].filter(Boolean).join(" · ") || null;
}

function assertMatchingCnpj(payload: Record<string, unknown>, expectedCnpj: string): void {
  const received = normalizeCnpj(payload.cnpj);
  if (!received || received !== expectedCnpj) {
    throw new ContactEnrichmentError("invalid_response", false);
  }
}

export function parseBrasilApiContact(
  payload: Record<string, unknown>,
  expectedCnpj: string,
  checkedAt = new Date().toISOString(),
): ContactEnrichmentData {
  assertMatchingCnpj(payload, expectedCnpj);
  return {
    provider: "brasilapi",
    cnpj: expectedCnpj,
    phone: normalizePhone(payload.ddd_telefone_1 ?? payload.ddd_telefone_2),
    email: normalizeEmail(payload.email),
    address: addressFrom(payload),
    corporateName: scalar(payload.razao_social),
    tradeName: scalar(payload.nome_fantasia),
    checkedAt,
  };
}

export function parseOpenCnpjContact(
  payload: Record<string, unknown>,
  expectedCnpj: string,
  checkedAt = new Date().toISOString(),
): ContactEnrichmentData {
  assertMatchingCnpj(payload, expectedCnpj);
  const phones = Array.isArray(payload.telefones)
    ? payload.telefones.filter((phone): phone is Record<string, unknown> =>
      Boolean(phone) && typeof phone === "object" && !Array.isArray(phone)
    )
    : [];
  const preferredPhone = phones.find((phone) => phone.is_fax !== true) ?? phones[0];
  return {
    provider: "opencnpj",
    cnpj: expectedCnpj,
    phone: normalizePhone(
      preferredPhone
        ? `${scalar(preferredPhone.ddd) ?? ""}${scalar(preferredPhone.numero) ?? ""}`
        : null,
    ),
    email: normalizeEmail(payload.email),
    address: addressFrom(payload),
    corporateName: scalar(payload.razao_social),
    tradeName: scalar(payload.nome_fantasia),
    checkedAt,
  };
}

async function requestJson(
  fetcher: typeof fetch,
  url: string,
): Promise<{ status: number; payload: Record<string, unknown> | null }> {
  let response: Response;
  try {
    const signal = typeof AbortSignal !== "undefined" &&
        typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(8_000)
      : undefined;
    response = await fetcher(url, {
      headers: { accept: "application/json" },
      signal,
    });
  } catch {
    throw new ContactEnrichmentError("provider_unavailable", true);
  }
  if (response.status === 404) return { status: 404, payload: null };
  if (response.status === 429 || response.status >= 500) {
    throw new ContactEnrichmentError("provider_unavailable", true);
  }
  if (!response.ok) throw new ContactEnrichmentError("invalid_response", false);
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ContactEnrichmentError("invalid_response", false);
    }
    return { status: response.status, payload: payload as Record<string, unknown> };
  } catch (error) {
    if (error instanceof ContactEnrichmentError) throw error;
    throw new ContactEnrichmentError("invalid_response", false);
  }
}

/** Consulta a fonte gratuita principal e usa a contingência sem expor o CNPJ em erros. */
export async function fetchPublicContactEnrichment(
  rawCnpj: unknown,
  fetcher: typeof fetch = fetch,
): Promise<ContactEnrichmentData> {
  const cnpj = normalizeCnpj(rawCnpj);
  if (!cnpj || !isValidCnpj(cnpj)) {
    throw new ContactEnrichmentError("invalid_cnpj", false);
  }

  let primaryUnavailable = false;
  try {
    const primary = await requestJson(fetcher, `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (primary.payload) return parseBrasilApiContact(primary.payload, cnpj);
  } catch (error) {
    if (error instanceof ContactEnrichmentError && error.code === "invalid_response") throw error;
    primaryUnavailable = true;
  }

  try {
    const fallback = await requestJson(
      fetcher,
      `https://api.opencnpj.org/${cnpj}?datasets=receita`,
    );
    if (fallback.payload) return parseOpenCnpjContact(fallback.payload, cnpj);
  } catch (error) {
    if (error instanceof ContactEnrichmentError && error.retryable) throw error;
    throw error;
  }

  if (primaryUnavailable) {
    throw new ContactEnrichmentError("provider_unavailable", true);
  }
  throw new ContactEnrichmentError("not_found", false);
}
