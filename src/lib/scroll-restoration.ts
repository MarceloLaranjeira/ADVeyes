/**
 * Restauração de rolagem para conteúdo que chega depois da navegação.
 *
 * No instante em que o usuário volta, a lista ainda não renderizou: a página
 * tem altura zero e rolar não faz nada. Por isso a restauração insiste a cada
 * quadro até a página caber a posição pedida, e desiste com um limite para
 * não perseguir uma altura que nunca vai chegar.
 */

export interface ScrollRestoreDeps {
  documentHeight: () => number;
  viewportHeight: () => number;
  scrollTo: (offset: number) => void;
  now: () => number;
  schedule: (callback: () => void) => void;
}

/** Tempo máximo de insistência. Acima disso a página não vai mais crescer. */
const GIVE_UP_MS = 1000;

export function restoreScrollOffset(
  offset: number,
  deps: ScrollRestoreDeps,
  startedAt: number = deps.now(),
): void {
  if (offset <= 0) {
    deps.scrollTo(0);
    return;
  }

  const attempt = () => {
    const reachable = deps.documentHeight() - deps.viewportHeight();
    if (reachable >= offset) {
      deps.scrollTo(offset);
      return;
    }
    if (deps.now() - startedAt >= GIVE_UP_MS) {
      deps.scrollTo(Math.max(0, reachable));
      return;
    }
    deps.schedule(attempt);
  };

  attempt();
}
