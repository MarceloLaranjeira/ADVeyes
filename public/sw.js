// LEXIA — Service Worker para Push Notifications e PWA
const CACHE_NAME = "lexia-v2";
const APP_SHELL_URL = "/index.html";

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

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  if (isBackendRequest(requestUrl.href)) return;

  // Always fetch navigation requests from network first to avoid stale HTML
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL_URL, responseClone))
          );
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(APP_SHELL_URL)) || Response.error();
        })
    );
    return;
  }

  // Same-origin assets can use cache-first with background refresh
  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(async (cached) => {
        const networkFetch = fetch(event.request)
          .then(async (response) => {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, response.clone());
            return response;
          });

        return cached || networkFetch;
      })
    );
  }
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

// ─── Background Sync (for offline actions) ───────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-notifications") {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  console.log("[SW] Syncing notifications...");
}
