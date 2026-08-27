const CACHE_NAME = "analiza-casa-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/app/styles.css",
  "/app/main.js",
  "/app/views.js",
  "/app/store.js",
  "/app/domain.js",
  "/app/config.js",
  "/app/mock-data.js",
  "/app/templates.js",
  "/app/supabase-adapter.js",
  "/assets/favicon.svg",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok && !event.request.url.includes("/api/")) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html"))));
});
