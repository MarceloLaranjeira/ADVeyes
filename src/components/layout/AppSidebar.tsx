import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useJarvis } from "@/contexts/JarvisContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
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

  return (
    <aside className="h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border text-sidebar-foreground">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[hsl(var(--gold))] flex items-center justify-center shrink-0">
            <span className="text-[hsl(var(--navy))] font-bold text-lg leading-none font-serif">A</span>
          </div>
          <div className="leading-tight">
            <h1 className="text-[15px] font-semibold text-white tracking-tight font-serif">ADVeyes</h1>
            <p className="text-[10px] text-sidebar-foreground/60 tracking-wide">Gestão Jurídica</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
      </div>

      {/* Horus AI — destaque */}
      <div className="px-3 pb-2">
        <Link
          to="/ia-juridica"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
            location.pathname === "/ia-juridica"
              ? "bg-[hsl(var(--gold))] text-[hsl(var(--navy))]"
              : "text-white/90 hover:bg-sidebar-accent"
          }`}
        >
          <IconHorusIA size={18} className="shrink-0" />
          <span className="flex-1">Horus IA</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        </Link>
      </div>

      {/* Navigation — fluxo único, sem divisórias, agrupamento por espaçamento */}
      <nav className="flex-1 px-3 pt-1 pb-3 overflow-y-auto">
        {navSections.map((section, idx) => (
          <div key={section.label} className={idx === 0 ? "" : "mt-4"}>
            <p className="px-3 mb-1.5 text-[10px] font-medium text-sidebar-foreground/40 tracking-wider uppercase">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                    onClick={onClose}
                  >
                    <item.icon size={17} className="shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3">
        {permission !== "granted" && (
          <button
            onClick={subscribe}
            className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-md text-sidebar-foreground/80 hover:text-white hover:bg-sidebar-accent transition-colors text-xs font-medium"
          >
            <IconBell size={15} className="shrink-0" />
            Ativar notificações
          </button>
        )}
        <Link
          to="/busca"
          className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent transition-colors text-xs"
        >
          <IconShield size={15} className="shrink-0 text-[hsl(var(--gold))]" />
          <span className="flex-1 truncate">85+ tribunais ativos</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        </Link>
        {user && (
          <div className="px-3 py-2 mb-1 border-t border-sidebar-border/60">
            <p className="text-[11px] text-sidebar-foreground/60 truncate mt-2">{user.email}</p>
          </div>
        )}
        <button onClick={signOut} className="nav-item w-full text-left hover:text-red-400">
          <IconLogout size={17} className="shrink-0" />
          Sair
        </button>
        <button
          onClick={toggleJarvis}
          className={`w-full flex items-center gap-2 px-3 py-1.5 mt-2 rounded-md text-[10px] font-medium transition-colors ${
            jarvisMode
              ? "text-cyan-400 hover:bg-cyan-500/10"
              : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${jarvisMode ? "bg-cyan-400 animate-pulse" : "bg-sidebar-foreground/30"}`} />
          Modo Jarvis
          <span className="ml-auto text-[9px] opacity-60">{jarvisMode ? "ON" : "OFF"}</span>
        </button>
      </div>
    </aside>
  );
};
