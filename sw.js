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

    // 1) Не перехватываем RPC → даём идти напрямую
    if (url.pathname.endsWith("/rpc")) return;

    // 2) Не трогаем POST
    if (event.request.method !== "GET") {
        return; // пропускаем
    }

    // 3) Остальное можно кешировать если хочешь
    event.respondWith(
        caches.open("static-v1").then(async (cache) => {
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
