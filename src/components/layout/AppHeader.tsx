import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, Plus, ChevronDown, Bell, LogOut, User as UserIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { LogoFull } from "@/components/common/Logo";
import { EnvironmentSwitcher } from "@/components/layout/EnvironmentSwitcher";

/**
 * Topbar global no estilo Astrea.
 * - 64px, fundo branco, sombra suave.
 * - Logo · Busca global · Ações · Avatar · CTA.
 */
export const AppHeader = ({ onMenuClick }: { onMenuClick?: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const initial = (user?.email || "A").charAt(0).toUpperCase();

  return (
    <header
      className="fixed top-0 inset-x-0 z-40 h-16 bg-white border-b border-border flex items-center pr-4 lg:pr-6 gap-4"
      style={{ boxShadow: "rgba(0,0,0,0.06) 0px 0px 12px 0px" }}
    >
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="lg:hidden ml-4 p-2 rounded-md hover:bg-secondary text-muted-foreground"
        aria-label="Abrir menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {/*
        A marca ocupa um bloco cheio da largura da régua (w-60), encostado na
        borda: antes era uma logo de 28px solta sobre o branco, com o canto
        superior esquerdo partido entre header claro e régua navy. Agora as
        duas superfícies navy se encontram e a marca fica dentro dela.
      */}
      <Link
        to="/"
        className="hidden lg:flex h-16 w-60 shrink-0 items-center justify-start bg-sidebar px-5 py-2"
      >
        {/*
          A área da marca dá a altura; a logo se ajusta dentro dela. Assim uma
          logo vertical ou de várias linhas encolhe pela largura em vez de ser
          cortada pela altura fixa que existia aqui antes.
        */}
        <LogoFull size="lg" dark className="max-h-12" />
      </Link>

      {/* No mobile a régua some, então a marca volta a ser um item comum. */}
      <Link to="/" className="flex lg:hidden items-center shrink-0">
        <LogoFull size="sm" className="max-w-[140px]" />
      </Link>

      <EnvironmentSwitcher
        mode={location.pathname === "/admin" ? "platform" : "tenant"}
        className="hidden xl:inline-flex min-w-[220px] ml-1"
      />

      {/* Busca global */}
      <div className="flex-1 max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar contato, processo ou tarefa"
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg bg-secondary border border-transparent focus:bg-white focus:border-primary focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Adicionar"
              title="Adicionar"
            >
              <Plus className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Adicionar novo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/processos")}>Processo</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/clientes")}>Contato / Cliente</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/tarefas")}>Tarefa</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/agenda")}>Evento</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/audiencias")}>Audiência</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notificações reaproveitadas */}
        <div className="hidden sm:block">
          <NotificationPanel />
        </div>

        {/* Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-secondary transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                {initial}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user?.email || "Conta"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
              <UserIcon className="w-4 h-4 mr-2" /> Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/checkout")}>
              <Bell className="w-4 h-4 mr-2" /> Plano de uso
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* CTA */}
        <button
          onClick={() => navigate("/checkout")}
          className="ga-button-success ml-2 hidden lg:inline-flex"
        >
          Contratar
        </button>
      </div>
    </header>
  );
};
