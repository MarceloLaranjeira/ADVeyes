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
    // v2.0 redesign: Jarvis OFF por padrão para garantir o tema premium navy + gold.
    // Usuário ativa manualmente pelo botão na sidebar.
    return false;
  });

  // A paleta "jarvis" foi removida junto com a escura: o sistema tem uma só,
  // definida em `:root`. Este contexto não mexe mais na classe do <html>.

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
