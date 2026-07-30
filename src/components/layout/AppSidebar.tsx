import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Users, KanbanSquare, Calendar,
  CheckSquare, Gavel, Newspaper, Search, BookOpen, Wallet,
  Clock, FileSignature, FolderOpen, BarChart3, MessageSquare,
  ExternalLink, Settings, Sparkles, Headphones, UserCog,
  type LucideIcon,
} from "lucide-react";

const sections: Array<{
  label?: string;
  items: Array<{
    label: string;
    icon: LucideIcon;
    path: string;
    badge?: number;
    isNew?: boolean;
    ai?: boolean;
  }>;
}> = [
  {
    items: [
      { label: "Área de trabalho", icon: LayoutDashboard, path: "/" },
      { label: "Processos e casos", icon: Briefcase, path: "/processos" },
      { label: "Contatos", icon: Users, path: "/clientes" },
      { label: "CRM — Leads", icon: KanbanSquare, path: "/crm" },
      { label: "Atendimentos", icon: Headphones, path: "/audiencias" },
    ],
  },
  {
    label: "Rotina jurídica",
    items: [
      { label: "Agenda", icon: Calendar, path: "/agenda" },
      { label: "Tarefas", icon: CheckSquare, path: "/tarefas" },
      { label: "Audiências", icon: Gavel, path: "/audiencias" },
      { label: "Publicações", icon: Newspaper, path: "/publicacoes" },
    ],
  },
  {
    label: "Pesquisa",
    items: [
      { label: "Busca processual", icon: Search, path: "/busca" },
      { label: "Jurisprudência", icon: BookOpen, path: "/jurisprudencia" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Financeiro", icon: Wallet, path: "/financeiro" },
      { label: "Controle de horas", icon: Clock, path: "/time-tracking" },
      { label: "Gestão de equipe", icon: UserCog, path: "/equipe" },
      { label: "Contratos", icon: FileSignature, path: "/contratos" },
      { label: "Documentos", icon: FolderOpen, path: "/documentos" },
      { label: "Indicadores", icon: BarChart3, path: "/relatorios" },
    ],
  },
  {
    label: "IA & Ferramentas",
    items: [
      { label: "Criação de peças", icon: Sparkles, path: "/ia-juridica", ai: true },
      { label: "WhatsApp", icon: MessageSquare, path: "/whatsapp" },
      { label: "Portal do cliente", icon: ExternalLink, path: "/portal-cliente" },
      { label: "Configurações", icon: Settings, path: "/configuracoes" },
    ],
  },
];

export const AppSidebar = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();

  return (
    <aside className="h-full w-60 bg-white border-r border-border flex flex-col">
      <nav className="flex-1 overflow-y-auto py-5 pr-2 pl-3">
        {sections.map((section, idx) => (
          <div key={idx} className={idx === 0 ? "" : "mt-5"}>
            {section.label && (
              <p className="px-3 mb-1.5 text-[10px] font-bold text-muted-foreground/70 tracking-widest uppercase">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-secondary text-foreground font-bold"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground font-medium"
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2.25 : 2} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="bg-destructive text-white text-[10px] font-bold px-1.5 py-px rounded">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: status tribunais */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60">
          <span className="w-2 h-2 rounded-full bg-[hsl(var(--success))] animate-pulse" />
          <span className="text-xs text-muted-foreground flex-1 truncate font-medium">85+ tribunais ativos</span>
        </div>
      </div>
    </aside>
  );
};
