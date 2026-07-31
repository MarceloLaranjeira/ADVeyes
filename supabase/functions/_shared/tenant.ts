const CENTRAL_HOSTS = new Set([
  "adveyes.automatikus.com.br",
  "localhost",
  "127.0.0.1",
]);

const TENANT_HOST_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*\.adveyes\.automatikus\.com\.br$/;

export const normalizeHostname = (value: string) =>
  value.trim().toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");

export const isAllowedTenantHostname = (value: string) => {
  const hostname = normalizeHostname(value);
  return CENTRAL_HOSTS.has(hostname) || TENANT_HOST_PATTERN.test(hostname);
};

export const hostnameFromRequest = async (request: Request) => {
  const url = new URL(request.url);
  const queryHostname = url.searchParams.get("hostname");

  if (queryHostname) return normalizeHostname(queryHostname);

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.hostname === "string") {
      return normalizeHostname(body.hostname);
    }
  }

  return "";
};
