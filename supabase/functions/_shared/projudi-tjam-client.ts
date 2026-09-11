import {
  type LegalPortalAdapter,
  type LegalPortalCredentials,
  LegalPortalError,
  type LegalPortalHearing,
  type LegalPortalSessionState,
  type LegalPortalSnapshot,
  type LegalPortalValidation,
} from "./legal-portal-adapter.ts";
import { md5 } from "./md5.ts";

const ORIGIN = "https://projudi.tjam.jus.br";
const LOGIN_URL = `${ORIGIN}/projudi/usuario/logon.do?actionType=inicio`;
const TIMEZONE = "America/Manaus";
const TIMEZONE_OFFSET = "-04:00";
const REQUEST_TIMEOUT_MS = 20_000;
const SESSION_REFRESH_MINUTES = 110;
const SESSION_EXPIRES_MINUTES = 120;

interface PortalPage { url: string; html: string }

type PortalDiagnosticStage =
  | "login_page"
  | "post_login"
  | "authenticated_pages"
  | "authenticated_page_skipped"
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

  constructor(initialCookies: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialCookies)) {
      if (/^[A-Za-z0-9_.-]{1,120}$/.test(key) && value.length <= 4096) this.cookies.set(key, value);
    }
  }

  state(entryUrl: string, authenticatedAt = new Date()): LegalPortalSessionState {
    return {
      cookies: Object.fromEntries(this.cookies),
      entryUrl,
      authenticatedAt: authenticatedAt.toISOString(),
      refreshAt: new Date(authenticatedAt.getTime() + SESSION_REFRESH_MINUTES * 60_000).toISOString(),
      expiresAt: new Date(authenticatedAt.getTime() + SESSION_EXPIRES_MINUTES * 60_000).toISOString(),
    };
  }

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
        headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36");
        if (!headers.has("Accept")) headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
        if (!headers.has("Accept-Language")) headers.set("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.7");
        headers.set("Cache-Control", "no-cache");
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
    // O formulário atual diferencia localização negada de valor ausente.
    // Não inventamos coordenadas nem coletamos a localização do advogado.
    locationGranted: "false",
    tck: md5(`${salt}${credentials.login}`),
  });
  return { url: new URL(action, pageUrl).toString(), body };
}

function activeHtml(html: string): string {
  return html.replace(/<!--.*?-->/gs, " ");
}

function assertAuthenticated(html: string, phase: "login" | "session" = "login"): void {
  const active = activeHtml(html);
  const text = visibleText(active).toLocaleLowerCase("pt-BR");
  if (/usu[aá]rio ou senha inv[aá]lidos|login ou senha inv[aá]lid|senha ou usu[aá]rio incorret|credenciais? inv[aá]lid/.test(text)) {
    throw new LegalPortalError("invalid_credentials");
  }
  if (/sess[aã]o (?:expirou|expirada)|efetue novamente o login/.test(text)) {
    throw new LegalPortalError("session_expired");
  }
  if (/autentica[cç][aã]o em dois fatores|duplo fator|c[oó]digo de verifica[cç][aã]o|token de acesso/.test(text)) {
    throw new LegalPortalError("mfa_required");
  }
  if (/g-recaptcha|recaptcha-container|captcha_required/i.test(active)) {
    throw new LegalPortalError("captcha_required");
  }
  if (/certificado digital[^.]{0,80}(obrigat|necess[aá]ri|exigid)/i.test(text)) {
    throw new LegalPortalError("certificate_required");
  }
  if (/<form\b[^>]*(?:name|id)=["']formLogin["']/i.test(active)) {
    throw new LegalPortalError(phase === "session" ? "session_expired" : "post_login_navigation_changed");
  }
}

function reusableSession(credentials: LegalPortalCredentials): LegalPortalSessionState | null {
  const state = credentials.session;
  if (!state || !state.entryUrl || !state.cookies || Date.parse(state.refreshAt) <= Date.now()) return null;
  try {
    const url = new URL(state.entryUrl);
    return url.origin === ORIGIN ? state : null;
  } catch {
    return null;
  }
}

interface AuthenticatedPortal {
  pages: PortalPage[];
  session: LegalPortalSessionState;
}

async function authenticatedPages(credentials: LegalPortalCredentials, maxPages = 20): Promise<AuthenticatedPortal> {
  const cached = reusableSession(credentials);
  if (cached) {
    const resumed = new PortalSession(cached.cookies);
    try {
      const home = await resumed.request(cached.entryUrl, { headers: { Referer: ORIGIN + "/projudi/" } });
      assertAuthenticated(home.html, "session");
      const pages = await collectAuthenticatedPages(resumed, home, maxPages);
      logPortalDiagnostic("post_login", { path: diagnosticPath(home.url), bytes: home.html.length, resumed: true });
      return {
        pages,
        session: resumed.state(home.url, new Date(cached.authenticatedAt)),
      };
    } catch (error) {
      if (!(error instanceof LegalPortalError) || error.code !== "session_expired") throw error;
      logPortalDiagnostic("post_login", { path: diagnosticPath(cached.entryUrl), bytes: 0, resumed: false });
    }
  }

  const session = new PortalSession();
  // O TJAM passou a inicializar a proteção de sessão na raiz antes de carregar
  // o frame de login. Essa visita preserva os cookies emitidos pelo portal.
  await session.request(`${ORIGIN}/projudi/`);
  const start = await session.request(LOGIN_URL);
  logPortalDiagnostic("login_page", {
    path: diagnosticPath(start.url),
    bytes: start.html.length,
  });
  const form = loginForm(start.html, start.url, credentials);
  const home = await session.request(form.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: ORIGIN,
      Referer: start.url,
    },
    body: form.body.toString(),
  });
  assertAuthenticated(home.html, "login");
  logPortalDiagnostic("post_login", {
    path: diagnosticPath(home.url),
    bytes: home.html.length,
  });

  const pages = await collectAuthenticatedPages(session, home, maxPages);
  const now = new Date();
  return { pages, session: session.state(home.url, now) };
}

