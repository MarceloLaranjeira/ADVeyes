/**
 * PAINEL DE NOTIFICAÇÕES DO HORUS
 *
 * Exibe notificações em tempo real no header do ADVeyes.
 * Todas as notificações são assinadas com 🦅 Horus.
 */

import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { NotificacaoHorus } from "@/services/horus/types";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificacoesRealtime } from "@/hooks/useNotificacoesRealtime";

export const NotificationPanel = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificacaoHorus[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  // Carregar notificações do localStorage
  useEffect(() => {
    loadNotifications();
  }, []);

  // Receber novas notificações via Supabase Realtime
  const handleNova = useCallback((n: NotificacaoHorus) => {
    setNotifications(prev => {
      if (prev.some(p => p.id === n.id)) return prev;
      const updated = [n, ...prev];
      localStorage.setItem("adveyes_notifications", JSON.stringify(updated));
      return updated;
    });
    setUnreadCount(c => c + 1);
  }, []);

  useNotificacoesRealtime(user?.id, handleNova);

  const loadNotifications = () => {
    try {
      const stored = localStorage.getItem("adveyes_notifications");
      if (stored) {
        const loaded: NotificacaoHorus[] = JSON.parse(stored);
        setNotifications(loaded);
        setUnreadCount(loaded.filter(n => !n.lida).length);
      }
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    }
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map(n =>
      n.id === id ? { ...n, lida: true } : n
    );
    setNotifications(updated);
    localStorage.setItem("adveyes_notifications", JSON.stringify(updated));
    setUnreadCount(updated.filter(n => !n.lida).length);
  };

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, lida: true }));
    setNotifications(updated);
    localStorage.setItem("adveyes_notifications", JSON.stringify(updated));
    setUnreadCount(0);
  };

  const clearNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem("adveyes_notifications", JSON.stringify(updated));
    setUnreadCount(updated.filter(n => !n.lida).length);
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
        return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900";
      case "ALTA":
        return "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900";
      case "MEDIA":
        return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900";
      default:
        return "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-900";
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
              {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo em dia"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-7"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>

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
                  onClick={() => !notif.lida && markAsRead(notif.id)}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNotification(notif.id);
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
