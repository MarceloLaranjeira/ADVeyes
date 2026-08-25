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

/**
 * Dependências para amarrar a restauração de rolagem a uma navegação real.
 *
 * Separado de `useScrollRestoration` para poder testar a regra do `enabled`
 * (e o rastreio de posição abaixo) sem precisar montar um componente React.
 */
export interface ScrollRestorationRunDeps {
  enabled: boolean;
  isPop: boolean;
  storageKey: string;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  setManualScrollRestoration: () => void;
  restore: ScrollRestoreDeps;
  getScrollY: () => number;
  addScrollListener: (handler: () => void) => void;
  removeScrollListener: (handler: () => void) => void;
}

/**
 * Executa uma navegação: liga a régua manual, restaura ou zera a rolagem, e
 * devolve o cleanup que grava a posição de saída.
 *
 * A posição de saída é rastreada continuamente por um listener de `scroll`
 * em vez de ser lida no momento do cleanup. Motivo: `AppLayout` é a régua
 * persistente do React Router — ela não desmonta entre rotas, só o
 * `<Outlet/>` troca de conteúdo. O React aplica a troca de DOM inteira
 * (incluindo o Outlet) antes de rodar o cleanup do efeito anterior; se a
 * página de destino for mais curta que a de origem, `scrollY` lido ali já
 * está saturado pela página NOVA (tipicamente 0), e a posição gravada sob a
 * chave da página de ORIGEM sairia errada. Rastrear via listener guarda o
 * último valor válido, de antes da troca.
 *
 * Quando `enabled` é falso, não faz nada: nenhuma leitura ou gravação de
 * armazenamento, nenhuma mutação de `history.scrollRestoration`, nenhum
 * listener registrado — e o cleanup devolvido também não faz nada.
 */
export function runScrollRestoration(
  deps: ScrollRestorationRunDeps,
): () => void {
  if (!deps.enabled) return () => {};

  deps.setManualScrollRestoration();

  if (deps.isPop) {
    const saved = Number.parseInt(deps.getItem(deps.storageKey) ?? "0", 10);
    restoreScrollOffset(Number.isFinite(saved) ? saved : 0, deps.restore);
  } else {
    deps.restore.scrollTo(0);
  }

  let lastScrollY = deps.getScrollY();
  const trackScroll = () => {
    lastScrollY = deps.getScrollY();
  };
  deps.addScrollListener(trackScroll);

  return () => {
    deps.removeScrollListener(trackScroll);
    deps.setItem(deps.storageKey, String(lastScrollY));
  };
}
