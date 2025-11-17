// sw.js

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Уведомление', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'ЯмаMoto';
  const body  = data.body  || 'Новое уведомление';
  const icon  = data.icon  || '/icon-192.png'; // положишь свой логотип
  const url   = data.url   || '/#/history';

  const options = {
    body,
    icon,
    badge: icon,
    data: { url },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/#/history';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      for (const client of clientsArr) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
