import { useEffect, type ReactNode } from "react";

/**
 * Fixa a paleta única do sistema.
 *
 * O projeto tinha três paletas alternáveis. Sobrou uma — marfim e latão,
 * definida em `:root`. Este componente não escolhe mais nada: ele apenas
 * limpa as classes que ficaram gravadas no `localStorage` de quem usou a
 * versão anterior, senão o `<html>` continuaria carregando `class="dark"`
 * para sempre, sem CSS correspondente.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark", "jarvis", "light");
    window.localStorage.removeItem("theme");
    window.localStorage.removeItem("adveyes_jarvis_mode");
  }, []);

  return <>{children}</>;
}
