export const SIDEBAR_SCROLL_KEY = "adveyes:rolagem-menu";

export function readSidebarScroll(storage: Pick<Storage, "getItem">): number {
  try {
    const value = Number(storage.getItem(SIDEBAR_SCROLL_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveSidebarScroll(
  storage: Pick<Storage, "setItem">,
  position: number,
): void {
  try {
    storage.setItem(SIDEBAR_SCROLL_KEY, String(Math.max(0, position)));
  } catch {
    // A navegação continua funcional quando o armazenamento está indisponível.
  }
}