async function collectAuthenticatedPages(session: PortalSession, home: PortalPage, maxPages: number): Promise<PortalPage[]> {
  // O Projudi clássico usa frameset. A agenda costuma estar no frame do menu,
  // que não necessariamente é o primeiro frame devolvido após o login.
  const pages = [home];
  const visited = new Set([home.url]);
  for (let cursor = 0; cursor < pages.length && pages.length < maxPages; cursor += 1) {
    const parent = pages[cursor];
    for (const targetUrl of discoverProjudiTjamPostLoginLinks(parent.html, parent.url)) {
      if (visited.has(targetUrl)) continue;
      visited.add(targetUrl);
      try {
        const page = await session.request(targetUrl);
        assertAuthenticated(page.html);
        pages.push(page);
      } catch (error) {
        if (error instanceof LegalPortalError &&
            ["post_login_navigation_changed", "session_expired"].includes(error.code)) {
          logPortalDiagnostic("authenticated_page_skipped", {
            path: diagnosticPath(targetUrl),
            reason: error.code,
          });
          continue;
        }
        throw error;
      }
      if (pages.length >= maxPages) break;
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
  for (const match of active.matchAll(/(?:(?:window|top|parent|self|document)(?:\.(?:window|parent|top|self|frames\[[^\]]+\]))?\.)?location(?:\.href)?\s*=\s*(["'])(.*?)\1/gi)) {
    if (match[2]) candidates.push(decodeEntities(match[2]));
  }
  for (const match of active.matchAll(/(?:(?:window|top|parent|self|document)\.)?location\.(?:assign|replace)\(\s*(["'])(.*?)\1/gi)) {
    if (match[2]) candidates.push(decodeEntities(match[2]));
  }
  for (const match of active.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = match[0].slice(0, match[0].indexOf(">") + 1);
    const label = visibleText(match[0]).toLocaleLowerCase("pt-BR");
    const target = navigableHref(tag, pageUrl);
    if (!target) continue;
    const targetPath = diagnosticPath(target).toLocaleLowerCase("pt-BR");
    if (/^(?:in[ií]cio|p[aá]gina principal|mesa do advogado)/.test(label) ||
        /(?:postlogon|paginaprincipal|actiontype=iniciar|\/inicio\.(?:do|jsp))/.test(targetPath + new URL(target).search.toLowerCase())) {
      candidates.push(target);
    }
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
  for (const match of active.matchAll(/<(?:a|button|input|div|span)\b[^>]*>/gi)) {
    const tag = match[0];
    const text = [attribute(tag, "value"), attribute(tag, "title"), attribute(tag, "aria-label")]
      .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    const start = match.index ?? 0;
    // Na Mesa do Advogado atual o texto da categoria fica fora do <a>; o
    // conteúdo do link é apenas a quantidade e a aba usa onclick no <div>.
    const context = visibleText(active.slice(Math.max(0, start - 300), start + match[0].length + 160))
      .toLocaleLowerCase("pt-BR");
    const url = navigableHref(tag, pageUrl);
    if (!url) continue;
    const parsedUrl = new URL(url);
    const route = `${parsedUrl.pathname}${parsedUrl.search}`.toLocaleLowerCase("pt-BR");
    // Links de processo/intimação aparecem dentro das listas, mas são páginas
    // de detalhe. Datas de movimentações nessas páginas não são compromissos.
    if (/\/processo(?:\/intimacao)?\.do\b/.test(parsedUrl.pathname.toLocaleLowerCase("pt-BR"))) continue;
    const agendaRoute = /audiencia|\/agenda\/|\/sessao\/|sessaoturmabusca\.do|listaaudiencias|\/pauta\//.test(route);
    if (!agendaRoute) continue;
    const combined = `${text} ${context} ${url}`;
    const category = /audi[êe]ncia (?:de )?(?:concilia|interrogat|una|instru[cç][aã]o)|sess[õa]es? (?:de |do )?julgamento/.test(combined);
    const direct = /audi[êe]ncia|pauta|sess[õa]o/.test(text + " " + url);
    const pagination = agendaPage && /pr[oó]xim|anterior|p[aá]gina|paginar|page=|pagina=/.test(combined);
    if (!category && !direct && !pagination) continue;
    const score = (category ? 30 : 0) + (text.includes("audiências") ? 20 : 0) +
      (direct ? 10 : 0) + (pagination ? 5 : 0);
    candidates.push({ url, score });
  }

  // Algumas versões do TJAM deixam a rota da aba somente em uma string de
  // JavaScript do menu (sem href navegável). Extraímos apenas literais curtos,
  // HTTPS e do próprio host; nenhum código da página é executado.
  for (const match of active.matchAll(/(["'])([^"']*(?:audi[êe]n|sess[aã]o|pauta)[^"']*)\1/gi)) {
    const raw = decodeEntities(match[2] ?? "").replace(/\\\//g, "/").trim();
    if (!raw || raw.length > 500) continue;
    const literal = navigationLiteral(raw);
    const url = safePortalNavigation(literal, pageUrl);
    if (!url) continue;
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/projudi/") ||
        !/audi[êe]n|sess[aã]o|pauta/i.test(parsed.pathname + parsed.search) ||
        // Ações de <form> também aparecem como strings entre aspas, mas não
        // podem ser abertas com GET. Aqui aceitamos somente a rota explícita da aba.
        !/actionType=listaAudiencias/i.test(parsed.search)) continue;
    candidates.push({ url, score: 25 });
  }
  return [...new Map(candidates.sort((a, b) => b.score - a.score).map(item => [item.url, item])).keys()].slice(0, 30);
}

function agendaPageStructureHint(html: string): string {
  const active = activeHtml(html);
  const text = visibleText(active);
  const rows = [...active.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(match => visibleText(match[0]));
  const rowDateAndTime = rows.filter(row => /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(row) && /\b\d{1,2}:\d{2}\b/.test(row)).length;
  const rowProcess = rows.filter(row => /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/.test(row)).length;
  return [
    `tr${rows.length}`,
    `td${[...active.matchAll(/<td\b/gi)].length}`,
    `dt${rowDateAndTime}`,
    `cnj${rowProcess}`,
    `dates${[...text.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g)].length}`,
    `times${[...text.matchAll(/\b\d{1,2}:\d{2}\b/g)].length}`,
  ].join("/");
}

interface AgendaRequest {
  url: string;
  method: "GET" | "POST";
  body: string | null;
  referer: string;
}

function agendaRequestKey(request: AgendaRequest): string {
  return `${request.method}:${request.url}:${request.body ?? ""}`;
}

export function discoverProjudiTjamAgendaTabRequests(html: string, pageUrl: string): AgendaRequest[] {
  const active = activeHtml(html);
  if (!/listaAudiencias/i.test(active)) return [];
  const tabCall = active.match(/\bsetTab\(\s*(["'])(.*?)\1\s*,\s*(["'])(tabAudiencias)\3/i);
  const tabAction = safePortalNavigation(tabCall?.[2] ?? null, pageUrl);
  const requests: AgendaRequest[] = [];
  const openings = [...active.matchAll(/<form\b[^>]*>/gi)];
  for (let index = 0; index < openings.length; index += 1) {
    const opening = openings[index];
    const tag = opening[0];
    const formName = `${attribute(tag, "name") ?? ""} ${attribute(tag, "id") ?? ""}`;
    if (!/mesaAdvogadoForm/i.test(formName)) continue;
    const action = tabAction ?? safePortalNavigation(attribute(tag, "action"), pageUrl);
    if (!action) continue;
    const start = opening.index ?? 0;
    const closing = active.toLowerCase().indexOf("</form>", start + tag.length);
    const nextOpening = openings[index + 1]?.index ?? active.length;
    const end = closing >= 0 && closing < nextOpening ? closing + 7 : nextOpening;
    const formHtml = active.slice(start, end);
    const body = new URLSearchParams();
    for (const inputMatch of formHtml.matchAll(/<input\b[^>]*>/gi)) {
      const input = inputMatch[0];
      const name = attribute(input, "name");
      const type = (attribute(input, "type") ?? "text").toLowerCase();
      if (!name || !["hidden", "radio", "checkbox"].includes(type)) continue;
      if (["radio", "checkbox"].includes(type) && !/\bchecked(?:\s*=|\s|>)/i.test(input)) continue;
      body.set(name, attribute(input, "value") ?? "");
    }
    body.set("selectedIcon", tabCall?.[4] ?? "tabAudiencias");
    requests.push({ url: action, method: "POST", body: body.toString(), referer: pageUrl });
  }
  return [...new Map(requests.map(request => [agendaRequestKey(request), request])).values()];
}

export function discoverProjudiTjamAgendaFormRequests(html: string, pageUrl: string): AgendaRequest[] {
  const active = activeHtml(html);
  const decodedActive = decodeEntities(active);
  const requests: AgendaRequest[] = [];
  const pageTypes = new Set<string>();
  for (const call of decodedActive.matchAll(/\bbuscarAudiencias\(\s*(?:(["'])(.*?)\1|(\d+))\s*\)/gi)) {
    const value = (call[2] ?? call[3] ?? "").trim();
    if (/^[A-Za-z0-9_.-]{1,80}$/.test(value)) pageTypes.add(value);
  }

  // O HTML legado do Projudi nem sempre fecha o form de maneira bem-formada e,
  // em algumas releases, a função buscarAudiencias fica fora dele. Partimos da
  // abertura do formulário e usamos as chamadas literais da página como fallback.
  const formOpenings = [...active.matchAll(/<form\b[^>]*>/gi)];
  for (let index = 0; index < formOpenings.length; index += 1) {
    const formMatch = formOpenings[index];
    const openingTag = formMatch[0];
    const start = formMatch.index ?? 0;
    const closing = active.toLowerCase().indexOf("</form>", start + openingTag.length);
    const nextOpening = formOpenings[index + 1]?.index ?? active.length;
    const end = closing >= 0 && closing < nextOpening ? closing + 7 : nextOpening;
    const formHtml = active.slice(start, end);
    const actionValue = attribute(openingTag, "action");
    const action = safePortalNavigation(actionValue, pageUrl);
    const formName = `${attribute(openingTag, "name") ?? ""} ${attribute(openingTag, "id") ?? ""}`;
    if (!action || !/audi[êe]n|sess[aã]o|pauta/i.test(`${formName} ${formHtml} ${action}`)) continue;

    const base = new URLSearchParams();
    for (const inputMatch of formHtml.matchAll(/<input\b[^>]*>/gi)) {
      const input = inputMatch[0];
      const name = attribute(input, "name");
      const type = (attribute(input, "type") ?? "text").toLowerCase();
      if (!name || (!["hidden", "radio", "checkbox"].includes(type))) continue;
      if (["radio", "checkbox"].includes(type) && !/\bchecked(?:\s*=|\s|>)/i.test(input)) continue;
      base.set(name, attribute(input, "value") ?? "");
    }
    for (const selectMatch of formHtml.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)) {
      const select = selectMatch[0];
      const name = attribute(select.slice(0, select.indexOf(">") + 1), "name");
      if (!name) continue;
      const options = [...select.matchAll(/<option\b[^>]*>/gi)];
      const selected = options.find(option => /\bselected(?:\s*=|\s|>)/i.test(option[0])) ?? options[0];
      if (selected) base.set(name, attribute(selected[0], "value") ?? "");
    }

    const types = new Set<string>();
    for (const call of decodeEntities(formHtml).matchAll(/\bbuscarAudiencias\(\s*(?:(["'])(.*?)\1|(\d+))\s*\)/gi)) {
      const value = (call[2] ?? call[3] ?? "").trim();
      if (/^[A-Za-z0-9_.-]{1,80}$/.test(value)) types.add(value);
    }
    if (!types.size && /audienciaForm/i.test(formName + " " + formHtml)) {
      for (const value of pageTypes) types.add(value);
    }
    for (const type of types) {
      const body = new URLSearchParams(base);
      body.set("idTipoAudiencia", type);
      requests.push({
        url: action,
        method: "POST",
        body: body.toString(),
        referer: pageUrl,
      });
    }
  }
  return [...new Map(requests.map(request => [agendaRequestKey(request), request])).values()].slice(0, 30);
}

function agendaNavigationHints(html: string, pageUrl: string): Record<string, string | number | boolean> {
  const active = activeHtml(html);
  const decodedActive = decodeEntities(active);
  const routes = new Set<string>();
  const handlers = new Set<string>();
  const safeHint = (value: string) => {
    const target = safePortalNavigation(decodeEntities(value).replace(/\\\//g, "/"), pageUrl);
    if (!target) return;
    const url = new URL(target);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:_tj|token|key|nocache|r|session)/i.test(key)) url.searchParams.delete(key);
    }
    routes.add(`${url.pathname}${url.search}`.slice(0, 240));
  };

  for (const match of active.matchAll(/<(?:a|button|input|form)\b[^>]*>/gi)) {
    const tag = match[0];
    const attributes = [attribute(tag, "href"), attribute(tag, "onclick"), attribute(tag, "action")];
    if (!attributes.some(value => /audi[êe]n|sess[aã]o|pauta/i.test(value ?? ""))) continue;
    for (const value of attributes) {
      const literal = navigationLiteral(value, true);
      if (literal) safeHint(literal);
      for (const handler of (value ?? "").matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) handlers.add(handler[1]);
    }
  }
  for (const match of active.matchAll(/(["'])([^"']*(?:audi[êe]n|sess[aã]o|pauta)[^"']*)\1/gi)) {
    const literal = navigationLiteral(match[2]);
    if (literal) safeHint(literal);
  }
  for (const match of decodedActive.matchAll(/\b([A-Za-z_$][\w$]*(?:Audien|Sessao|Pauta)[A-Za-z0-9_$]*)\s*\(/gi)) {
    handlers.add(match[1]);
  }

  const formHints = [...active.matchAll(/<form\b[^>]*>/gi)].map(match => {
    const tag = match[0];
    const action = attribute(tag, "action") ?? "";
    const name = attribute(tag, "name") ?? attribute(tag, "id") ?? "";
    const safeAction = safePortalNavigation(action, pageUrl);
    return `${name.slice(0, 60)}:${safeAction ? diagnosticPath(safeAction) : "unsafe-or-empty"}`;
  });
  const callArguments = [...decodedActive.matchAll(/\bbuscarAudiencias\(\s*([^)]{0,100})\)/gi)]
    .map(match => (match[1] ?? "").replace(/[^A-Za-z0-9_.'"-]/g, "").slice(0, 80));
  const agendaFormStart = decodedActive.search(/<form\b[^>]*(?:name|id)\s*=\s*["']?audienciaForm\b/i);
  const agendaFormTail = agendaFormStart >= 0 ? decodedActive.slice(agendaFormStart, agendaFormStart + 12_000) : "";
  const agendaFormControls = [...agendaFormTail.matchAll(/<(?:a|button|input|div|span)\b[^>]*>/gi)]
    .map(match => match[0])
    .filter(tag => attribute(tag, "href") || attribute(tag, "onclick"))
    .slice(0, 20)
    .map(tag => {
      const href = attribute(tag, "href") ?? "";
      const onclick = attribute(tag, "onclick") ?? "";
      return `${href}|${onclick}`.replace(/[^A-Za-z0-9_./?=&'"():;,# -]/g, "").slice(0, 180);
    });
  const tabActionIndex = decodedActive.indexOf("listaAudiencias");
  const tabActionContext = tabActionIndex >= 0
    ? decodedActive.slice(Math.max(0, tabActionIndex - 350), tabActionIndex + 650)
      .replace(/\s+/g, " ")
      .replace(/[^A-Za-z0-9À-ÿ_./?=&'"():;,+ -]/g, "")
      .slice(0, 1000)
    : "";
  const scriptSources = [...active.matchAll(/<script\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)]
    .map(match => decodeEntities(match[1] ?? match[2] ?? match[3] ?? ""))
    .filter(source => source && source.length <= 300)
    .slice(0, 30);
  const setTabDefinitionIndex = decodedActive.search(/function\s+setTab\s*\(/i);
  const setTabDefinition = setTabDefinitionIndex >= 0
    ? decodedActive.slice(setTabDefinitionIndex, setTabDefinitionIndex + 1200)
      .replace(/\s+/g, " ")
      .replace(/[^A-Za-z0-9À-ÿ_./?=&'"():;,+ -]/g, "")
      .slice(0, 1100)
    : "";
  const categoryControls: string[] = [];
  for (const category of decodedActive.matchAll(/audi[êe]ncia\s+(?:de\s+)?(?:concilia[cç][aã]o|interrogat[oó]rio|una|instru[cç][aã]o)|sess[õo]es?\s+(?:de\s+)?julgamento/gi)) {
    const offset = category.index ?? 0;
    const context = decodedActive.slice(Math.max(0, offset - 180), offset + 500);
    const controls = [...context.matchAll(/<(?:a|button|input|div|span)\b[^>]*>/gi)].slice(0, 8)
      .map(control => {
        const tag = control[0];
        const fields = ["href", "onclick", "id", "name", "value"]
          .map(key => [key, attribute(tag, key)] as const)
          .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
          .map(([key, value]) => `${key}=${value.replace(/[^A-Za-z0-9_./?=&'"():;,# -]/g, "").slice(0, 140)}`);
        return fields.join("|");
      }).filter(Boolean);
    categoryControls.push(controls.join("~"));
  }

  return {
    anchors: [...active.matchAll(/<a\b/gi)].length,
    forms: [...active.matchAll(/<form\b/gi)].length,
    form_hints: formHints.join(",").slice(0, 800),
    agenda_calls: callArguments.join(",").slice(0, 800),
    agenda_form_controls: agendaFormControls.join(",").slice(0, 1400),
    tab_action_context: tabActionContext,
    script_sources: scriptSources.join(",").slice(0, 1600),
    set_tab_definition: setTabDefinition,
    category_controls: categoryControls.join("||").slice(0, 1800),
    agenda_form_requests: discoverProjudiTjamAgendaFormRequests(html, pageUrl).length,
    route_hints: [...routes].slice(0, 12).join(",").slice(0, 1500),
    handler_hints: [...handlers].slice(0, 20).join(",").slice(0, 800),
  };
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

  async validateConnection(credentials: LegalPortalCredentials): Promise<LegalPortalValidation> {
    // A conexão precisa confirmar apenas a autenticação. Varrer frames e agendas
    // aqui fazia uma página lenta do tribunal parecer senha inválida/timeout.
    const authenticated = await authenticatedPages(credentials, 1);
    return {
      validatedAt: new Date().toISOString(),
      session: authenticated.session,
      capabilities: {
        authenticatedHearings: true,
        futureHearings: true,
        historicalHearings: false,
      },
    };
  }

  async fetchFutureHearings(credentials: LegalPortalCredentials): Promise<LegalPortalSnapshot> {
    const authenticated = await authenticatedPages(credentials);
    const session = new PortalSession(authenticated.session.cookies);
    const linkRequests = authenticated.pages.flatMap(page =>
      discoverProjudiTjamAgendaLinks(page.html, page.url)
        .map(url => ({ url, method: "GET" as const, body: null, referer: page.url }))
    );
    const links = [...new Set(linkRequests.map(request => request.url))];
    const tabRequests = authenticated.pages.flatMap(page =>
      discoverProjudiTjamAgendaTabRequests(page.html, page.url)
    );
    const formRequests = authenticated.pages.flatMap(page =>
      discoverProjudiTjamAgendaFormRequests(page.html, page.url)
    );
    const initialRequests: AgendaRequest[] = [
      ...tabRequests,
      ...linkRequests,
      ...formRequests,
    ];
    const sourceAgendaPage = authenticated.pages.find(page => /listaAudiencias/i.test(page.html));
    const sourceAgendaHints = sourceAgendaPage
      ? agendaNavigationHints(sourceAgendaPage.html, sourceAgendaPage.url)
      : null;
    logPortalDiagnostic("agenda_links", {
      pages: authenticated.pages.length,
      links: links.length,
      forms: formRequests.length + tabRequests.length,
    });
    if (!initialRequests.length) {
      const agendaPage = authenticated.pages.find(page =>
        /mesa do advogado|audi[êe]ncias|sess[õo]es de julgamento/i.test(visibleText(page.html))
      );
      throw new LegalPortalError("agenda_navigation_changed", {
        pages: authenticated.pages.length,
        page_paths: authenticated.pages.map(page => diagnosticPath(page.url)).join(",").slice(0, 1000),
        page_bytes: authenticated.pages.map(page => page.html.length).join(",").slice(0, 500),
        agenda_markers: authenticated.pages.map(page =>
          /mesa do advogado|audi[êe]ncias|sess[õo]es de julgamento/i.test(visibleText(page.html)) ? "1" : "0"
        ).join(""),
        ...(agendaPage ? agendaNavigationHints(agendaPage.html, agendaPage.url) : {}),
      });
    }

    const hearings = new Map<string, LegalPortalHearing>();
    let recognizedAgenda = false;
    const queue = [...initialRequests];
    const visited = new Set<string>();
    const requestHints: string[] = [];
    for (let cursor = 0; cursor < queue.length && cursor < 40; cursor += 1) {
      const request = queue[cursor];
      const requestKey = agendaRequestKey(request);
      if (visited.has(requestKey)) continue;
      visited.add(requestKey);
      const page = await session.request(request.url, request.method === "POST" ? {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          Referer: request.referer,
        },
        body: request.body ?? "",
      } : { headers: {
        "X-Requested-With": "XMLHttpRequest",
        Referer: request.referer,
      } });
      assertAuthenticated(page.html);
      const pageText = visibleText(page.html).toLocaleLowerCase("pt-BR");
      if (/audi[êe]ncia|pauta|sess[õa]o de julgamento|mesa do advogado/.test(pageText)) recognizedAgenda = true;
      const parsedHearings = parseProjudiTjamHearings(page.html, page.url);
      for (const hearing of parsedHearings) {
        hearings.set(hearing.externalId, hearing);
      }
      const childLinks = discoverProjudiTjamAgendaLinks(page.html, page.url);
      const childForms = discoverProjudiTjamAgendaFormRequests(page.html, page.url);
      const requestType = request.body ? new URLSearchParams(request.body).get("idTipoAudiencia") : null;
      requestHints.push(`${request.method}:${diagnosticPath(request.url)}${requestType ? `:t${requestType.slice(0, 24)}` : ""}:b${page.html.length}:h${parsedHearings.length}:l${childLinks.length}:f${childForms.length}${parsedHearings.length ? "" : `:z${agendaPageStructureHint(page.html)}`}`);
      for (const child of childLinks) {
        const childRequest: AgendaRequest = { url: child, method: "GET", body: null, referer: page.url };
        if (!visited.has(agendaRequestKey(childRequest)) && queue.length < 40) queue.push(childRequest);
      }
      for (const child of childForms) {
        if (!visited.has(agendaRequestKey(child)) && queue.length < 40) queue.push(child);
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
      session: session.state(
        authenticated.session.entryUrl,
        new Date(authenticated.session.authenticatedAt),
      ),
      diagnostic: {
        authenticated_pages: authenticated.pages.length,
        initial_links: links.length,
        initial_forms: formRequests.length,
        initial_tab_forms: tabRequests.length,
        requests_visited: visited.size,
        agenda_recognized: recognizedAgenda,
        request_hints: requestHints.join(",").slice(0, 1800),
        ...(sourceAgendaHints?.tab_action_context
          ? { tab_action_context: String(sourceAgendaHints.tab_action_context).slice(0, 1000) }
          : {}),
        ...(sourceAgendaHints?.script_sources
          ? { script_sources: String(sourceAgendaHints.script_sources).slice(0, 1600) }
          : {}),
        ...(sourceAgendaHints?.set_tab_definition
          ? { set_tab_definition: String(sourceAgendaHints.set_tab_definition).slice(0, 1100) }
          : {}),
      },
    };
  }
}

export function maskProjudiLogin(login: string): string {
  const clean = login.trim();
  if (clean.length <= 4) return "••••";
  return `${clean.slice(0, 2)}${"•".repeat(Math.min(8, clean.length - 4))}${clean.slice(-2)}`;
}
