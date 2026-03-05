import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Scale,
  Users,
  CalendarDays,
  FileText,
  Search,
  Gavel,
  BookOpen,
  DollarSign,
  LogOut,
  Bell,
  ListTodo,
  Bot,
  BarChart3,
  UserCircle,
  Settings,
  ChevronDown,
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
      { label: "IA Jurídica", icon: Bot, path: "/ia-juridica" },
      { label: "Portal do Cliente", icon: UserCircle, path: "/portal-cliente" },
      { label: "Configurações", icon: Settings, path: "/configuracoes" },
    ],
  },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border z-50">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Scale className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary font-serif tracking-wide">
              ALBERTINO
            </h1>
            <p className="text-[10px] text-sidebar-foreground/60 tracking-widest uppercase">
              Advogados Associados
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-1">
        {navSections.map((section) => {
          const isCollapsed = collapsed[section.label];
          const hasActiveItem = section.items.some((item) => location.pathname === item.path);

          return (
            <div key={section.label}>
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest hover:text-sidebar-foreground/60 transition-colors"
              >
                {section.label}
                <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5 mb-2">
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

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        {user && (
          <div className="px-3 mb-3">
            <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
          </div>
        )}
        <button onClick={signOut} className="nav-item w-full text-left">
          <LogOut className="w-4 h-4 shrink-0" />
          Sair
        </button>
        <div className="mt-4 px-3">
          <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-wider">
            Sistema Jurídico v2.0
          </p>
        </div>
      </div>
    </aside>
  );
};
