// api/order.js

export default async function handler(req, res) {
  // Vercel всегда даёт сюда тело уже распарсенное как объект (если json)
  const ycUrl = 'https://d5d1ec44lv5uk5k7k9to.bixf7e87.apigw.yandexcloud.net/order';

  try {
    const ycRes = await fetch(ycUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // если вдруг пришла строка — всё равно отправим строкой
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    });

    // если Яндекс ответил НЕ 200 — всё равно пробросим то, что пришло
    const text = await ycRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    res.status(ycRes.status).json(data);
  } catch (err) {
    console.error('YC proxy error:', err);
    // фронт поймёт это и сохранит заказ локально
    res.status(200).json({ error: 'proxy-failed' });
  }
}
