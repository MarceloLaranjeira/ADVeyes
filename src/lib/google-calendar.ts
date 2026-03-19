// Google Calendar Integration
interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
}
// Setup: Create OAuth 2.0 credentials at console.cloud.google.com
// Required scopes: https://www.googleapis.com/auth/calendar

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const REDIRECT_URI = "https://albertino-law-boost.lovable.app/configuracoes";
const SCOPES = "https://www.googleapis.com/auth/calendar";

export const googleCalendar = {
  /** Open Google OAuth consent screen */
  authorize() {
    if (!GOOGLE_CLIENT_ID) {
      console.warn("VITE_GOOGLE_CLIENT_ID not set");
      return;
    }
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "token",
      scope: SCOPES,
      include_granted_scopes: "true",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  /** Extract access token from URL hash after redirect */
  extractToken(): string | null {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    if (token) {
      localStorage.setItem("google_calendar_token", token);
      const expiresIn = params.get("expires_in");
      if (expiresIn) {
        const expiry = Date.now() + parseInt(expiresIn) * 1000;
        localStorage.setItem("google_calendar_expiry", expiry.toString());
      }
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    return token;
  },

  getToken(): string | null {
    const token = localStorage.getItem("google_calendar_token");
    const expiry = localStorage.getItem("google_calendar_expiry");
    if (!token || !expiry) return null;
    if (Date.now() > parseInt(expiry)) {
      localStorage.removeItem("google_calendar_token");
      localStorage.removeItem("google_calendar_expiry");
      return null;
    }
    return token;
  },

  isConnected(): boolean {
    return !!this.getToken();
  },

  disconnect() {
    localStorage.removeItem("google_calendar_token");
    localStorage.removeItem("google_calendar_expiry");
  },

  /** Sync a local event to Google Calendar */
  async createEvent(evento: {
    titulo: string;
    descricao?: string;
    data_inicio: string;
    local?: string;
  }): Promise<{ id: string } | null> {
    const token = this.getToken();
    if (!token) return null;

    const start = new Date(evento.data_inicio);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h default

    const body = {
      summary: evento.titulo,
      description: evento.descricao || "",
      location: evento.local || "",
      start: { dateTime: start.toISOString(), timeZone: "America/Manaus" },
      end: { dateTime: end.toISOString(), timeZone: "America/Manaus" },
    };

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) return null;
    return res.json();
  },

  /** List upcoming events from Google Calendar */
  async listEvents(maxResults = 20): Promise<GoogleCalendarEvent[]> {
    const token = this.getToken();
    if (!token) return [];

    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: new Date().toISOString(),
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  },

  /** Delete an event from Google Calendar */
  async deleteEvent(googleEventId: string): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );

    return res.status === 204;
  },
};
