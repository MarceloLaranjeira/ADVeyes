import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Scale, Users, CalendarDays, FileText,
  Search, Gavel, BookOpen, DollarSign, LogOut, Bell, ListTodo,
  Bot, BarChart3, UserCircle, Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Processos", icon: Scale, path: "/processos" },
  { label: "Clientes", icon: Users, path: "/clientes" },
  { label: "Agenda", icon: CalendarDays, path: "/agenda" },
  { label: "Tarefas", icon: ListTodo, path: "/tarefas" },
  { label: "Audiências", icon: Gavel, path: "/audiencias" },
  { label: "Publicações", icon: Bell, path: "/publicacoes" },
  { label: "Busca Processual", icon: Search, path: "/busca" },
  { label: "Jurisprudência", icon: BookOpen, path: "/jurisprudencia" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro" },
  { label: "Documentos", icon: FileText, path: "/documentos" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { label: "Portal do Cliente", icon: UserCircle, path: "/portal-cliente" },
  { label: "Configurações", icon: Settings, path: "/configuracoes" },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-sidebar flex flex-col border-r border-sidebar-border z-50">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4 text-sidebar-primary" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-sidebar-primary font-serif tracking-widest uppercase leading-tight">
              ALBERTINO
            </h1>
            <p className="text-[8px] text-sidebar-foreground/35 tracking-widest uppercase">
              Advogados Associados
            </p>
          </div>
        </div>
      </div>

      {/* HORUS Button */}
      <div className="px-3 pt-3">
        <Link
          to="/ia-juridica"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            location.pathname === "/ia-juridica"
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20 border border-sidebar-primary/20"
          }`}
        >
          <div className="relative shrink-0">
            <Bot className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400" />
          </div>
          <span>HORUS — IA</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-2 pb-2 overflow-y-auto space-y-0.5">
        {navItems.map((item) => {
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
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        {user && (
          <p className="text-[9px] text-sidebar-foreground/35 truncate px-2 mb-1.5">{user.email}</p>
        )}
        <button onClick={signOut} className="nav-item w-full text-left hover:text-red-400">
          <LogOut className="w-4 h-4 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  );
};
