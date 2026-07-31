export const CENTRAL_TENANT_HOST = "adveyes.automatikus.com.br";
export const TENANT_HOST_SUFFIX = `.adveyes.automatikus.com.br`;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type TenantHost =
  | { mode: "central"; hostname: string; slug: null; local: boolean }
  | { mode: "tenant"; hostname: string; slug: string; local: false }
  | { mode: "invalid"; hostname: string; slug: null; local: false };

export const normalizeTenantHostname = (hostname: string) =>
  hostname.trim().toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");

export const resolveTenantHost = (rawHostname: string): TenantHost => {
  const hostname = normalizeTenantHostname(rawHostname);

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { mode: "central", hostname, slug: null, local: true };
  }

  if (hostname === CENTRAL_TENANT_HOST) {
    return { mode: "central", hostname, slug: null, local: false };
  }

  if (hostname.endsWith(TENANT_HOST_SUFFIX)) {
    const slug = hostname.slice(0, -TENANT_HOST_SUFFIX.length);
    if (SLUG_PATTERN.test(slug)) {
      return { mode: "tenant", hostname, slug, local: false };
    }
  }

  return { mode: "invalid", hostname, slug: null, local: false };
};

export const buildTenantAppUrl = ({
  slug,
  pathname,
  search = "",
  hash = "",
  protocol = "https:",
}: {
  slug: string;
  pathname: string;
  search?: string;
  hash?: string;
  protocol?: string;
}) => {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("Slug de escritório inválido");
  }

  return `${protocol}//${slug}${TENANT_HOST_SUFFIX}${pathname}${search}${hash}`;
};

export const shouldNavigateTenantInPlace = (host: TenantHost) =>
  host.local || host.mode === "central";
