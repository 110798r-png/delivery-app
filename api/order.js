// api/order.js — proxy с Vercel к Яндекс API Gateway (с API KEY)

const YC_URL = "https://d5d7caefb63stl1hpehg.y5sm01em.apigw.yandexcloud.net/rpc";

// если в gateway включили API Key — кладём его в ENV на Vercel
const YC_API_KEY = process.env.YC_API_KEY || ""; // <-- добавишь в Vercel

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});

    const headers = { "Content-Type": "application/json" };

    // ✅ пробуем оба популярных варианта (оставь тот, который нужен твоему gateway)
    // 1) x-api-key
    if (YC_API_KEY) headers["x-api-key"] = YC_API_KEY;
    // 2) Authorization: Api-Key xxx  (если у тебя именно так настроено)
    // if (YC_API_KEY) headers["Authorization"] = `Api-Key ${YC_API_KEY}`;

    const ycRes = await fetch(YC_URL, {
      method: "POST",
      headers,
      body,
    });

    const text = await ycRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return res.status(ycRes.status).json(data);
  } catch (err) {
    console.error("YC proxy error:", err);
    // лучше честно вернуть 502, чтобы фронт видел, что сервер реально упал
    return res.status(502).json({ error: "proxy-failed" });
  }
};
