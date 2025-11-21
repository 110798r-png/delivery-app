// sw.js — SW: пуши, HTML из сети, статика из кэша

const CACHE_NAME = 'static-v6';

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ===== ACTIVATE =====
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

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) API никогда не кэшируем
  if (url.pathname.endsWith('/rpc') || url.pathname.startsWith('/api/')) {
    return;
  }

  // 2) Только GET
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';

  // 3) HTML → always network first
  if (accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 4) Остальная статика → cache first
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

// ======================================================
// =================== PUSH HANDLERS ====================
// ======================================================

// ===== PUSH RECEIVE =====
self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.warn('Push JSON parse error', e);
  }

  const title = data.title || 'Заказ обновлён';
  const body  = data.body  || '';
  const url   = data.url   || '/#/history';

  const options = {
    body,
    icon: '/icons/icon-192.png',   // можешь заменить
    badge: '/icons/badge.png',     // можешь удалить
    data: { url }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('/')) {
          client.navigate(url);
          client.focus();
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
