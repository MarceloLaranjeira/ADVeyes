import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTenant } from "@/contexts/TenantContext";
import {
  platformAdmin,
  type PlatformSupportSession,
} from "@/services/platform-admin";

interface PlatformSupportValue {
  isPlatformAccess: boolean;
  active: boolean;
  loading: boolean;
  session: PlatformSupportSession | null;
  start: (reason: string) => Promise<void>;
  end: () => Promise<void>;
  refresh: () => Promise<void>;
}

const PlatformSupportContext = createContext<PlatformSupportValue | null>(null);

export function PlatformSupportProvider({ children }: { children: ReactNode }) {
  const { currentTenant } = useTenant();
  const isPlatformAccess = currentTenant?.accessMode === "platform";
  const tenantId = isPlatformAccess ? currentTenant.tenantId : null;
  const [session, setSession] = useState<PlatformSupportSession | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setSession(null);
      return;
    }
    setLoading(true);
    try {
      const status = await platformAdmin.supportStatus(tenantId);
      setSession(status.active ? status.session : null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = useCallback(async (reason: string) => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const status = await platformAdmin.startSupport(tenantId, reason);
      setSession(status.session);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const end = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      await platformAdmin.endSupport(tenantId);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const value = useMemo(() => ({
    isPlatformAccess,
    active: Boolean(session),
    loading,
    session,
    start,
    end,
    refresh,
  }), [end, isPlatformAccess, loading, refresh, session, start]);

  return (
    <PlatformSupportContext.Provider value={value}>
      {children}
    </PlatformSupportContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlatformSupport() {
  const context = useContext(PlatformSupportContext);
  return context ?? {
    isPlatformAccess: false,
    active: false,
    loading: false,
    session: null,
    start: async () => undefined,
    end: async () => undefined,
    refresh: async () => undefined,
  };
}
