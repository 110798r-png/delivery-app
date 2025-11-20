// ----------- SAFE SW FOR YOUR DELIVERY APP -----------

const CACHE_NAME = 'static-v2';

self.addEventListener("install", (event) => {
  // сразу активируем новую версию SW
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)   // удаляем старые кэши
          .map(k => caches.delete(k))
      )
    )
  );
  clients.claim(); // сразу начинаем контролировать страницы
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1) Никогда не перехватываем API-запросы (и /rpc, и /api/…)
  if (url.pathname.endsWith("/rpc") || url.pathname.startsWith("/api/")) {
    return;
  }

  // 2) Не трогаем небезопасные методы (POST/PUT/DELETE и т.п.)
  if (event.request.method !== "GET") {
    return;
  }

  // 3) Кэшируем только статику (стратегия: network-first с записью в кэш)
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
