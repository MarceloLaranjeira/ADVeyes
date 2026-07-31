import { supabase } from "@/integrations/supabase/client";

export type GoogleCalendarConnectionStatus =
  | "connected"
  | "reconnect_required"
  | "disconnecting"
  | "error";

export interface GoogleCalendarStatus {
  connected: boolean;
  connection: {
    google_email: string | null;
    status: GoogleCalendarConnectionStatus;
    connected_at: string;
    last_sync_at: string | null;
    last_error_code: string | null;
    last_error_at: string | null;
  } | null;
  queue: {
    pending: number;
    processing: number;
    retry: number;
    failed: number;
  };
}

interface LegacyGoogleEventInput {
  titulo: string;
  descricao?: string;
  data_inicio: string;
  local?: string;
  colorId?: string;
  allDay?: boolean;
}

const STATUS_CACHE_KEY = "adveyes_google_calendar_status";
let syncTimer: ReturnType<typeof setTimeout> | null = null;

async function invoke<T>(
  action: "status" | "connect" | "sync" | "disconnect",
  extra: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("google-calendar", {
    body: { action, ...extra },
  });
  if (error) throw error;
  return data as T;
}

function cacheStatus(connected: boolean) {
  sessionStorage.setItem(STATUS_CACHE_KEY, connected ? "connected" : "disconnected");
}

export const googleCalendar = {
  async getStatus(): Promise<GoogleCalendarStatus> {
    const status = await invoke<GoogleCalendarStatus>("status");
    cacheStatus(status.connected && status.connection?.status === "connected");
    return status;
  },

  isConnected(): boolean {
    return sessionStorage.getItem(STATUS_CACHE_KEY) === "connected";
  },

  async connect(returnUrl = `${window.location.origin}/configuracoes`): Promise<void> {
    const result = await invoke<{ authorizationUrl: string }>("connect", { returnUrl });
    window.location.assign(result.authorizationUrl);
  },

  async syncNow(): Promise<{
    queued: number;
    claimed: number;
    completed: number;
    retried: number;
    failed: number;
  }> {
    return invoke("sync");
  },

  requestSync(delayMs = 750): void {
    if (!this.isConnected()) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      void this.syncNow().catch(() => {
        // O worker agendado repetirá a operação; a UI mostra o erro no status.
      });
    }, delayMs);
  },

  async disconnect(removeEvents = false): Promise<{
    removedFromGoogle: number;
    failedRemovals: number;
  }> {
    const result = await invoke<{
      removedFromGoogle: number;
      failedRemovals: number;
    }>("disconnect", { removeEvents });
    cacheStatus(false);
    return result;
  },

  handleOAuthResult(): { connected: boolean; errorCode?: string } | null {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("google_calendar");
    if (!result) return null;

    const errorCode = url.searchParams.get("google_calendar_error") ?? undefined;
    url.searchParams.delete("google_calendar");
    url.searchParams.delete("google_calendar_error");
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);

    const connected = result === "connected";
    cacheStatus(connected);
    return { connected, errorCode };
  },

  // Compatibilidade temporária enquanto páginas antigas passam a depender
  // exclusivamente da fila do backend.
  authorize(): void {
    void this.connect();
  },

  extractToken(): string | null {
    return this.handleOAuthResult()?.connected ? "server-managed" : null;
  },

  getToken(): string | null {
    return this.isConnected() ? "server-managed" : null;
  },

  async createEvent(_input: LegacyGoogleEventInput): Promise<null> {
    this.requestSync();
    return null;
  },

  async updateEvent(
    _googleEventId: string,
    _input: LegacyGoogleEventInput,
  ): Promise<boolean> {
    this.requestSync();
    return true;
  },

  async deleteEvent(_googleEventId: string): Promise<boolean> {
    this.requestSync();
    return true;
  },

  async listEvents(_maxResults = 20): Promise<[]> {
    return [];
  },
};
