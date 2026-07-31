import { useAuth } from "@/contexts/AuthContext";
import { platformAdmin } from "@/services/platform-admin";
import { useCallback, useEffect, useRef, useState } from "react";

export const usePlatformAdmin = () => {
  const { user } = useAuth();
  const requestId = useRef(0);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!user) {
      setIsPlatformAdmin(false);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    try {
      const session = await platformAdmin.session();
      if (requestId.current !== currentRequest) return;
      setIsPlatformAdmin(session.isPlatformAdmin);
      setError(false);
    } catch {
      if (requestId.current !== currentRequest) return;
      setIsPlatformAdmin(false);
      setError(true);
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { isPlatformAdmin, loading, error, refresh };
};
