import { createContext, ReactNode, useContext, useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { PlatformSupportBanner } from "./PlatformSupportBanner";

interface AppLayoutProps {
  children?: ReactNode;
}

const AppLayoutContext = createContext(false);

/**
 * Astrea-style shell:
 *  - Header fixo 64px no topo
 *  - Sidebar fixa 240px à esquerda (abaixo do header)
 *  - Área principal com offset top-16 e left-60 (lg+)
 */
export const AppLayout = ({ children }: AppLayoutProps) => {
  const isInsideAppLayout = useContext(AppLayoutContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // As páginas antigas ainda declaram AppLayout localmente. Quando elas são
  // renderizadas dentro da rota de layout persistente, evitamos montar uma
  // segunda régua e entregamos apenas o conteúdo da página.
  if (isInsideAppLayout) {
    return <>{children}</>;
  }

  return (
    <AppLayoutContext.Provider value>
      <div className="min-h-screen bg-background">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar (fixa abaixo do header) */}
        <div
          className={`fixed left-0 top-16 bottom-0 z-40 transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          <AppSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main */}
        <main className="pt-16 lg:pl-60 min-w-0">
          <PlatformSupportBanner />
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </AppLayoutContext.Provider>
  );
};
