import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildTenantAppUrl,
  resolveTenantHost,
  shouldNavigateTenantInPlace,
} from "@/lib/tenant-host";
import { withTimeout } from "@/lib/async-timeout";

export interface TenantBranding {
  publicName: string;
  shortName: string;
  logoLightPath: string | null;
  logoDarkPath: string | null;
  faviconPath: string | null;
  iconPath: string | null;
  colorTokens: Record<string, string>;
  privacyUrl?: string;
  termsUrl?: string;
}

export interface TenantPublicConfig {
  hostname: string;
  mode: "central" | "tenant" | "invalid";
  available: boolean;
  slug: string | null;
  branding: TenantBranding | null;
}

export interface TenantMembership {
  tenantId: string;
  slug: string;
  displayName: string;
  status: string;
  role: "owner" | "admin" | "lawyer" | "assistant" | "finance";
  dataScope: "tenant" | "team" | "assigned";
  branding: TenantBranding;
  accessMode?: "membership" | "platform";
}

export type TenantAccessError =
  | "invalid_host"
  | "tenant_unavailable"
  | "tenant_forbidden"
  | "no_membership"
  | "tenant_load_failed"
  | "public_config_failed"
  | null;

interface TenantContextValue {
  host: ReturnType<typeof resolveTenantHost>;
  publicConfig: TenantPublicConfig | null;
  memberships: TenantMembership[];
  currentTenant: TenantMembership | null;
  loading: boolean;
  error: TenantAccessError;
  selectTenant: (tenant: TenantMembership) => void;
  selectPlatformTenant: (tenant: TenantMembership) => void;
  refresh: () => Promise<void>;
}

interface CurrentUserTenantRow {
  tenant_id: string;
  slug: string;
  display_name: string;
  status: string;
  membership_role: TenantMembership["role"];
  data_scope: TenantMembership["dataScope"];
  public_name: string | null;
  short_name: string | null;
  logo_light_path: string | null;
  logo_dark_path: string | null;
  favicon_path: string | null;
  icon_path: string | null;
  color_tokens: Record<string, string> | null;
}

type CurrentUserTenantsRpc = (
  functionName: "current_user_tenants",
) => Promise<{
  data: CurrentUserTenantRow[] | null;
  error: { message: string } | null;
}>;

const TenantContext = createContext<TenantContextValue | null>(null);

const defaultBranding: TenantBranding = {
  publicName: "ADVeyes",
  shortName: "ADVeyes",
  logoLightPath: null,
  logoDarkPath: null,
  faviconPath: null,
  iconPath: null,
  colorTokens: {},
  privacyUrl: "/privacidade",
  termsUrl: "/termos",
};

