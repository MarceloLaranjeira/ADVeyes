import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Scale, Users, CalendarDays, FileText,
  Search, Gavel, BookOpen, DollarSign, LogOut, Bell, ListTodo,
  Bot, BarChart3, UserCircle, Settings, ChevronDown, Zap, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

const navSections = [
  {
    label: "Principal",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/" },
      { label: "Processos", icon: Scale, path: "/processos" },
      { label: "Clientes", icon: Users, path: "/clientes" },
    ],
  },
  {
    label: "Rotina Jurídica",
    items: [
      { label: "Agenda", icon: CalendarDays, path: "/agenda" },
      { label: "Tarefas", icon: ListTodo, path: "/tarefas" },
      { label: "Audiências", icon: Gavel, path: "/audiencias" },
      { label: "Publicações", icon: Bell, path: "/publicacoes" },
    ],
  },
  {
    label: "Pesquisa",
    items: [
      { label: "Busca Processual", icon: Search, path: "/busca" },
      { label: "Jurisprudência", icon: BookOpen, path: "/jurisprudencia" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Financeiro", icon: DollarSign, path: "/financeiro" },
      { label: "Documentos", icon: FileText, path: "/documentos" },
      { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { label: "Portal do Cliente", icon: UserCircle, path: "/portal-cliente" },
      { label: "Configurações", icon: Settings, path: "/configuracoes" },
    ],
  },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border z-50">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-sidebar-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary font-serif tracking-widest uppercase">
              ALBERTINO
            </h1>
            <p className="text-[9px] text-sidebar-foreground/40 tracking-widest uppercase">
              Advogados Associados
            </p>
          </div>
        </div>
      </div>

      {/* JARVIS AI Button — Destaque */}
      <div className="px-3 pt-3">
        <Link
          to="/ia-juridica"
          className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
            location.pathname === "/ia-juridica"
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
              : "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20 border border-sidebar-primary/20"
          }`}
        >
          <div className="relative">
            <Bot className="w-4 h-4 shrink-0" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-sidebar-background" />
          </div>
          <span className="flex-1">JARVIS — IA</span>
          <Zap className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-3 pb-3 overflow-y-auto space-y-0.5">
        {navSections.map((section) => {
          const isCollapsed = collapsed[section.label];
          return (
            <div key={section.label}>
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-3 py-1.5 mt-1 text-[9px] font-bold text-sidebar-foreground/35 uppercase tracking-widest hover:text-sidebar-foreground/55 transition-colors"
              >
                {section.label}
                <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5 mb-1">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Tribunal APIs indicator */}
      <div className="mx-3 mb-3">
        <Link
          to="/busca"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent/60 border border-sidebar-border hover:bg-sidebar-accent transition-colors"
        >
          <Shield className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-sidebar-foreground/70">APIs Ativas</p>
            <p className="text-[9px] text-sidebar-foreground/40">85+ Tribunais • SEEU • Projudi</p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
        </Link>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        {user && (
          <div className="px-3 mb-2">
            <p className="text-[10px] text-sidebar-foreground/40 truncate">{user.email}</p>
          </div>
        )}
        <button onClick={signOut} className="nav-item w-full text-left hover:text-red-400">
          <LogOut className="w-4 h-4 shrink-0" />
          Sair do Sistema
        </button>
        <div className="mt-3 px-3">
          <p className="text-[9px] text-sidebar-foreground/25 uppercase tracking-wider">
            Sistema Jurídico v3.0 · JARVIS
          </p>
        </div>
      </div>
    </aside>
  );
};
