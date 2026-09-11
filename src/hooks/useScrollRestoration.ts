import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { runScrollRestoration } from "@/lib/scroll-restoration";

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
 *
 * A lógica em si (o que fazer a cada navegação e o que gravar na saída) vive
 * em `runScrollRestoration`, em `src/lib/scroll-restoration.ts` — aqui só
 * amarramos essa lógica às APIs reais do navegador e ao roteador.
 */
export function useScrollRestoration(
  options: UseScrollRestorationOptions = {},
): void {
  const { enabled = true } = options;
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (typeof window === "undefined") return;

    return runScrollRestoration({
      enabled,
      isPop: navigationType === "POP",
      storageKey: `${PREFIX}${location.key}`,
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
      setManualScrollRestoration: () => {
        if ("scrollRestoration" in window.history) {
          window.history.scrollRestoration = "manual";
        }
      },
      restore: {
        documentHeight: () => document.documentElement.scrollHeight,
        viewportHeight: () => window.innerHeight,
        scrollTo: (offset) => window.scrollTo(0, offset),
        now: () => performance.now(),
        schedule: (callback) => window.requestAnimationFrame(callback),
      },
      getScrollY: () => window.scrollY,
      addScrollListener: (handler) =>
        window.addEventListener("scroll", handler, { passive: true }),
      removeScrollListener: (handler) =>
        window.removeEventListener("scroll", handler),
    });
  }, [enabled, location.key, navigationType]);
}
