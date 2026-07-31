import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async-timeout";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

/**
 * O Supabase reemite a sessão ao recuperar o foco da aba. Sem esta comparação,
 * cada retorno à janela cria um objeto novo de sessão, o que remonta a árvore,
 * recarrega os vínculos do escritório e apaga o estado da tela aberta.
 */
function isSameSession(current: Session | null, next: Session | null): boolean {
  if (current === next) return true;
  if (!current || !next) return false;
  return current.access_token === next.access_token &&
    current.user.id === next.user.id;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((next: Session | null) => {
    setSession((current) => (isSameSession(current, next) ? current : next));
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        applySession(nextSession);
        setLoading(false);
      }
    );

    void withTimeout(supabase.auth.getSession()).then(
      ({ data: { session: currentSession } }) => applySession(currentSession),
      () => applySession(null),
    ).finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, [applySession]);

  const user = useMemo<User | null>(() => session?.user ?? null, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const value = useMemo(
    () => ({ session, user, loading, signOut }),
    [session, user, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
