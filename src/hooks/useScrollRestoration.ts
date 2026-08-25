import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { restoreScrollOffset } from "@/lib/scroll-restoration";

const PREFIX = "scroll:";

interface UseScrollRestorationOptions {
  enabled?: boolean;
}

/**
 * Guarda a posição de cada entrada do histórico e a devolve ao voltar.
 *
 * A chave é a `key` que o roteador dá à entrada: ela é a mesma quando o
 * usuário volta, e diferente quando ele avança para uma tela nova.
 *
 * `enabled` existe porque páginas antigas ainda declaram `<AppLayout>`
 * localmente dentro da rota de layout persistente: sem essa opção, as duas
 * instâncias do componente montariam o hook e cada uma salvaria e
 * restauraria a mesma chave do sessionStorage, disputando entre si.
 */
export function useScrollRestoration(
  options: UseScrollRestorationOptions = {},
): void {
  const { enabled = true } = options;
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const storageKey = `${PREFIX}${location.key}`;

    if (navigationType === "POP") {
      const saved = Number.parseInt(
        window.sessionStorage.getItem(storageKey) ?? "0",
        10,
      );
      restoreScrollOffset(Number.isFinite(saved) ? saved : 0, {
        documentHeight: () => document.documentElement.scrollHeight,
        viewportHeight: () => window.innerHeight,
        scrollTo: (offset) => window.scrollTo(0, offset),
        now: () => performance.now(),
        schedule: (callback) => window.requestAnimationFrame(callback),
      });
    } else {
      window.scrollTo(0, 0);
    }

    return () => {
      // A saída é o único momento em que a posição ainda é a do usuário.
      window.sessionStorage.setItem(storageKey, String(window.scrollY));
    };
  }, [enabled, location.key, navigationType]);
}
