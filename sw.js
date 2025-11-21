// sw.js — аккуратный SW: API не трогаем, HTML всегда из сети, статику кэшируем

const CACHE_NAME = 'static-v5';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Никогда не трогаем API (/rpc, /api/...)
  if (url.pathname.endsWith('/rpc') || url.pathname.startsWith('/api/')) {
    return;
  }

  // 2) Только GET
  if (req.method !== 'GET') {
    return;
  }

  const accept = req.headers.get('accept') || '';

  // 3) Для HTML — сеть в приоритете (чтобы код всегда был свежий)
  if (accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 4) Для остальной статики — cache first
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })
  );
});
