import {
  type LegalPortalAdapter,
  type LegalPortalCredentials,
  LegalPortalError,
  type LegalPortalHearing,
  type LegalPortalSnapshot,
} from "./legal-portal-adapter.ts";
import { md5 } from "./md5.ts";

const ORIGIN = "https://projudi.tjam.jus.br";
const LOGIN_URL = `${ORIGIN}/projudi/usuario/logon.do?actionType=inicio`;
const TIMEZONE = "America/Manaus";
const TIMEZONE_OFFSET = "-04:00";
const REQUEST_TIMEOUT_MS = 20_000;

interface PortalPage { url: string; html: string }

type PortalDiagnosticStage =
  | "login_page"
  | "post_login"
  | "authenticated_pages"
  | "agenda_links"
  | "agenda_pages";

function diagnosticPath(value: string): string {
  try {
    const url = new URL(value);
    return url.pathname.replace(/;jsessionid=[^/?#;]+/gi, "");
  } catch {
    return "invalid-url";
  }
}

function logPortalDiagnostic(stage: PortalDiagnosticStage, details: Record<string, string | number | boolean>): void {
  console.log(`[projudi_tjam] ${JSON.stringify({ stage, ...details })}`);
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    aacute: "á", Aacute: "Á", atilde: "ã", Atilde: "Ã",
    ccedil: "ç", Ccedil: "Ç", eacute: "é", Eacute: "É",
    iacute: "í", Iacute: "Í", oacute: "ó", Oacute: "Ó",
    uacute: "ú", Uacute: "Ú", ecirc: "ê", Ecirc: "Ê",
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity] ?? match;
  });
}

function visibleText(html: string): string {
  return decodeEntities(html
    .replace(/<!--.*?-->/gs, " ")
    .replace(/<(script|style)\b[^>]*>.*?<\/\1>/gis, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "") || null;
}

function setCookieValues(headers: Headers): string[] {
  const enhanced = headers as Headers & { getSetCookie?: () => string[] };
  const values = enhanced.getSetCookie?.();
  if (values?.length) return values;
  const combined = headers.get("set-cookie");
  return combined ? combined.split(/,(?=\s*[^;,=]+=[^;,]+)/) : [];
}

async function responseHtml(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const bytes = await response.arrayBuffer();
  const encoding = /iso-8859-1|latin1/.test(contentType) ? "windows-1252" : "utf-8";
  return new TextDecoder(encoding).decode(bytes);
}

class PortalSession {
  private readonly cookies = new Map<string, string>();

  async request(url: string, init: RequestInit = {}): Promise<PortalPage> {
    let currentUrl = url;
    let currentInit = init;
    for (let redirect = 0; redirect < 6; redirect += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        const headers = new Headers(currentInit.headers);
        if (this.cookies.size) {
          headers.set("Cookie", [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "));
        }
        headers.set("User-Agent", "ADVeyes/1.0 (+https://adveyes.automatikus.com.br)");
        response = await fetch(currentUrl, { ...currentInit, headers, redirect: "manual", signal: controller.signal });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new LegalPortalError("portal_timeout");
        }
        throw new LegalPortalError("portal_unavailable");
      } finally {
        clearTimeout(timeout);
      }

      for (const raw of setCookieValues(response.headers)) {
        const pair = raw.split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator > 0) this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new LegalPortalError("post_login_navigation_changed");
        currentUrl = new URL(location, currentUrl).toString();
        currentInit = { method: response.status === 307 || response.status === 308 ? currentInit.method : "GET" };
        continue;
      }
      if (!response.ok) throw new LegalPortalError("portal_unavailable");
      return { url: currentUrl, html: await responseHtml(response) };
    }
    throw new LegalPortalError("post_login_navigation_changed");
  }
}

