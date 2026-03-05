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
  Settings,
  DollarSign,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Processos", icon: Scale, path: "/processos" },
  { label: "Clientes", icon: Users, path: "/clientes" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro" },
  { label: "Agenda", icon: CalendarDays, path: "/agenda" },
  { label: "Documentos", icon: FileText, path: "/documentos" },
  { label: "Busca Processual", icon: Search, path: "/busca" },
  { label: "Jurisprudência", icon: BookOpen, path: "/jurisprudencia" },
  { label: "Audiências", icon: Gavel, path: "/audiencias" },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();

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
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
            Sistema Jurídico v1.0
          </p>
        </div>
      </div>
    </aside>
  );
};
