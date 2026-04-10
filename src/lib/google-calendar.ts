// Google Calendar Integration
// Setup: Create OAuth 2.0 credentials at console.cloud.google.com
// Required scopes: https://www.googleapis.com/auth/calendar

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
}

interface CreateEventInput {
  titulo: string;
  descricao?: string;
  data_inicio: string;   // ISO string ou "YYYY-MM-DD"
  local?: string;
  colorId?: string;      // "2"=verde, "7"=petróleo, "9"=azul, "11"=vermelho
  allDay?: boolean;      // true = evento de dia inteiro (prazo/vencimento)
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const REDIRECT_URI = `${window.location.origin}/configuracoes`;
const SCOPES = "https://www.googleapis.com/auth/calendar";
const GCAL_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const googleCalendar = {
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

  async createEvent(input: CreateEventInput): Promise<{ id: string } | null> {
    const token = this.getToken();
    if (!token) return null;

    let startField: { dateTime?: string; date?: string; timeZone?: string };
    let endField: { dateTime?: string; date?: string; timeZone?: string };

    if (input.allDay) {
      const dateStr = input.data_inicio.slice(0, 10);
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);
      startField = { date: dateStr };
      endField = { date: nextDay.toISOString().slice(0, 10) };
    } else {
      const start = new Date(input.data_inicio);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      startField = { dateTime: start.toISOString(), timeZone: "America/Manaus" };
      endField = { dateTime: end.toISOString(), timeZone: "America/Manaus" };
    }

    const body: Record<string, unknown> = {
      summary: input.titulo,
      description: input.descricao || "",
      location: input.local || "",
      start: startField,
      end: endField,
    };
    if (input.colorId) body.colorId = input.colorId;

    const res = await fetch(GCAL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    return res.json();
  },

  async updateEvent(googleEventId: string, input: CreateEventInput): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    let startField: { dateTime?: string; date?: string; timeZone?: string };
    let endField: { dateTime?: string; date?: string; timeZone?: string };

    if (input.allDay) {
      const dateStr = input.data_inicio.slice(0, 10);
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);
      startField = { date: dateStr };
      endField = { date: nextDay.toISOString().slice(0, 10) };
    } else {
      const start = new Date(input.data_inicio);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      startField = { dateTime: start.toISOString(), timeZone: "America/Manaus" };
      endField = { dateTime: end.toISOString(), timeZone: "America/Manaus" };
    }

    const body: Record<string, unknown> = {
      summary: input.titulo,
      description: input.descricao || "",
      location: input.local || "",
      start: startField,
      end: endField,
    };
    if (input.colorId) body.colorId = input.colorId;

    const res = await fetch(`${GCAL_URL}/${googleEventId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return res.ok;
  },

  async deleteEvent(googleEventId: string): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    const res = await fetch(`${GCAL_URL}/${googleEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.status === 204;
  },

  async listEvents(maxResults = 20): Promise<GoogleCalendarEvent[]> {
    const token = this.getToken();
    if (!token) return [];

    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: new Date().toISOString(),
    });

    const res = await fetch(`${GCAL_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  },
};
