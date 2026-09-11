export type LegalCapability =
  | "official_process_lookup"
  | "official_publications"
  | "process_enrichment"
  | "lawyer_discovery"
  | "process_monitoring"
  | "judiciary_ai";

export type LegalProviderName =
  | "datajud"
  | "djen"
  | "judit"
  | "trackjud"
  | "escavador"
  | "conecta";

export interface LegalProviderAvailability {
  datajud: boolean;
  djen: boolean;
  judit: boolean;
  trackjud: boolean;
  escavador: boolean;
  conecta: boolean;
}

const ROUTES: Record<LegalCapability, LegalProviderName[]> = {
  official_process_lookup: ["datajud"],
  official_publications: ["djen"],
  process_enrichment: ["judit", "trackjud", "escavador"],
  lawyer_discovery: ["datajud", "judit", "trackjud", "escavador"],
  process_monitoring: ["djen", "judit", "trackjud", "escavador"],
  judiciary_ai: ["conecta"],
};

export function selectLegalProviders(
  capability: LegalCapability,
  available: LegalProviderAvailability,
): LegalProviderName[] {
  return ROUTES[capability].filter((provider) => available[provider]);
}

export function legalProviderAvailabilityFromEnvironment(
  env: (name: string) => string | undefined,
): LegalProviderAvailability {
  return {
    datajud: Boolean(env("DATAJUD_API_KEY")),
    djen: true,
    judit: Boolean(env("JUDIT_API_KEY")),
    trackjud: Boolean(env("TRACKJUD_API_KEY") && env("TRACKJUD_BASE_URL")),
    escavador: Boolean(env("ESCAVADOR_API_TOKEN")),
    // Conecta/Sinapses não expõe uma autorização pública para SaaS privado.
    // Só é ativado quando houver credencial e endpoint institucionais formais.
    conecta: Boolean(env("CNJ_CONECTA_API_TOKEN") && env("CNJ_CONECTA_BASE_URL")),
  };
}
