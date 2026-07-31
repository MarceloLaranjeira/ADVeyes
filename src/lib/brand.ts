import type { TenantBranding } from "@/contexts/TenantContext";

export const DEFAULT_BRANDING: TenantBranding = {
  publicName: "ADVeyes",
  shortName: "ADVeyes",
  logoLightPath: null,
  logoDarkPath: null,
  faviconPath: "/logo.svg",
  iconPath: null,
  colorTokens: {},
  privacyUrl: "/privacidade",
  termsUrl: "/termos",
};

const COLOR_TOKEN_MAP: Record<string, string> = {
  primary: "--primary",
  "primary-foreground": "--primary-foreground",
  primaryForeground: "--primary-foreground",
  "primary-100": "--primary-100",
  primary100: "--primary-100",
  "primary-900": "--primary-900",
  primary900: "--primary-900",
  secondary: "--secondary",
  "secondary-foreground": "--secondary-foreground",
  secondaryForeground: "--secondary-foreground",
  accent: "--accent",
  "accent-foreground": "--accent-foreground",
  accentForeground: "--accent-foreground",
  ring: "--ring",
  "sidebar-primary": "--sidebar-primary",
  sidebarPrimary: "--sidebar-primary",
  "sidebar-primary-foreground": "--sidebar-primary-foreground",
  sidebarPrimaryForeground: "--sidebar-primary-foreground",
  "sidebar-accent": "--sidebar-accent",
  sidebarAccent: "--sidebar-accent",
  "sidebar-accent-foreground": "--sidebar-accent-foreground",
  sidebarAccentForeground: "--sidebar-accent-foreground",
};

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const HSL_TRIPLET =
  /^(?:360|3[0-5]\d|[12]?\d?\d)\s+(?:100|[1-9]?\d)%\s+(?:100|[1-9]?\d)%$/;

const expandHex = (hex: string) => {
  const value = hex.slice(1);
  return value.length === 3
    ? value
        .split("")
        .map((character) => character + character)
        .join("")
    : value;
};

export const hexToHslTriplet = (hex: string): string | null => {
  if (!HEX_COLOR.test(hex)) return null;

  const value = expandHex(hex);
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation =
      lightness > 0.5
        ? delta / (2 - max - min)
        : delta / (max + min);

    if (max === red) {
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
  }

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(
    lightness * 100,
  )}%`;
};

export const normalizeColorToken = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (HSL_TRIPLET.test(trimmed)) return trimmed;
  return hexToHslTriplet(trimmed);
};

export const buildBrandCssVariables = (
  tokens: Record<string, string> | null | undefined,
) => {
  const variables: Record<string, string> = {};

  for (const [token, value] of Object.entries(tokens ?? {})) {
    const cssVariable = COLOR_TOKEN_MAP[token];
    const normalized = normalizeColorToken(value);
    if (cssVariable && normalized) variables[cssVariable] = normalized;
  }

  return variables;
};

export const resolveBrandAssetUrl = (
  path: string | null | undefined,
): string | null => {
  if (!path) return null;
  const value = path.trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const cleanName = (value: string | null | undefined, fallback: string) => {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 80) : fallback;
};

export const resolveBranding = (
  branding: TenantBranding | null | undefined,
): TenantBranding => {
  const publicName = cleanName(
    branding?.publicName,
    DEFAULT_BRANDING.publicName,
  );

  return {
    publicName,
    shortName: cleanName(branding?.shortName, publicName),
    logoLightPath: resolveBrandAssetUrl(branding?.logoLightPath),
    logoDarkPath: resolveBrandAssetUrl(branding?.logoDarkPath),
    faviconPath:
      resolveBrandAssetUrl(branding?.faviconPath) ??
      DEFAULT_BRANDING.faviconPath,
    iconPath: resolveBrandAssetUrl(branding?.iconPath),
    colorTokens: branding?.colorTokens ?? {},
    privacyUrl:
      resolveBrandAssetUrl(branding?.privacyUrl) ??
      DEFAULT_BRANDING.privacyUrl,
    termsUrl:
      resolveBrandAssetUrl(branding?.termsUrl) ?? DEFAULT_BRANDING.termsUrl,
  };
};

const setMetaContent = (
  document: Document,
  selector: string,
  content: string,
) => {
  const element = document.querySelector<HTMLMetaElement>(selector);
  if (element) element.content = content;
};

export const applyBrandToDocument = (
  document: Document,
  branding: TenantBranding,
) => {
  const root = document.documentElement;
  const variables = buildBrandCssVariables(branding.colorTokens);
  const previousVariables = new Map<string, string>();

  for (const [name, value] of Object.entries(variables)) {
    previousVariables.set(name, root.style.getPropertyValue(name));
    root.style.setProperty(name, value);
  }

  const favicon =
    document.querySelector<HTMLLinkElement>('link[data-brand-favicon]');
  const applicationName =
    document.querySelector<HTMLMetaElement>('meta[name="application-name"]');
  const appleTitle = document.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-title"]',
  );
  const themeColor =
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const previous = {
    title: document.title,
    favicon: favicon?.href ?? "",
    applicationName: applicationName?.content ?? "",
    appleTitle: appleTitle?.content ?? "",
    themeColor: themeColor?.content ?? "",
    tenant: root.dataset.tenantBrand,
  };

  document.title = `${branding.publicName} — Gestão Jurídica`;
  if (favicon && branding.faviconPath) favicon.href = branding.faviconPath;
  setMetaContent(document, 'meta[name="application-name"]', branding.publicName);
  setMetaContent(
    document,
    'meta[name="apple-mobile-web-app-title"]',
    branding.shortName,
  );

  const primary = branding.colorTokens.primary;
  if (themeColor && typeof primary === "string" && HEX_COLOR.test(primary)) {
    themeColor.content = primary;
  }
  root.dataset.tenantBrand = branding.shortName;
  root.dataset.brandReady = "true";

  return () => {
    for (const [name, previousValue] of previousVariables) {
      if (previousValue) root.style.setProperty(name, previousValue);
      else root.style.removeProperty(name);
    }
    document.title = previous.title;
    if (favicon) favicon.href = previous.favicon;
    if (applicationName) applicationName.content = previous.applicationName;
    if (appleTitle) appleTitle.content = previous.appleTitle;
    if (themeColor) themeColor.content = previous.themeColor;
    if (previous.tenant) root.dataset.tenantBrand = previous.tenant;
    else delete root.dataset.tenantBrand;
    delete root.dataset.brandReady;
  };
};
