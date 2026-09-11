export interface DjenPartyView {
  name: string;
  side: string;
}

export interface DjenLawyerView {
  name: string;
  registration: string | null;
}

const sideLabels: Record<string, string> = {
  A: "Polo ativo",
  P: "Polo passivo",
  T: "Terceiro interessado",
  D: "Outro destinatário",
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isDjenIntimation(value: string | null | undefined): boolean {
  return value?.trim().toLocaleLowerCase("pt-BR").startsWith("intima") ?? false;
}

export function djenCertificateUrl(hash: string | null | undefined): string | null {
  const normalized = hash?.trim();
  return normalized
    ? `https://comunicaapi.pje.jus.br/api/v1/comunicacao/${encodeURIComponent(normalized)}/certidao`
    : null;
}

export function djenParties(value: unknown): DjenPartyView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const party = record(item);
    const name = text(party?.nome);
    if (!name) return [];
    const sideCode = text(party?.polo)?.toUpperCase() ?? "";
    return [{ name, side: sideLabels[sideCode] ?? "Polo não informado" }];
  });
}

export function djenLawyers(value: unknown): DjenLawyerView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    const lawyer = record(row?.advogado) ?? row;
    const name = text(lawyer?.nome);
    if (!name) return [];
    const number = text(lawyer?.numero_oab);
    const state = text(lawyer?.uf_oab)?.toUpperCase();
    return [{
      name,
      registration: number ? `OAB ${number}${state ? `/${state}` : ""}` : null,
    }];
  });
}
