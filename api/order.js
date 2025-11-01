// api/order.js
export default async function handler(req, res) {
  // разрешаем только POST, как у тебя
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const YC_URL = 'https://d5d1ec44lv5uk5k7k9to.bixf7e87.apigw.yandexcloud.net/order';

  try {
    const ycRes = await fetch(YC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // тело, которое прислал браузер, просто перекидываем в Яндекс
      body: JSON.stringify(req.body),
    });

    const data = await ycRes.json();
    // пробрасываем статус Яндекса (на всякий случай)
    return res.status(ycRes.status).json(data);
  } catch (err) {
    console.error('YC proxy error', err);
    return res.status(500).json({ error: 'proxy_failed' });
  }
}
