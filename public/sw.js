// LEXIA — Service Worker para Push Notifications e PWA
const CACHE_NAME = "lexia-v5";

const isBackendRequest = (url) =>
  url.includes("/rest/v1/") ||
  url.includes("/auth/v1/") ||
  url.includes("/storage/v1/") ||
  url.includes("/functions/v1/") ||
  url.includes("supabase");

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

// ─── Activate — apaga TODOS os caches antigos ─────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch — Network First para tudo (nunca serve JS/CSS antigo) ──────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  // Não intercepta requisições do Supabase
  if (isBackendRequest(requestUrl.href)) return;

  // Não intercepta recursos de outros domínios
  if (requestUrl.origin !== self.location.origin) return;

  // Assets com hash no nome (JS/CSS bundles) — network first, sem cache
  const isHashedAsset = /\/assets\/.*\.[a-f0-9]{8,}\.(js|css|mjs)/.test(requestUrl.pathname);
  if (isHashedAsset) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      })
    );
    return;
  }

  // Navegação (HTML) — network first, fallback para cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || Response.error();
        })
    );
    return;
  }

  // Outros assets estáticos (imagens, fontes) — cache first
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, response.clone());
      return response;
    })
  );
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "LEXIA", body: event.data.text(), icon: "/favicon.ico" };
  }

  const options = {
    body: data.body || "Nova notificação do escritório",
    icon: data.icon || "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "lexia-notification",
    data: { url: data.url || "/" },
    requireInteraction: data.urgent || false,
    actions: data.actions || [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Dispensar" },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "LEXIA", options)
  );
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
