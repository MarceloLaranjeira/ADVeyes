import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useJarvis } from "@/contexts/JarvisContext";
import {
  IconMovimentacao, IconAlerta, IconSistema, IconPublicacaoNotif, IconBell,
} from "@/components/icons/AppIcons";

interface Notif {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  created_at: string;
}

const tipoIcon: Record<string, React.ReactNode> = {
  movimentacao: <IconMovimentacao size={14} />,
  alerta: <IconAlerta size={14} />,
  sistema: <IconSistema size={14} />,
  publicacao: <IconPublicacaoNotif size={14} />,
  default: <IconSistema size={14} />,
};

const JARVIS_LINES = [
  "HORUS ONLINE · SISTEMAS ATIVOS",
  "MONITORANDO 85+ TRIBUNAIS",
  "IA JURÍDICA PRONTA",
  "VIGILÂNCIA CONTÍNUA ATIVA",
];

export const JarvisNotifications = () => {
  const { user } = useAuth();
  const { jarvisMode } = useJarvis();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [jarvisLine, setJarvisLine] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [toast, setToast] = useState<Notif | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rotate Jarvis status lines
  useEffect(() => {
    if (!jarvisMode) return;
    const t = setInterval(() => setJarvisLine((l) => (l + 1) % JARVIS_LINES.length), 3500);
    return () => clearInterval(t);
  }, [jarvisMode]);

  // Load initial notifications
  useEffect(() => {
    if (!user) return;
    supabase
      .from("notificacoes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setNotifs(data as Notif[]);
          setNewCount(data.filter((n: Notif) => !n.lida).length);
        }
      });
  }, [user]);

  // Real-time subscription — the magic
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("jarvis-notifs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const nova = payload.new as Notif;
          setNotifs((prev) => [nova, ...prev].slice(0, 20));
          setNewCount((c) => c + 1);
          // Show Jarvis toast
          setToast(nova);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 6000);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const marcarLidas = async () => {
    if (!user || newCount === 0) return;
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("user_id", user.id)
      .eq("lida", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
    setNewCount(0);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "agora";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString("pt-BR");
  };

  return (
    <>
      {/* ── Jarvis floating toast (bottom-right) ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] max-w-sm animate-fade-in ${
            jarvisMode
              ? "bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.25)]"
              : "bg-slate-900/95 border border-slate-700 shadow-xl"
          } rounded-xl backdrop-blur-md`}
        >
          <div className="flex items-start gap-3 p-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${jarvisMode ? "bg-cyan-500/15 border border-cyan-500/30" : "bg-primary/20"}`}>
              {tipoIcon[toast.tipo] || tipoIcon.default}
            </div>
            <div className="flex-1 min-w-0">
              {jarvisMode && (
                <p className="text-[9px] font-bold tracking-widest text-cyan-500/70 uppercase mb-0.5">
                  HORUS · {toast.tipo.toUpperCase()}
                </p>
              )}
              <p className={`text-sm font-semibold leading-tight ${jarvisMode ? "text-cyan-100" : "text-white"}`}>
                {toast.titulo}
              </p>
              <p className={`text-xs mt-0.5 leading-relaxed ${jarvisMode ? "text-cyan-300/70" : "text-slate-300"}`}>
                {toast.mensagem}
              </p>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-500 hover:text-white shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {jarvisMode && (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse" />
          )}
        </div>
      )}

      {/* ── Bell button ── */}
      <div className="relative">
        <button
          onClick={() => { setOpen((o) => !o); if (!open) marcarLidas(); }}
          className={`relative p-2 rounded-lg transition-all ${
            jarvisMode
              ? "hover:bg-cyan-500/10 text-cyan-400/70 hover:text-cyan-300"
              : "hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <IconBell size={18} />
          {newCount > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
              jarvisMode ? "bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "bg-primary text-white"
            }`}>
              {newCount > 9 ? "9+" : newCount}
            </span>
          )}
        </button>

        {/* ── Dropdown panel ── */}
        {open && (
          <div className={`absolute right-0 top-full mt-2 w-80 z-50 rounded-xl overflow-hidden shadow-2xl ${
            jarvisMode
              ? "bg-slate-950/98 border border-cyan-500/25 shadow-[0_0_40px_rgba(6,182,212,0.12)]"
              : "bg-card border border-border"
          }`}>
            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between ${jarvisMode ? "border-b border-cyan-500/15" : "border-b border-border"}`}>
              {jarvisMode ? (
                <div>
                  <p className="text-[9px] tracking-widest text-cyan-500/60 font-bold uppercase">HORUS · CENTRAL DE ALERTAS</p>
                  <p className="text-xs font-semibold text-cyan-100 mt-0.5 animate-pulse">{JARVIS_LINES[jarvisLine]}</p>
                </div>
              ) : (
                <p className="text-sm font-semibold">Notificações</p>
              )}
              <button onClick={() => setOpen(false)} className={`p-1 rounded hover:bg-muted ${jarvisMode ? "text-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-400" : "text-muted-foreground"}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Notifications list */}
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className={`w-8 h-8 mx-auto mb-2 ${jarvisMode ? "text-cyan-500/30" : "text-muted-foreground/30"}`} />
                  <p className={`text-xs ${jarvisMode ? "text-cyan-500/50" : "text-muted-foreground"}`}>
                    {jarvisMode ? "SISTEMAS EM STANDBY" : "Nenhuma notificação"}
                  </p>
                </div>
              ) : (
                notifs.map((n) => (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 transition-colors ${
                      jarvisMode
                        ? `border-b border-cyan-500/8 ${!n.lida ? "bg-cyan-500/5" : "hover:bg-cyan-500/5"}`
                        : `border-b border-border ${!n.lida ? "bg-primary/5" : "hover:bg-muted/50"}`
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {tipoIcon[n.tipo] || tipoIcon.default}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${jarvisMode ? "text-cyan-100" : "text-foreground"}`}>
                          {n.titulo}
                        </p>
                        <span className={`text-[10px] shrink-0 ${jarvisMode ? "text-cyan-500/50" : "text-muted-foreground"}`}>
                          {formatTime(n.created_at)}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 leading-relaxed ${jarvisMode ? "text-cyan-300/60" : "text-muted-foreground"}`}>
                        {n.mensagem}
                      </p>
                    </div>
                    {!n.lida && (
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${jarvisMode ? "bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" : "bg-primary"}`} />
                    )}
                  </div>
                ))
              )}
            </div>

            {jarvisMode && (
              <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
            )}
          </div>
        )}
      </div>
    </>
  );
};
