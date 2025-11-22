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