const mapMembership = (row: CurrentUserTenantRow): TenantMembership => ({
  tenantId: row.tenant_id,
  slug: row.slug,
  displayName: row.display_name,
  status: row.status,
  role: row.membership_role,
  dataScope: row.data_scope,
  accessMode: "membership",
  branding: {
    publicName: row.public_name || row.display_name || "ADVeyes",
    shortName: row.short_name || row.public_name || row.display_name || "ADVeyes",
    logoLightPath: row.logo_light_path ?? null,
    logoDarkPath: row.logo_dark_path ?? null,
    faviconPath: row.favicon_path ?? null,
    iconPath: row.icon_path ?? null,
    colorTokens: row.color_tokens ?? {},
  },
});

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  // A identidade do usuário é o que importa aqui. Depender do objeto inteiro
  // faria a renovação de token recarregar os vínculos e limpar a tela ativa.
  const userId = user?.id ?? null;
  const host = useMemo(
    () => resolveTenantHost(window.location.hostname),
    [],
  );
  const [publicConfig, setPublicConfig] =
    useState<TenantPublicConfig | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [currentTenant, setCurrentTenant] =
    useState<TenantMembership | null>(null);
  const [publicLoading, setPublicLoading] = useState(true);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipUserId, setMembershipUserId] =
    useState<string | null>(null);
  const [publicError, setPublicError] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  const membershipRequest = useRef(0);

  const loadPublicConfig = useCallback(async () => {
    setPublicLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke(
          "tenant-public-config",
          { body: { hostname: host.hostname } },
        ),
      );

      if (error || !data) throw error ?? new Error("Configuração ausente");

      setPublicConfig(data as TenantPublicConfig);
      setPublicError(false);
    } catch {
      if (host.local) {
        setPublicConfig({
          hostname: host.hostname,
          mode: "central",
          available: true,
          slug: null,
          branding: defaultBranding,
        });
        setPublicError(false);
      } else {
        setPublicConfig(null);
        setPublicError(true);
      }
    } finally {
      setPublicLoading(false);
    }
  }, [host]);

  const loadMemberships = useCallback(async () => {
    const requestId = ++membershipRequest.current;

    if (!userId) {
      setMemberships([]);
      setCurrentTenant(null);
      setMembershipUserId(null);
      setMembershipError(false);
      setMembershipLoading(false);
      return;
    }

    setMembershipLoading(true);
    try {
      const { data, error } = await withTimeout(
        (supabase.rpc as unknown as CurrentUserTenantsRpc).call(
          supabase,
          "current_user_tenants",
        ),
      );

      if (requestId !== membershipRequest.current) return;
      if (error) throw error;

      const nextMemberships = (data ?? []).map(mapMembership);
      setMemberships(nextMemberships);
      setMembershipUserId(userId);
      setMembershipError(false);

      const storedSlug = sessionStorage.getItem(
        `adveyes:selected-tenant:${userId}`,
      ) ?? localStorage.getItem(`adveyes:selected-tenant:${userId}`);
      let storedPlatformTenant: TenantMembership | null = null;
      try {
        const raw = sessionStorage.getItem(
          `adveyes:platform-tenant:${userId}`,
        );
        const parsed = raw ? JSON.parse(raw) as TenantMembership : null;
        if (
          parsed?.accessMode === "platform" && parsed.tenantId && parsed.slug
        ) storedPlatformTenant = parsed;
      } catch {
        sessionStorage.removeItem(`adveyes:platform-tenant:${userId}`);
      }
      const selected =
        (host.mode === "tenant"
          ? nextMemberships.find(
              (membership: TenantMembership) => membership.slug === host.slug,
            ) ?? (storedPlatformTenant?.slug === host.slug
              ? storedPlatformTenant
              : null)
          : nextMemberships.find(
              (membership: TenantMembership) => membership.slug === storedSlug,
            ) ?? storedPlatformTenant) ??
        (host.mode === "central" ? nextMemberships[0] : null);

      setCurrentTenant(selected ?? null);
    } catch {
      if (requestId !== membershipRequest.current) return;
      setMemberships([]);
      setCurrentTenant(null);
      setMembershipUserId(userId);
      setMembershipError(true);
    } finally {
      if (requestId === membershipRequest.current) {
        setMembershipLoading(false);
      }
    }
  }, [host, userId]);

  useEffect(() => {
    loadPublicConfig();
  }, [loadPublicConfig]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  const selectTenant = useCallback(
    (tenant: TenantMembership) => {
      if (!userId) return;

      sessionStorage.removeItem(`adveyes:platform-tenant:${userId}`);

      sessionStorage.setItem(
        `adveyes:selected-tenant:${userId}`,
        tenant.slug,
      );
      localStorage.setItem(
        `adveyes:selected-tenant:${userId}`,
        tenant.slug,
      );

      if (shouldNavigateTenantInPlace(host)) {
        setCurrentTenant(tenant);
        return;
      }

      window.location.assign(
        buildTenantAppUrl({
          slug: tenant.slug,
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
          protocol: window.location.protocol,
        }),
      );
    },
    [host, userId],
  );

  const selectPlatformTenant = useCallback(
    (tenant: TenantMembership) => {
      if (!userId) return;
      const platformTenant = { ...tenant, accessMode: "platform" as const };
      sessionStorage.setItem(
        `adveyes:platform-tenant:${userId}`,
        JSON.stringify(platformTenant),
      );
      sessionStorage.setItem(
        `adveyes:selected-tenant:${userId}`,
        platformTenant.slug,
      );

      if (shouldNavigateTenantInPlace(host)) {
        setCurrentTenant(platformTenant);
        return;
      }
      window.location.assign(buildTenantAppUrl({
        slug: platformTenant.slug,
        pathname: "/",
        protocol: window.location.protocol,
      }));
    },
    [host, userId],
  );

  const error = useMemo<TenantAccessError>(() => {
    if (host.mode === "invalid") return "invalid_host";
    if (publicError) return "public_config_failed";
    const membershipsReady = !userId || membershipUserId === userId;
    if (!membershipsReady) return null;
    if (membershipError) return "tenant_load_failed";
    if (publicConfig && !publicConfig.available) return "tenant_unavailable";
    if (!userId) return null;
    if (
      host.mode === "tenant" &&
      !membershipLoading &&
      !memberships.some((membership) => membership.slug === host.slug) &&
      !(currentTenant?.accessMode === "platform" && currentTenant.slug === host.slug)
    ) {
      return "tenant_forbidden";
    }
    if (
      memberships.length === 0 && !membershipLoading &&
      currentTenant?.accessMode !== "platform"
    ) return "no_membership";
    return null;
  }, [
    host,
    membershipError,
    membershipLoading,
    membershipUserId,
    memberships,
    currentTenant,
    publicConfig,
    publicError,
    userId,
  ]);

  const refresh = useCallback(async () => {
    await Promise.all([loadPublicConfig(), loadMemberships()]);
  }, [loadMemberships, loadPublicConfig]);

  return (
    <TenantContext.Provider
      value={{
        host,
        publicConfig,
        memberships,
        currentTenant,
        loading:
          publicLoading ||
          membershipLoading ||
          Boolean(userId && membershipUserId !== userId),
        error,
        selectTenant,
        selectPlatformTenant,
        refresh,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant deve ser usado dentro de TenantProvider");
  }
  return context;
};
