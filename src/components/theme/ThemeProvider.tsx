import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";

export function ThemeProvider({ children, ...props }: { children: ReactNode; [key: string]: any }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
