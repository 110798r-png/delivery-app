// sw.js — одноразовый "убийца" старых кэшей

self.addEventListener('install', (event) => {
  // сразу активируемся
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      // 1. Чистим все кэши, которые старый SW создавал
      if (self.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      // 2. Отвязываем себя
      if (self.registration && self.registration.unregister) {
        await self.registration.unregister();
      }

      console.log('SW: caches cleared & unregistered');
    } catch (e) {
      console.warn('SW cleanup error', e);
    }
  })());
});

// 3. НИЧЕГО не перехватываем — просто пропускаем все запросы
self.addEventListener('fetch', () => {
  // пусто
});
