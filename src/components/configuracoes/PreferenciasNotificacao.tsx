import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Loader2 } from "lucide-react";

type EventType =
  | "publication_new"
  | "movement_new"
  | "deadline_near"
  | "hearing_near";

interface Preference {
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

const EVENTS: Array<{ type: EventType; label: string; description: string }> = [
  {
    type: "publication_new",
    label: "Novas publicações",
    description: "Intimações oficiais do DJEN vinculadas à sua OAB.",
  },
  {
    type: "movement_new",
    label: "Movimentações processuais",
    description: "Andamentos novos nos processos monitorados.",
  },
  {
    type: "deadline_near",
    label: "Prazos próximos",
    description: "Aviso antes do vencimento de um prazo confirmado.",
  },
  {
    type: "hearing_near",
    label: "Audiências próximas",
    description: "Lembrete das audiências agendadas.",
  },
];

const defaultPreference: Preference = { emailEnabled: true, inAppEnabled: true };

export function PreferenciasNotificacao() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<Record<string, Preference>>({});
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant || !user) return;
    setLoading(true);

    const { data, error } = await (supabase as never as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => Promise<{
              data: Array<{
                event_type: string;
                email_enabled: boolean;
                in_app_enabled: boolean;
              }> | null;
              error: unknown;
            }>;
          };
        };
      };
    })
      .from("notification_preferences")
      .select("event_type, email_enabled, in_app_enabled")
      .eq("tenant_id", currentTenant.tenantId)
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Não foi possível carregar as preferências",
        variant: "destructive",
      });
    } else {
      const loaded: Record<string, Preference> = {};
      for (const row of data ?? []) {
        loaded[row.event_type] = {
          emailEnabled: row.email_enabled,
          inAppEnabled: row.in_app_enabled,
        };
      }
      setPreferences(loaded);
    }
    setLoading(false);
  }, [currentTenant, toast, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (
    type: EventType,
    channel: "email" | "inApp",
    enabled: boolean,
  ) => {
    if (!currentTenant || !user) return;
    const current = preferences[type] ?? defaultPreference;
    const next: Preference = {
      emailEnabled: channel === "email" ? enabled : current.emailEnabled,
      inAppEnabled: channel === "inApp" ? enabled : current.inAppEnabled,
    };

    // Reflete na hora e desfaz se o banco recusar, para o interruptor nunca
    // mostrar um estado que não foi salvo.
    setPreferences((state) => ({ ...state, [type]: next }));
    setSavingType(type);

    const { error } = await (supabase as never as {
      from: (table: string) => {
        upsert: (
          values: Record<string, unknown>,
          options: { onConflict: string },
        ) => Promise<{ error: unknown }>;
      };
    })
      .from("notification_preferences")
      .upsert({
        tenant_id: currentTenant.tenantId,
        user_id: user.id,
        event_type: type,
        email_enabled: next.emailEnabled,
        in_app_enabled: next.inAppEnabled,
      }, { onConflict: "tenant_id,user_id,event_type" });

    setSavingType(null);

    if (error) {
      setPreferences((state) => ({ ...state, [type]: current }));
      toast({
        title: "Não foi possível salvar a preferência",
        variant: "destructive",
      });
    }
  };

  if (!currentTenant || !user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" />
          Notificações
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Os avisos vão para o profissional dono da OAB vinculada ao processo.
          Cada pessoa controla os próprios canais.
        </p>
      </CardHeader>
      <CardContent>
        <div className="hidden gap-4 pb-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_80px_80px]">
          <span>Evento</span>
          <span className="text-center">No sistema</span>
          <span className="text-center">E-mail</span>
        </div>
        <div className="divide-y">
          {EVENTS.map((event) => {
            const preference = preferences[event.type] ?? defaultPreference;
            return (
              <div
                key={event.type}
                className="grid gap-3 py-3 sm:grid-cols-[1fr_80px_80px] sm:items-center"
              >
                <div>
                  <Label className="text-sm font-medium">{event.label}</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:justify-center">
                  <span className="text-xs text-muted-foreground sm:hidden">
                    No sistema
                  </span>
                  <Switch
                    checked={preference.inAppEnabled}
                    disabled={loading || savingType === event.type}
                    aria-label={`${event.label} no sistema`}
                    onCheckedChange={(checked) =>
                      void update(event.type, "inApp", checked)}
                  />
                </div>
                <div className="flex items-center gap-2 sm:justify-center">
                  <span className="text-xs text-muted-foreground sm:hidden">
                    E-mail
                  </span>
                  {savingType === event.type
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : (
                      <Switch
                        checked={preference.emailEnabled}
                        disabled={loading}
                        aria-label={`${event.label} por e-mail`}
                        onCheckedChange={(checked) =>
                          void update(event.type, "email", checked)}
                      />
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