function loginForm(html: string, pageUrl: string, credentials: LegalPortalCredentials) {
  const form = html.match(/<form\b[^>]*(?:name|id)=["']formLogin["'][^>]*>/i)?.[0];
  const action = form ? attribute(form, "action") : null;
  const salt = html.match(/hex_md5\(["']([a-f0-9]{32,})["']\s*\+\s*login\)/i)?.[1];
  if (!action || !salt) throw new LegalPortalError("login_page_changed");
  const body = new URLSearchParams({
    login: credentials.login,
    senha: credentials.password,
    latitude: "",
    longitude: "",
    locationGranted: "",
    tck: md5(`${salt}${credentials.login}`),
  });
  return { url: new URL(action, pageUrl).toString(), body };
}

function activeHtml(html: string): string {
  return html.replace(/<!--.*?-->/gs, " ");
}

function assertAuthenticated(html: string): void {
  const active = activeHtml(html);
  const text = visibleText(active).toLocaleLowerCase("pt-BR");
  if (/usu[aá]rio ou senha inv[aá]lidos|login ou senha inv[aá]lid/.test(text)) {
    throw new LegalPortalError("invalid_credentials");
  }
  if (/g-recaptcha|recaptcha-container|captcha_required/i.test(active)) {
    throw new LegalPortalError("captcha_required");
  }
  if (/certificado digital[^.]{0,80}(obrigat|necess[aá]ri|exigid)/i.test(text)) {
    throw new LegalPortalError("certificate_required");
  }
  if (/<form\b[^>]*(?:name|id)=["']formLogin["']/i.test(active)) {
    throw new LegalPortalError("invalid_credentials");
  }
}

async function authenticatedPages(session: PortalSession, credentials: LegalPortalCredentials): Promise<PortalPage[]> {
  const start = await session.request(LOGIN_URL);
  logPortalDiagnostic("login_page", {
    path: diagnosticPath(start.url),
    bytes: start.html.length,
  });
  const form = loginForm(start.html, start.url, credentials);
  const home = await session.request(form.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.body.toString(),
  });
  assertAuthenticated(home.html);
  logPortalDiagnostic("post_login", {
    path: diagnosticPath(home.url),
    bytes: home.html.length,
  });

  // O Projudi clássico usa frameset. A agenda costuma estar no frame do menu,
  // que não necessariamente é o primeiro frame devolvido após o login.
  const pages = [home];
  const visited = new Set([home.url]);
  for (let cursor = 0; cursor < pages.length && pages.length < 20; cursor += 1) {
    const parent = pages[cursor];
    for (const targetUrl of discoverProjudiTjamPostLoginLinks(parent.html, parent.url)) {
      if (visited.has(targetUrl)) continue;
      visited.add(targetUrl);
      const page = await session.request(targetUrl);
      assertAuthenticated(page.html);
      pages.push(page);
      if (pages.length >= 20) break;
    }
  }
  logPortalDiagnostic("authenticated_pages", { pages: pages.length });
  return pages;
}

function safePortalNavigation(value: string | null, pageUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, pageUrl);
    if (url.protocol !== "https:" || url.origin !== ORIGIN ||
        /(?:logout|logoff|sair)\b/i.test(url.pathname + url.search)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function discoverProjudiTjamPostLoginLinks(html: string, pageUrl: string): string[] {
  const active = activeHtml(html);
  const candidates: string[] = [];

  for (const match of active.matchAll(/<(?:frame|iframe)\b[^>]*>/gi)) {
    const source = attribute(match[0], "src");
    if (source) candidates.push(source);
  }
  for (const match of active.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/^refresh$/i.test(attribute(tag, "http-equiv") ?? "")) continue;
    const content = attribute(tag, "content") ?? "";
    const target = content.match(/(?:^|;)\s*url\s*=\s*(.+)$/i)?.[1]
      ?.trim().replace(/^["']|["']$/g, "");
    if (target) candidates.push(target);
  }
  for (const match of active.matchAll(/(?:window\.)?location(?:\.href)?\s*=\s*(["'])(.*?)\1/gi)) {
    if (match[2]) candidates.push(decodeEntities(match[2]));
  }
  for (const match of active.matchAll(/(?:window\.)?location\.(?:assign|replace)\(\s*(["'])(.*?)\1/gi)) {
    if (match[2]) candidates.push(decodeEntities(match[2]));
  }

  return [...new Set(candidates
    .map(candidate => safePortalNavigation(candidate.replace(/\\\//g, "/"), pageUrl))
    .filter((candidate): candidate is string => Boolean(candidate)))];
}

function navigationLiteral(source: string | null, scriptAttribute = false): string | null {
  if (!source) return null;
  const normalized = decodeEntities(source).replace(/\\\//g, "/").trim();
  if (!scriptAttribute && !/^(?:javascript:|#)/i.test(normalized)) return normalized;

  for (const match of normalized.matchAll(/(["'])([\s\S]*?)\1/g)) {
    const candidate = match[2]?.trim();
    if (!candidate) continue;
    if (/^(?:https?:\/\/|\/|\.\.?\/)/i.test(candidate) ||
        /^[a-z0-9][^\s"'()]*\.(?:do|jsp)(?:[?#][^\s"']*)?$/i.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function navigableHref(tag: string, pageUrl: string): string | null {
  const href = navigationLiteral(attribute(tag, "href")) ??
    navigationLiteral(attribute(tag, "onclick"), true);
  if (!href || /^(?:#|javascript:|mailto:)/i.test(href)) return null;
  return safePortalNavigation(href, pageUrl);
}

export function discoverProjudiTjamAgendaLinks(html: string, pageUrl: string): string[] {
  const active = activeHtml(html);
  const pageText = visibleText(active).toLocaleLowerCase("pt-BR");
  const agendaPage = /mesa do advogado|agendadas|audi[êe]ncias|sess[õo]es de julgamento/.test(pageText);
  const candidates: Array<{ url: string; score: number }> = [];
  for (const match of active.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = match[0].slice(0, match[0].indexOf(">") + 1);
    const text = visibleText(match[0]).toLocaleLowerCase("pt-BR");
    const start = match.index ?? 0;
    // Na Mesa do Advogado atual o texto da categoria fica fora do <a>; o
    // conteúdo do link é apenas a quantidade (por exemplo, "9").
    const context = visibleText(active.slice(Math.max(0, start - 300), start + match[0].length + 80))
      .toLocaleLowerCase("pt-BR");
    const url = navigableHref(tag, pageUrl);
    if (!url) continue;
    const combined = `${text} ${context} ${url}`;
    const category = /audi[êe]ncia (?:de )?(?:concilia|interrogat|una|instru[cç][aã]o)|sess[õa]es? (?:de |do )?julgamento/.test(combined);
    const direct = /audi[êe]ncia|pauta|sess[õa]o/.test(text + " " + url);
    const pagination = agendaPage && /pr[oó]xim|anterior|p[aá]gina|paginar|page=|pagina=/.test(combined);
    if (!category && !direct && !pagination) continue;
    const score = (category ? 30 : 0) + (text.includes("audiências") ? 20 : 0) +
      (direct ? 10 : 0) + (pagination ? 5 : 0);
    candidates.push({ url, score });
  }
  return [...new Map(candidates.sort((a, b) => b.score - a.score).map(item => [item.url, item])).keys()].slice(0, 30);
}

function isoManaus(date: RegExpMatchArray, time: RegExpMatchArray): string | null {
  const day = Number(date[1]);
  const month = Number(date[2]);
  const year = Number(date[3]);
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (year < 2000 || year > 2200 || month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCDate() !== day || check.getUTCMonth() !== month - 1) return null;
  return new Date(`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00${TIMEZONE_OFFSET}`).toISOString();
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function safeSourceUrl(value: string): string {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/;jsessionid=[^/?#;]+/gi, "");
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function parseProjudiTjamHearings(html: string, sourceUrl: string): LegalPortalHearing[] {
  const clean = activeHtml(html).replace(/<(script|style)\b[^>]*>.*?<\/\1>/gis, " ");
  const documentText = visibleText(clean).toLocaleLowerCase("pt-BR");
  const contextType = documentText.includes("sessões de julgamento") || documentText.includes("sessao de julgamento")
    ? "Sessão de julgamento"
    : documentText.includes("interrogatório") || documentText.includes("interrogatorio")
      ? "Audiência de interrogatório"
      : documentText.includes("audiência una") || documentText.includes("audiencia una")
        ? "Audiência una"
        : documentText.includes("conciliação") || documentText.includes("conciliacao")
          ? "Audiência de conciliação"
          : documentText.includes("instrução e julgamento") || documentText.includes("instrucao e julgamento")
            ? "Audiência de instrução e julgamento"
            : null;
  const rows = [...clean.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(match => match[0]);
  const events = new Map<string, LegalPortalHearing>();
  for (const row of rows) {
    const text = visibleText(row);
    const date = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    const time = text.match(/\b(\d{1,2}):(\d{2})\b/);
    const process = text.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)?.[0] ?? null;
    if (!date || !time || (!process && !/audi[êe]ncia|sess[ãa]o/i.test(text))) continue;
    const startsAt = isoManaus(date, time);
    if (!startsAt) continue;
    const lower = text.toLocaleLowerCase("pt-BR");
    const type = lower.includes("concilia") ? "Audiência de conciliação"
      : lower.includes("interrogat") ? "Audiência de interrogatório"
      : /audi[êe]ncia una/.test(lower) ? "Audiência una"
      : lower.includes("custódia") ? "Audiência de custódia"
      : lower.includes("instrução") || lower.includes("instrucao") ? "Audiência de instrução e julgamento"
      : lower.includes("sessão") || lower.includes("sessao") ? "Sessão de julgamento"
      : contextType ?? "Audiência";
    const status = /cancelad|desmarcad/.test(lower) ? "cancelled"
      : /realizad|conclu[ií]d/.test(lower) ? "completed"
      : /redesignad|remarcad|adiad/.test(lower) ? "rescheduled"
      : "scheduled";
    const modality = /h[ií]brid/.test(lower) ? "hybrid"
      : /virtual|videoconfer|telepresencial|teams|zoom|meet\b/.test(lower) ? "remote"
      : /presencial/.test(lower) ? "presential"
      : "unknown";
    const remoteUrl = [...row.matchAll(/<a\b[^>]*>/gi)]
      .map(match => attribute(match[0], "href"))
      .find(href => href && /^https:\/\/(?:[^/]+\.)?(?:teams\.microsoft|zoom\.us|meet\.google|webex)\./i.test(href)) ?? null;
    const normalizedProcess = process?.replace(/\D/g, "") ?? "sem-processo";
    const externalId = `agenda:${fingerprint(`${normalizedProcess}|${startsAt}|${type}|${text}`)}`;
    events.set(externalId, {
      externalId,
      processNumber: process,
      type,
      startsAt,
      endsAt: null,
      timezone: TIMEZONE,
      status,
      modality,
      courtBody: null,
      location: modality === "remote" ? "Videoconferência" : null,
      remoteUrl,
      evidence: text.slice(0, 1200),
      sourceUrl: safeSourceUrl(sourceUrl),
    });
  }
  return [...events.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export class ProjudiTjamClient implements LegalPortalAdapter {
  readonly provider = "projudi_tjam" as const;

  async validateConnection(credentials: LegalPortalCredentials): Promise<void> {
    const session = new PortalSession();
    await authenticatedPages(session, credentials);
  }

  async fetchFutureHearings(credentials: LegalPortalCredentials): Promise<LegalPortalSnapshot> {
    const session = new PortalSession();
    const authenticated = await authenticatedPages(session, credentials);
    const links = [...new Set(authenticated.flatMap(page => discoverProjudiTjamAgendaLinks(page.html, page.url)))];
    logPortalDiagnostic("agenda_links", { pages: authenticated.length, links: links.length });
    if (!links.length) throw new LegalPortalError("agenda_navigation_changed");

    const hearings = new Map<string, LegalPortalHearing>();
    let recognizedAgenda = false;
    const queue = [...links];
    const visited = new Set<string>();
    for (let cursor = 0; cursor < queue.length && cursor < 40; cursor += 1) {
      const link = queue[cursor];
      if (visited.has(link)) continue;
      visited.add(link);
      const page = await session.request(link);
      assertAuthenticated(page.html);
      const pageText = visibleText(page.html).toLocaleLowerCase("pt-BR");
      if (/audi[êe]ncia|pauta|sess[õa]o de julgamento|mesa do advogado/.test(pageText)) recognizedAgenda = true;
      for (const hearing of parseProjudiTjamHearings(page.html, page.url)) {
        hearings.set(hearing.externalId, hearing);
      }
      for (const child of discoverProjudiTjamAgendaLinks(page.html, page.url)) {
        if (!visited.has(child) && !queue.includes(child) && queue.length < 40) queue.push(child);
      }
    }
    logPortalDiagnostic("agenda_pages", {
      visited: visited.size,
      recognized: recognizedAgenda,
      hearings: hearings.size,
    });
    if (!recognizedAgenda) throw new LegalPortalError("agenda_page_changed");

    return {
      provider: this.provider,
      fetchedAt: new Date().toISOString(),
      hearings: [...hearings.values()],
      capabilities: {
        authenticatedHearings: true,
        futureHearings: true,
        historicalHearings: false,
      },
    };
  }
}

export function maskProjudiLogin(login: string): string {
  const clean = login.trim();
  if (clean.length <= 4) return "••••";
  return `${clean.slice(0, 2)}${"•".repeat(Math.min(8, clean.length - 4))}${clean.slice(-2)}`;
}
