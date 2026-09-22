/**
 * PAINEL DE NOTIFICAÇÕES DO HORUS
 *
 * Exibe as notificações do advogado no header do ADVeyes.
 *
 * A tabela `notificacoes` é a fonte da verdade: o painel carrega o histórico
 * ao abrir e o realtime acrescenta o que chega depois. Antes o estado vivia em
 * `localStorage` — o que significava que notificação gerada com a aba fechada
 * nunca era vista, trocar de máquina zerava a caixa e "marcar como lida" não
 * saía do dispositivo.
 *
 * Todas as notificações são assinadas com 🦅 Horus.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Bell, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Notificacao } from "@/types/notificacoes";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  useNotificacoesRealtime,
  type NotificacaoRealtimeEvent,
} from "@/hooks/useNotificacoesRealtime";
import { notificationsService } from "@/services/notifications";
import {
  aplicarAtualizacaoNotificacao,
  contarNaoLidas,
  mergeNotificacao,
  reconciliarNotificacoes,
} from "@/lib/notificacoes";

export const NotificationPanel = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState(false);
  const [realtimeReadyVersion, setRealtimeReadyVersion] = useState(0);

  const userId = user?.id;
  const tenantId = currentTenant?.tenantId ?? null;
  const scopeKey = `${userId ?? "anon"}:${tenantId ?? "legacy"}`;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const unreadCount = contarNaoLidas(notifications);

  const handleRealtime = useCallback((event: NotificacaoRealtimeEvent) => {
    setNotifications((prev) =>
      event.kind === "insert"
        ? mergeNotificacao(prev, event.notification)
        : aplicarAtualizacaoNotificacao(
          prev,
          event.notification,
          event.archived,
        )
    );
  }, []);

  const handleRealtimeReady = useCallback(() => {
    setRealtimeReadyVersion((version) => version + 1);
  }, []);

  // A inscrição é registrada antes dos efeitos de carga. Quando o canal fica
  // SUBSCRIBED, uma segunda carga de catch-up fecha qualquer intervalo entre o
  // snapshot inicial e a assinatura estar pronta.
  useNotificacoesRealtime(
    userId,
    tenantId,
    handleRealtime,
    handleRealtimeReady,
  );

  const carregar = useCallback(async (loadedWins = false) => {
    if (!userId) return;
    const requestedScope = scopeKey;
    try {
      const items = await notificationsService.list(userId, tenantId);
      // Uma resposta do tenant anterior nunca pode repovoar a caixa depois de
      // o usuário trocar de escritório.
      if (scopeRef.current !== requestedScope) return;
      setNotifications((current) =>
        reconciliarNotificacoes(current, items, loadedWins)
      );
      setErro(false);
    } catch {
      if (scopeRef.current === requestedScope) setErro(true);
    }
  }, [scopeKey, tenantId, userId]);

  // Troca de usuário/tenant limpa primeiro; a carga sempre MESCLA com eventos
  // que possam chegar enquanto a requisição está pendente.
  useEffect(() => {
    setNotifications([]);
    setErro(false);
    if (userId) void carregar();
  }, [scopeKey, userId, carregar]);

  // Catch-up após o canal confirmar SUBSCRIBED. Não limpa a lista: eventos que
  // já chegaram vencem o snapshot do banco para o mesmo id.
  useEffect(() => {
    if (realtimeReadyVersion > 0 && userId) void carregar();
  }, [realtimeReadyVersion, userId, carregar]);

  /**
   * Atualiza a tela primeiro e persiste depois. Se o banco recusar, recarrega
   * somente o escopo atual — restaurar um snapshot inteiro apagaria eventos
   * realtime ou ações concorrentes que chegaram enquanto a chamada pendia.
   */
  const markAsRead = async (id: string) => {
    if (!userId) return;
    setNotifications((prev) =>
      prev.map((item) => item.id === id ? { ...item, lida: true } : item)
    );
    try {
      await notificationsService.marcarLida(id, userId, tenantId);
    } catch {
      await carregar(true);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((item) => ({ ...item, lida: true })));
    try {
      await notificationsService.marcarTodasLidas(userId, tenantId);
    } catch {
      await carregar(true);
    }
  };

  /** Arquiva: some da caixa, permanece no banco para auditoria. */
  const clearNotification = async (id: string) => {
    if (!userId) return;
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    try {
      await notificationsService.arquivar(id, userId, tenantId);
    } catch {
      await carregar(true);
    }
  };

  const getUrgencyIcon = (urgencia: string) => {
    switch (urgencia) {
      case "CRITICA":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "ALTA":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "MEDIA":
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getUrgencyColor = (urgencia: string) => {
    switch (urgencia) {
      case "CRITICA":
        return "bg-red-50 border-red-200";
      case "ALTA":
        return "bg-orange-50 border-orange-200";
      case "MEDIA":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-2 border-background"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-sm">Notificações do Horus</h3>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}`
                : "Tudo em dia"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void markAllAsRead()}
              className="text-xs h-7"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {erro && (
          <p className="border-b bg-amber-500/5 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            Não foi possível carregar o histórico agora. As novas notificações
            continuam chegando.
          </p>
        )}

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="w-12 h-12 text-muted-foreground opacity-30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma notificação
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                🦅 Horus te avisará sobre novas movimentações
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 transition-colors ${
                    !notif.lida
                      ? getUrgencyColor(notif.urgencia) + " border-l-4"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    if (!notif.lida) void markAsRead(notif.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getUrgencyIcon(notif.urgencia)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium line-clamp-1">
                          {notif.titulo}
                        </h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          aria-label="Arquivar notificação"
                          onClick={(e) => {
                            e.stopPropagation();
                            void clearNotification(notif.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                        {notif.mensagem}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(notif.dataNotificacao).toLocaleString("pt-BR")}
                        </span>
                        {notif.acao && (
                          <Button
                            variant="link"
                            size="sm"
                            className="text-xs h-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = notif.acao!.url;
                            }}
                          >
                            {notif.acao.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
