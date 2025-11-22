// api/order.js
// Vercel / Node serverless function.
// Хранит заказы и конфиг меню.
// Для Vercel файл сохраняется в /tmp (эпhemeral), для обычного Node — рядом в папке data.

const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = {
  brandTitle: "ЯмаMoto",
  terminalAdUrl: "",
  terminalAdType: "video",
  sbpPayBaseUrl: "",
  theme: { cardRadius: 20, imgRadius: 12, imgW: 110, imgH: 70, cardMinH: 104, showPrice: true },
  menu: [],
};

const TMP_PATH = path.join("/tmp", "yamamoto_store.json");
const LOCAL_PATH = path.join(process.cwd(), "data", "yamamoto_store.json");
const STORE_PATH = process.env.STORE_PATH || (fs.existsSync("/tmp") ? TMP_PATH : LOCAL_PATH);

let store = {
  orders: [],
  config: null,
  _loaded: false,
};

function ensureDir(p) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  } catch {}
}

function loadStore() {
  if (store._loaded) return store;
  store._loaded = true;

  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf8");
      const json = JSON.parse(raw || "{}");
      store.orders = Array.isArray(json.orders) ? json.orders : [];
      store.config = json.config || null;
    }
  } catch (e) {
    // если сломан json — начнём с нуля
    store.orders = [];
    store.config = null;
  }

  if (!store.config) store.config = DEFAULT_CONFIG;
  return store;
}

function saveStore() {
  try {
    ensureDir(STORE_PATH);
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({ orders: store.orders, config: store.config }, null, 2),
      "utf8"
    );
  } catch (e) {
    // на vercel может молча не записать — ок, останется в памяти
  }
}

function normalizeCreatePayload(body) {
  // поддержка форматов:
  // {op:'create', items:[...], total:123}
  // {op:'create', data:{items:[...], total:123, status:'готовится', pay:'sbp'}}
  const data = body.data && typeof body.data === "object" ? body.data : body;
  const items = Array.isArray(data.items) ? data.items : [];
  const total = Number(data.total || 0) || 0;
  const status = data.status || "готовится";
  const pay = data.pay || null;
  const clientId = data.clientId || null;
  return { items, total, status, pay, clientId };
}

function genId() {
  const ids = new Set(store.orders.map((o) => String(o.id)));
  let base = Date.now().toString().slice(-6);
  if (!ids.has(base)) return base;

  // если вдруг совпало — увеличим на 1, пока не найдём свободный
  let n = Number(base) || 0;
  while (ids.has(String(n))) n++;
  return String(n);
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  // CORS чтобы все экраны по LAN могли стучаться
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST,GET,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end("ok");
  }

  if (req.method !== "POST") {
    return send(res, 405, { ok: false, error: "Only POST supported" });
  }

  loadStore();

  let body = {};
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch {
    body = {};
  }

  const op = body.op;

  try {
    if (op === "list") {
      return send(res, 200, { ok: true, orders: store.orders });
    }

    if (op === "create") {
      const { items, total, status, pay, clientId } = normalizeCreatePayload(body);

      const order = {
        id: genId(),
        createdAt: Date.now(),
        items,
        total,
        status,
        pay,
        clientId,
      };

      store.orders.unshift(order);
      store.orders = store.orders.slice(0, 500);
      saveStore();

      return send(res, 200, { ok: true, order });
    }

    if (op === "update") {
      const id = String(body.id || "");
      const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
      const idx = store.orders.findIndex((o) => String(o.id) === id);

      if (idx < 0) return send(res, 404, { ok: false, error: "Order not found" });

      store.orders[idx] = { ...store.orders[idx], ...patch };
      saveStore();

      return send(res, 200, { ok: true, order: store.orders[idx] });
    }

    if (op === "delete") {
      const id = String(body.id || "");
      store.orders = store.orders.filter((o) => String(o.id) !== id);
      saveStore();
      return send(res, 200, { ok: true });
    }

    if (op === "clear") {
      store.orders = [];
      saveStore();
      return send(res, 200, { ok: true });
    }

    if (op === "config_get") {
      if (!store.config) store.config = DEFAULT_CONFIG;
      return send(res, 200, { ok: true, config: store.config });
    }

    if (op === "config_set") {
      const cfg = body.config && typeof body.config === "object" ? body.config : null;
      if (!cfg || !Array.isArray(cfg.menu)) {
        return send(res, 400, { ok: false, error: "Bad config payload" });
      }
      store.config = cfg;
      saveStore();
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { ok: false, error: "Unknown op" });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e.message || e) });
  }
};
