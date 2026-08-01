/**
 * Paleta da plataforma e presets oferecidos ao escritório.
 * O azul ADVeyes é o padrão: vale enquanto o escritório não escolher o seu.
 */

export interface BrandPreset {
  id: string;
  label: string;
  description: string;
  /** Cor mostrada na amostra da opção. */
  swatch: string;
  /** Sem tokens, vale a paleta da plataforma definida no CSS. */
  tokens: Record<string, string>;
}

/** Azul da plataforma, equivalente ao `--primary` padrão do tema. */
export const ADVEYES_PRIMARY = "#2488e5";

export const ADVEYES_PRESET: BrandPreset = {
  id: "adveyes",
  label: "Azul ADVeyes",
  description: "Identidade padrão da plataforma.",
  swatch: ADVEYES_PRIMARY,
  tokens: {},
};

export const BRAND_PRESETS: BrandPreset[] = [
  ADVEYES_PRESET,
  {
    id: "grafite",
    label: "Grafite sóbrio",
    description: "Neutro e discreto, para bancas tradicionais.",
    swatch: "#2f3640",
    tokens: {
      primary: "#2f3640",
      ring: "#2f3640",
      "sidebar-primary": "#2f3640",
    },
  },
  {
    id: "bordo",
    label: "Bordô clássico",
    description: "Tom jurídico tradicional, de forte contraste.",
    swatch: "#6b1f2e",
    tokens: {
      primary: "#6b1f2e",
      ring: "#6b1f2e",
      "sidebar-primary": "#6b1f2e",
    },
  },
  {
    id: "verde",
    label: "Verde institucional",
    description: "Sobriedade com leitura mais leve.",
    swatch: "#14532d",
    tokens: {
      primary: "#14532d",
      ring: "#14532d",
      "sidebar-primary": "#14532d",
    },
  },
  {
    id: "roxo",
    label: "Roxo contemporâneo",
    description: "Para escritórios com posicionamento mais moderno.",
    swatch: "#4c1d95",
    tokens: {
      primary: "#4c1d95",
      ring: "#4c1d95",
      "sidebar-primary": "#4c1d95",
    },
  },
];

/** Monta os tokens a partir de uma cor escolhida livremente. */
export function tokensFromPrimary(hex: string): Record<string, string> {
  return {
    primary: hex,
    ring: hex,
    "sidebar-primary": hex,
  };
}

/** Descobre qual preset corresponde às cores salvas. */
export function presetForTokens(
  tokens: Record<string, string> | null | undefined,
): BrandPreset | null {
  const primary = tokens?.primary?.trim().toLowerCase();
  if (!primary) return ADVEYES_PRESET;
  return BRAND_PRESETS.find(
    (preset) => preset.tokens.primary?.toLowerCase() === primary,
  ) ?? null;
}

/**
 * Contraste relativo entre a cor escolhida e o texto branco, para avisar
 * quando a leitura fica prejudicada (WCAG recomenda 4.5:1 em texto normal).
 */
export function contrastWithWhite(hex: string): number | null {
  const normalized = hex.trim().replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;

  const channel = (start: number) => {
    const raw = parseInt(value.slice(start, start + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };

  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) +
    0.0722 * channel(4);
  return Number(((1.05) / (luminance + 0.05)).toFixed(2));
}
