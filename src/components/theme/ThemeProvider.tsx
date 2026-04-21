import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  attribute?: "class" | string;
  children: ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
};

type ThemeContextValue = {
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  theme: Theme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

const getSystemTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getStoredTheme = (defaultTheme: Theme): Theme => {
  if (typeof window === "undefined") return defaultTheme;

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
    return storedTheme;
  }

  return defaultTheme;
};

const applyTheme = (resolvedTheme: "light" | "dark", attribute: string) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (root.classList.contains("jarvis")) return;

  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    return;
  }

  root.setAttribute(attribute, resolvedTheme);
};

export function ThemeProvider({
  attribute = "class",
  children,
  defaultTheme = "light",
  enableSystem = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme(defaultTheme));

  const resolvedTheme = useMemo<"light" | "dark">(() => {
    if (theme === "system") {
      return enableSystem ? getSystemTheme() : "light";
    }

    return theme;
  }, [enableSystem, theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(resolvedTheme, attribute);
  }, [attribute, resolvedTheme, theme]);

  useEffect(() => {
    if (!enableSystem || theme !== "system" || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme(getSystemTheme(), attribute);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [attribute, enableSystem, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ resolvedTheme, setTheme, theme }),
    [resolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
