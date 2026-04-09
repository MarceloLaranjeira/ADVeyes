import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useJarvis } from "@/contexts/JarvisContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useState } from "react";
import {
  IconDashboard, IconProcessos, IconClientes, IconLeads, IconEquipe,
  IconAgenda, IconTarefas, IconAudiencias, IconPublicacoes, IconBusca,
  IconJurisprudencia, IconFinanceiro, IconHoras, IconContratos,
  IconDocumentos, IconRelatorios, IconWhatsApp, IconPortalCliente,
  IconConfiguracoes, IconHorusIA, IconBell, IconShield, IconLogout,
} from "@/components/icons/AppIcons";

const navSections = [
  {
    label: "Principal",
    items: [
      { label: "Dashboard", icon: IconDashboard, path: "/" },
      { label: "Processos", icon: IconProcessos, path: "/processos" },
      { label: "Clientes", icon: IconClientes, path: "/clientes" },
    ],
  },
  {
    label: "CRM & Captação",
    items: [
      { label: "CRM — Leads", icon: IconLeads, path: "/crm" },
      { label: "Equipe", icon: IconEquipe, path: "/equipe" },
    ],
  },
  {
    label: "Rotina Jurídica",
    items: [
      { label: "Agenda", icon: IconAgenda, path: "/agenda" },
      { label: "Tarefas", icon: IconTarefas, path: "/tarefas" },
      { label: "Audiências", icon: IconAudiencias, path: "/audiencias" },
      { label: "Publicações", icon: IconPublicacoes, path: "/publicacoes" },
      { label: "DJE — TJAM", icon: IconPublicacoes, path: "/dje-tjam" },
    ],
  },
  {
    label: "Pesquisa",
    items: [
      { label: "Busca Processual", icon: IconBusca, path: "/busca" },
      { label: "Jurisprudência", icon: IconJurisprudencia, path: "/jurisprudencia" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Financeiro", icon: IconFinanceiro, path: "/financeiro" },
      { label: "Controle de Horas", icon: IconHoras, path: "/time-tracking" },
      { label: "Contratos & Templates", icon: IconContratos, path: "/contratos" },
      { label: "Documentos", icon: IconDocumentos, path: "/documentos" },
      { label: "Relatórios", icon: IconRelatorios, path: "/relatorios" },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { label: "WhatsApp", icon: IconWhatsApp, path: "/whatsapp" },
      { label: "Portal do Cliente", icon: IconPortalCliente, path: "/portal-cliente" },
      { label: "Configurações", icon: IconConfiguracoes, path: "/configuracoes" },
    ],
  },
];

export const AppSidebar = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { jarvisMode, toggleJarvis } = useJarvis();
  const { permission, subscribe } = usePushNotifications();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside className="h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <IconProcessos size={20} className="brightness-0 invert" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-widest uppercase" style={{ fontFamily: 'Georgia, serif' }}>ADVeyes</h1>
            <p className="text-[9px] text-muted-foreground tracking-widest uppercase">IA Jurídica Autônoma</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-muted text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
      </div>

      {/* Horus AI Button */}
      <div className="px-3 pt-3">
        <Link
          to="/ia-juridica"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            location.pathname === "/ia-juridica"
              ? "bg-primary text-white"
              : "bg-primary/8 text-primary hover:bg-primary/12 border border-primary/20"
          }`}
        >
          <IconHorusIA size={18} className="shrink-0" />
          <span className="flex-1">Horus — IA</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-2 pb-3 overflow-y-auto space-y-0.5">
        {navSections.map((section) => {
          const isCollapsed = collapsed[section.label];
          return (
            <div key={section.label}>
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-3 py-1.5 mt-1 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest hover:text-muted-foreground transition-colors"
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
                        onClick={onClose}
                      >
                        <item.icon size={18} className="shrink-0" />
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

      {/* APIs indicator */}
      <div className="mx-3 mb-3">
        <Link
          to="/busca"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <IconShield size={16} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground/60">APIs Ativas</p>
            <p className="text-[9px] text-muted-foreground">85+ Tribunais • SEEU • Projudi</p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        </Link>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        {permission !== "granted" && (
          <button
            onClick={subscribe}
            className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-primary/8 border border-primary/20 text-primary hover:bg-primary/12 transition-colors text-[10px] font-semibold"
          >
            <IconBell size={16} className="shrink-0" />
            Ativar notificações
          </button>
        )}
        {user && (
          <div className="px-3 mb-2">
            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <button onClick={signOut} className="nav-item w-full text-left hover:text-red-500">
          <IconLogout size={18} className="shrink-0" />
          Sair do Sistema
        </button>
        <div className="mt-3 px-3">
          {/* Jarvis Mode Toggle */}
        <button
          onClick={toggleJarvis}
          className={`w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-lg text-[10px] font-semibold transition-all duration-300 ${
            jarvisMode
              ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
              : "bg-muted/50 border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${jarvisMode ? "bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.8)]" : "bg-muted-foreground/40"}`} />
          {jarvisMode ? "MODO JARVIS ATIVO" : "Ativar Modo Jarvis"}
          <span className="ml-auto text-[8px] opacity-60">{jarvisMode ? "ON" : "OFF"}</span>
        </button>
        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">
            ADVeyes v1.0 · Horus IA
          </p>
        </div>
      </div>
    </aside>
  );
};
