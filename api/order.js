// api/order.js — proxy с Vercel к Яндекс API Gateway

const YC_URL = 'https://d5d1ec44lv5uk5k7k9to.bixf7e87.apigw.yandexcloud.net/rpc';

module.exports = async function handler(req, res) {
  // Разрешим только POST, остальное — 405
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});

    const ycRes = await fetch(YC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const text = await ycRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    // просто прокидываем статус и тело дальше
    res.status(ycRes.status).json(data);
  } catch (err) {
    console.error('YC proxy error:', err);
    // фронт это поймёт и покажет ошибку / сохранит локально
    res.status(200).json({ error: 'proxy-failed' });
  }
};
// sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ✅ ПРИХОДИТ PUSH → ПОКАЗЫВАЕМ УВЕДОМЛЕНИЕ
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {}

  const title = data.title || 'ЯмаMoto';
  const body  = data.body  || 'Обновление заказа';
  const url   = data.url   || '/#/history';

  const options = {
    body,
    icon: data.icon || '/icon-192.png',   // если нет иконки — не критично
    badge: data.badge || '/badge-72.png',
    data: { url }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ✅ КЛИК ПО УВЕДОМЛЕНИЮ → ОТКРЫВАЕМ ПРИЛОЖЕНИЕ
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

