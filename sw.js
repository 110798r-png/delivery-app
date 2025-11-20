// ----------- SAFE SW FOR YOUR DELIVERY APP -----------

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    clients.claim();
});

// Не трогаем и не кэшируем RPC (иначе всё ломается!)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1) Никогда не перехватываем API-запросы (и /rpc, и /api/...)
  if (url.pathname.endsWith("/rpc") || url.pathname.startsWith("/api/")) {
    return;
  }

  // 2) Не трогаем небезопасные методы (POST/PUT/DELETE и т.п.)
  if (event.request.method !== "GET") {
    return;
  }

  // 3) Кешируем только статику
  event.respondWith(
    const CACHE_NAME = 'static-v2';

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.endsWith("/rpc") || url.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const fresh = await fetch(event.request);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })
  );
});
