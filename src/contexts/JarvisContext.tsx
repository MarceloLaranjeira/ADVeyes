import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface JarvisContextType {
  jarvisMode: boolean;
  toggleJarvis: () => void;
}

const JarvisContext = createContext<JarvisContextType>({
  jarvisMode: false,
  toggleJarvis: () => {},
});

export const JarvisProvider = ({ children }: { children: ReactNode }) => {
  const [jarvisMode, setJarvisMode] = useState(() => {
    return localStorage.getItem("adveyes_jarvis_mode") === "true";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (jarvisMode) {
      root.classList.add("jarvis");
      root.classList.remove("light");
    } else {
      root.classList.remove("jarvis");
      // Restore theme preference
      const theme = localStorage.getItem("theme") || "light";
      root.classList.add(theme);
    }
  }, [jarvisMode]);

  const toggleJarvis = () => {
    setJarvisMode((prev) => {
      const next = !prev;
      localStorage.setItem("adveyes_jarvis_mode", String(next));
      return next;
    });
  };

  return (
    <JarvisContext.Provider value={{ jarvisMode, toggleJarvis }}>
      {children}
    </JarvisContext.Provider>
  );
};

export const useJarvis = () => useContext(JarvisContext);
