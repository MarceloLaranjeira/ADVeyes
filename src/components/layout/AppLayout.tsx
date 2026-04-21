import { ReactNode, useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { useJarvis } from "@/contexts/JarvisContext";
import { Menu } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { jarvisMode } = useJarvis();

  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className={`flex min-h-screen bg-background transition-colors duration-500 ${jarvisMode ? "jarvis-layout" : ""}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen z-50 transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-w-0">
        {/* Mobile topbar */}
        <div className={`sticky top-0 z-30 flex items-center gap-3 px-4 py-3 backdrop-blur border-b lg:hidden ${
          jarvisMode
            ? "bg-slate-950/95 border-cyan-500/20"
            : "bg-background/95 border-border"
        }`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className={`p-2 rounded-lg transition-colors ${jarvisMode ? "hover:bg-cyan-500/10 text-cyan-400" : "hover:bg-muted"}`}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className={`font-serif font-semibold tracking-tight text-base flex-1 ${
            jarvisMode ? "text-cyan-400" : "text-primary"
          }`}>
            ADVeyes
          </span>
          {/* 🦅 Horus real-time notifications */}
          <NotificationPanel />
        </div>

        {/* Desktop topbar — notifications always visible */}
        <div className={`hidden lg:flex items-center justify-end px-8 py-3 border-b sticky top-0 z-30 backdrop-blur ${
          jarvisMode
            ? "bg-slate-950/90 border-cyan-500/15"
            : "bg-background/90 border-border/50"
        }`}>
          {jarvisMode && (
            <div className="flex items-center gap-2 mr-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
              <span className="text-[10px] tracking-widest text-cyan-500/60 font-bold uppercase">
                Horus online · monitoramento ativo
              </span>
            </div>
          )}
          <NotificationPanel />
        </div>

        {/* Page content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
