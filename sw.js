// sw.js — временно выключаем оффлайн и кэширование,
// просто аккуратно "самоуничтожаем" сервис-воркер

self.addEventListener('install', (event) => {
  // сразу активируемся
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Забираем управление открытыми вкладками
        await self.clients.claim();
      } finally {
        // И тут же сами себя удаляем
        await self.registration.unregister();
      }
    })()
  );
});

// На всякий случай ничего не перехватываем
// (все запросы идут напрямую в сеть)
