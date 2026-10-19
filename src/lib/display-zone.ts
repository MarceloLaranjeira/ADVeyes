import { format } from "date-fns";
import { DEFAULT_ZONE, formatInZone, isKnownZone, zoneName } from "@/lib/timezone";

/** Preferência do usuário, compartilhada entre as telas: um fuso do Brasil ou "auto" (fuso de cada tribunal). */
export const VIEW_ZONE_KEY = "adveyes.hearingViewZone";
export type ViewZone = "auto" | string;

export function readViewZone(): ViewZone {
  try {
    const stored = window.localStorage.getItem(VIEW_ZONE_KEY);
    return stored === "auto" || isKnownZone(stored) ? (stored as ViewZone) : DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
}

export function writeViewZone(value: ViewZone): void {
  try {
    window.localStorage.setItem(VIEW_ZONE_KEY, value);
  } catch {
    /* preferência só deste navegador */
  }
}

/** Fuso em que uma audiência é mostrada: o escolhido, ou o do tribunal em "auto". */
export function resolveZone(eventTimezone?: string | null, view: ViewZone = readViewZone()): string {
  return view === "auto" ? (isKnownZone(eventTimezone) ? eventTimezone : DEFAULT_ZONE) : view;
}

export interface HearingMomentInput {
  eventTimezone?: string | null;
  endsAt?: string | null;
  /** Audiência importada de portal: meia-noite sem janela significa "horário não informado". */
  imported?: boolean;
  /** Acrescenta o nome do fuso ao texto. */
  withZone?: boolean;
}

/** "03/11/2026 às 09:00 (Manaus)", "03/11/2026 00:00 até 08/11/2026 23:59 (Manaus)" ou só a data. */
export function formatHearingMoment(iso: string, options: HearingMomentInput = {}): string {
  const zone = resolveZone(options.eventTimezone);
  const suffix = options.withZone === false ? "" : ` (${zoneName(zone)})`;
  if (options.endsAt) {
    return `${formatInZone(iso, zone).text} até ${formatInZone(options.endsAt, zone).text}${suffix}`;
  }
  const label = formatInZone(iso, zone, Boolean(options.imported));
  return label.hasTime ? `${label.text}${suffix}` : `${label.text} · horário não informado`;
}

/** Só a hora ("09:00") no fuso resolvido, para cartões de agenda. */
export function formatHearingClock(iso: string, eventTimezone?: string | null): string {
  const text = formatInZone(iso, resolveZone(eventTimezone)).text;
  return text.includes(" às ") ? text.split(" às ")[1] : "";
}

/** Hora de um item da agenda: audiências no fuso escolhido; tarefas e compromissos no fuso do navegador. */
export function calendarItemClock(item: { sourceType: string; date: string; timezone?: string | null }): string {
  return item.sourceType === "hearing" ? formatHearingClock(item.date, item.timezone) : format(new Date(item.date), "HH:mm");
}
