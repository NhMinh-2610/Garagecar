/* Update by changing the cache version. Never intercept authenticated API requests. */
const CACHE = "autopro-public-shell-v7";
const FILES = [
  "/static/shared/icons.svg",
  "/static/shared/garage-illustration.svg",
  "/static/shared/public.css",
  "/static/index.html",
  "/static/script.js",
  "/static/shared/workspace.js",
  "/static/shared/tables.js",
  "/static/shared/records.css",
  "/static/demo/maintenance.html",
  "/static/shared/messaging.js",
  "/static/shared/messaging.css",
  "/static/shared/chat.css",
  "/static/customer/js/chat.js",
  "/static/shared/evidence.js",
  "/static/shared/professional.js",
  "/static/shared/professional.css",
  "/static/advisor/index.html",
  "/static/accountant/index.html",
  "/static/hr/index.html",
  "/static/staff/app.js",
  "/static/offline.html",
  "/static/shared/ui.css",
  "/static/shared/workspace.css",
  "/static/shared/portals.css",
  "/static/shared/care.css",
  "/static/shared/core.js",
  "/static/shared/portal.js",
  "/static/shared/session.js",
  "/static/shared/access.js",
  "/static/shared/pwa.js",
  "/static/shared/maintenance.js",
  "/static/shared/service.js",
  "/static/manifest.webmanifest",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/login/index.html",
  "/static/login/styles.css",
  "/static/login/script.js",
  "/static/customer/index.html",
  "/static/customer/js/workspace.js",
  "/static/mechanic/index.html",
  "/static/mechanic/js/tasks.js",
  "/static/mechanic/js/inventory.js",
  "/static/shared/booking.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("autopro-public-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    event.request.headers.has("Authorization")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        async () =>
          (await caches.match(url.pathname)) || (await caches.match("/static/offline.html")),
      ),
    );
    return;
  }
  if (FILES.includes(url.pathname))
    event.respondWith(fetch(event.request).catch(() => caches.match(url.pathname)));
});
