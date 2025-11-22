/* =========================================================
   ЯмаMoto — app.js
   Экраны:
   1) #/order      терминал выбора товаров + QR (СБП)
   2) #/dashboard  табло кухни (готовится/готов) + звук
   3) #/board      публичное табло (номера) + PIN вход/выход
   4) #/builder    конструктор меню + реклама + SBP URL
   ========================================================= */

(() => {
  /* ====== КОНСТАНТЫ / ХРАНИЛИЩЕ ====== */
  const API_URL = "/api/order";
  const CONFIG_REMOTE_URL = ""; // можно оставить пустым

  const DASHBOARD_LS_KEY = "dashboard_orders_v1";
  const CONFIG_LS_KEY = "app_config_v1";
  const SOUND_ON_KEY = "sound_on_v1";

  const TABLO_PIN_OK = "TABLO_PIN_OK";
  const WANT_ROUTE = "WANT_ROUTE";
  const WANT_EXIT_BOARD = "WANT_EXIT_BOARD";

  /* ====== УТИЛИТЫ ====== */
  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  };

  const showToast = (msg) => {
    const t = document.getElementById("toast");
    if (!t) return alert(msg);
    t.textContent = msg;
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 1800);
  };

  const money = (x) => `${x} руб.`;

  const setBodyScrollLock = (on) => {
    document.body.style.overflow = on ? "hidden" : "";
  };

  function safeParse(k, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(k) || "null");
      if (v == null) return fallback;
      if (Array.isArray(fallback)) return Array.isArray(v) ? v : [];
      if (typeof fallback === "object")
        return v && typeof v === "object" ? v : {};
      return v;
    } catch {
      return fallback;
    }
  }

  function loadDash() {
    return safeParse(DASHBOARD_LS_KEY, []);
  }
  function saveDash(list) {
    const arr = Array.isArray(list) ? list : [];
    localStorage.setItem(DASHBOARD_LS_KEY, JSON.stringify(arr));
  }

  /* ===== RPC ===== */
  async function rpc(payload) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {}),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => res.statusText);
      throw new Error(`RPC ${res.status}: ${t}`);
    }
    return res.json();
  }

  /* ====== CONFIG / MENU ====== */
  const DEFAULT_CONFIG = {
    brandTitle: "ЯмаMoto",
    terminalAdUrl: "",
    terminalAdType: "video", // video | gif
    sbpPayBaseUrl: "", // например: https://qr.nspk.ru/xxx  (мы добавим amount и order)
    theme: {
      cardRadius: 20,
      imgRadius: 12,
      imgW: 110,
      imgH: 70,
      cardMinH: 104,
      showPrice: true,
    },
    menu: [
      {
        key: "burgers",
        title: "Бургеры",
        items: [
          {
            name: "Говяжий бургер",
            price: 280,
            img: "https://images.unsplash.com/photo-1603064752734-4c48eff53d05?w=400&auto=format&fit=crop",
          },
          {
            name: "Говяжий двойной",
            price: 440,
            img: "https://images.unsplash.com/photo-1516684541-b4de0a07a2e1?w=400&auto=format&fit=crop",
          },
          {
            name: "Куриный бургер",
            price: 200,
            img: "https://images.unsplash.com/photo-1604908176997-1251882fde0b?w=400&auto=format&fit=crop",
          },
          {
            name: "Куриный двойной",
            price: 250,
            img: "https://images.unsplash.com/photo-1603366615917-1fa6dad5c4fa?w=400&auto=format&fit=crop",
          },
          { name: "Чизбургер", price: 220 },
        ],
      },
      {
        key: "twisters",
        title: "Твистеры",
        items: [
          { name: "Твистер обычный", price: 200 },
          { name: "Твистер обычный с картошкой", price: 220 },
          { name: "Твистер макс", price: 250 },
          { name: "Твистер макс с картошкой", price: 280 },
        ],
      },
      {
        key: "drinks",
        title: "Напитки",
        items: [
          { name: "Добрый кола", price: 100 },
          { name: "Добрый апельсин", price: 100 },
          { name: "Добрый лайм", price: 100 },
          { name: "фдэт-уайт", price: 100 },
          { name: "Раф банан", price: 100 },
          { name: "Эспрессо", price: 100 },
        ],
      },
      {
        key: "sushi",
        title: "Суши / роллы",
        items: [
          { name: "Калифорния", price: 350 },
          { name: "Филадельфия", price: 390 },
          { name: "Аляска", price: 350 },
        ],
      },
      {
        key: "semi",
        title: "Полуфабрикаты",
        items: [
          { name: "Курзе с мясом", price: 160 },
          { name: "Курзе с творогом", price: 210 },
          { name: "хинкал слоенный", price: 190 },
          { name: "Хинкал тонкий", price: 190 },
          { name: "Хинкал толстый", price: 190 },
        ],
      },
    ],
  };

  function loadConfig() {
    return safeParse(CONFIG_LS_KEY, DEFAULT_CONFIG);
  }
  function saveConfig(cfg) {
    localStorage.setItem(
      CONFIG_LS_KEY,
      JSON.stringify(cfg || DEFAULT_CONFIG)
    );
  }

  function applyTheme(theme) {
    const r = document.documentElement;
    r.style.setProperty("--card-radius", (theme.cardRadius || 20) + "px");
    r.style.setProperty("--img-radius", (theme.imgRadius || 12) + "px");
    r.style.setProperty("--img-w", (theme.imgW || 110) + "px");
    r.style.setProperty("--img-h", (theme.imgH || 70) + "px");
    r.style.setProperty("--card-min-h", (theme.cardMinH || 104) + "px");

    const titleEl = document.getElementById("brandTitle");
    if (titleEl) titleEl.textContent = loadConfig().brandTitle || "ЯмаMoto";
  }

  function calcConfigVersion(cfg) {
    try {
      return JSON.stringify((cfg && cfg.menu) || []).length;
    } catch {
      return 0;
    }
  }

  let MENU_CATEGORIES = loadConfig().menu.slice();
  let lastConfigVersion = calcConfigVersion(loadConfig());

  async function fetchRemoteConfig() {
    if (CONFIG_REMOTE_URL) {
      try {
        const res = await fetch(CONFIG_REMOTE_URL, { cache: "no-cache" });
        if (res.ok) {
          const json = await res.json();
          if (json && json.menu) {
            saveConfig(json);
            applyTheme(json.theme || {});
            MENU_CATEGORIES = json.menu.slice();
            return json;
          }
        }
      } catch (e) {
        console.warn("fetchRemoteConfig URL", e);
      }
    }

    try {
      const res = await rpc({ op: "config_get" });
      if (res && res.config && Array.isArray(res.config.menu)) {
        saveConfig(res.config);
        applyTheme(res.config.theme || {});
        MENU_CATEGORIES = res.config.menu.slice();
        return res.config;
      }
    } catch (e) {
      console.warn("fetchRemoteConfig RPC", e);
    }
    return null;
  }

  /* ====== МОДАЛКИ (создаём если нет в index.html) ====== */
  function ensurePayModal() {
    let m = document.getElementById("payModal");
    if (m) return m;

    m = el(`
      <div id="payModal" class="modal">
        <div class="modal-card">
          <div class="modal-title">Подтверждение заказа</div>
          <div id="paySummary" class="modal-summary"></div>
          <div class="modal-actions">
            <button id="payCancel" class="btn btn-ghost">Изменить</button>
            <button id="payOk" class="btn btn-primary">ОК</button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(m);
    return m;
  }

  function ensurePinModal() {
    let m = document.getElementById("pinModal");
    if (m) return m;

    m = el(`
      <div id="pinModal" class="modal">
        <div class="modal-card" style="max-width:320px;text-align:center">
          <div class="modal-title">Введите ключ</div>
          <input id="pinInput" class="pin-input" placeholder="введите ключ" inputmode="text" />
          <div class="modal-actions">
            <button id="pinCancel" class="btn btn-ghost">Отмена</button>
            <button id="pinOk" class="btn btn-primary">ОК</button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(m);
    return m;
  }

  function ensureQrModal() {
    let m = document.getElementById("qrModal");
    if (m) return m;

    m = el(`
      <div id="qrModal" class="modal">
        <div class="modal-card" style="text-align:center">
          <div class="modal-title">Оплата по СБП</div>
          <div class="text-sm text-gray-600">Отсканируйте QR и оплатите заказ</div>
          <img id="qrImg" class="qr-img" alt="QR">
          <a id="qrLink" class="qr-link" href="#" target="_blank" rel="noopener">Открыть ссылку оплаты</a>
          <div class="text-xs text-gray-500 mt-2">Оплата картой — у кассира/терминала POS</div>
          <button id="qrOk" class="btn btn-primary" style="width:100%">Готово</button>
        </div>
      </div>
    `);
    document.body.appendChild(m);

    m.onclick = (e) => {
      if (e.target === m) m.classList.remove("open");
    };
    m.querySelector("#qrOk").onclick = () => m.classList.remove("open");
    return m;
  }

  function openQr(payUrl) {
    const m = ensureQrModal();
    const qi = m.querySelector("#qrImg");
    const ql = m.querySelector("#qrLink");

    if (!payUrl) {
      qi.src = "https://placehold.co/256x256?text=SBP+URL+not+set";
      ql.textContent = "Ссылка оплаты не настроена";
      ql.removeAttribute("href");
    } else {
      const encoded = encodeURIComponent(payUrl);
      qi.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encoded}`;
      ql.href = payUrl;
      ql.textContent = payUrl;
    }

    m.classList.add("open");
  }

  /* ====== АНИМАЦИИ/СКРОЛЛ ====== */
  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function animateScrollX(elm, to, { duration = 280, onEnd } = {}) {
    const from = elm.scrollLeft;
    const diff = to - from;
    if (!diff) {
      onEnd && onEnd();
      return;
    }
    const start = performance.now();
    function step(ts) {
      const t = Math.min(1, (ts - start) / duration);
      elm.scrollLeft = from + diff * easeInOutCubic(t);
      if (t < 1) requestAnimationFrame(step);
      else onEnd && onEnd();
    }
    requestAnimationFrame(step);
  }

  /* =========================================================
     ЭКРАН 1 — ТЕРМИНАЛ
     ========================================================= */
  function OrderView() {
    const cfg = loadConfig();
    applyTheme(cfg.theme || {});
    MENU_CATEGORIES = cfg.menu.slice();

    const escAttr = (val) => {
      if (window.CSS && typeof CSS.escape === "function")
        return CSS.escape(val);
      return String(val).replace(/"/g, '\\"');
    };

    const root = el(`
      <div class="relative pb-24">
        <section class="sticky-top mb-2">
          <div class="glass-panel rounded-2xl px-3 py-3">
            <div id="categoryBar" class="flex gap-2 overflow-x-auto no-scrollbar"></div>
          </div>
        </section>

        <section>
          <div id="catPager" class="no-scrollbar"></div>
        </section>

        <div id="confirmBar" class="confirm-bar">
          <div class="flex items-center justify-between gap-3">
            <div class="text-base">
              <span class="text-gray-600">Итого:</span>
              <b id="totalVal">0 руб.</b>
            </div>
            <button id="confirmBtn" class="btn btn-primary w-44" disabled>Оформить заказ</button>
          </div>
        </div>
      </div>
    `);

    const categoryBar = root.querySelector("#categoryBar");
    const catPager = root.querySelector("#catPager");
    const totalEl = root.querySelector("#totalVal");
    const confirmBtn = root.querySelector("#confirmBtn");

    setBodyScrollLock(true);
    confirmBtn._busy = false;

    let activeIdx = 0;
    let isAnimating = false;
    const scrollMemory = new Map();
    const panelW = () => catPager.getBoundingClientRect().width || 1;

    /* ---------- idle-реклама ---------- */
    const adOverlay = el(`
      <div id="adOverlay" class="fixed inset-0 bg-black hidden z-[9999] flex items-center justify-center">
        <video id="adVideo" class="w-full h-full object-cover hidden" muted loop playsinline></video>
        <img id="adImg" class="w-full h-full object-cover hidden" alt="Реклама" />
      </div>
    `);
    document.body.appendChild(adOverlay);

    function showAd() {
      const c = loadConfig();
      const url = c.terminalAdUrl;
      if (!url) return;

      const v = adOverlay.querySelector("#adVideo");
      const i = adOverlay.querySelector("#adImg");

      adOverlay.classList.remove("hidden");
      if (c.terminalAdType === "gif") {
        v.pause();
        v.classList.add("hidden");
        i.classList.remove("hidden");
        i.src = url;
      } else {
        i.classList.add("hidden");
        v.classList.remove("hidden");
        v.src = url;
        v.play().catch(() => {});
      }
    }
    function hideAd() {
      adOverlay.classList.add("hidden");
    }

    let idleT = null;
    function resetIdle() {
      if (idleT) clearTimeout(idleT);
      hideAd();
      idleT = setTimeout(showAd, 15000);
    }

    ["click", "pointerdown", "touchstart", "scroll", "wheel"].forEach((ev) => {
      root.addEventListener(ev, resetIdle, { passive: true });
    });
    resetIdle();

    /* ---------- chips ---------- */
    cfg.menu.forEach((cat, idx) => {
      categoryBar.appendChild(
        el(`
          <button type="button"
            class="px-3 py-1.5 rounded-full border text-sm whitespace-nowrap ${
              idx === 0
                ? "bg-black text-white border-black"
                : "bg-white/50"
            }"
            data-idx="${idx}">
            ${cat.title}
          </button>
        `)
      );
    });

    function highlightChip(idx) {
      const buttons = categoryBar.querySelectorAll("button");
      buttons.forEach((b, i) => {
        const on = i === idx;
        b.classList.toggle("bg-black", on);
        b.classList.toggle("text-white", on);
        b.classList.toggle("border-black", on);
        if (on)
          b.scrollIntoView({
            inline: "center",
            block: "nearest",
            behavior: "smooth",
          });
      });
    }

    function goToIndex(idx, { animate = true } = {}) {
      idx = Math.max(0, Math.min(cfg.menu.length - 1, idx));
      const target = Math.round(panelW() * idx);
      highlightChip(idx);

      const box = catPager.children[idx]?.querySelector(".v-scroll");

      if (!animate) {
        const old = catPager.children[activeIdx]?.querySelector(".v-scroll");
        if (old) scrollMemory.set(cfg.menu[activeIdx].key, old.scrollTop);
        catPager.scrollLeft = target;
        if (box) box.scrollTop = scrollMemory.get(cfg.menu[idx].key) || 0;
        activeIdx = idx;
        return;
      }

      isAnimating = true;
      const prevSnap = catPager.style.scrollSnapType;
      catPager.style.scrollSnapType = "none";

      const old = catPager.children[activeIdx]?.querySelector(".v-scroll");
      if (old) scrollMemory.set(cfg.menu[activeIdx].key, old.scrollTop);

      animateScrollX(catPager, target, {
        duration: 280,
        onEnd() {
          const box2 = catPager.children[idx]?.querySelector(".v-scroll");
          if (box2)
            box2.scrollTop = scrollMemory.get(cfg.menu[idx].key) || 0;
          activeIdx = idx;
          isAnimating = false;
          catPager.style.scrollSnapType = prevSnap || "x mandatory";
        },
      });
    }

    categoryBar.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-idx]");
      if (!b || isAnimating) return;
      goToIndex(+b.dataset.idx, { animate: true });
    });

    /* ---------- rebuild menu ---------- */
    function rebuildMenu() {
      catPager.innerHTML = "";

      cfg.menu.forEach((cat) => {
        const panel = el(`<div class="cat-panel"></div>`);
        const vbox = el(`<div class="v-scroll px-0.5"></div>`);
        const list = el(`<div class="grid gap-3"></div>`);

        cat.items.forEach((it) => {
          const q = window.__orderCounts?.[it.name] || 0;
          const row = el(`
            <div class="menu-card">
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm">${it.name}</div>
                ${
                  cfg.theme.showPrice
                    ? `<div class="text-xs text-gray-500 mt-1">${money(
                        it.price || 0
                      )}</div>`
                    : ""
                }
                <div class="flex items-center gap-3 mt-3">
                  <button type="button" class="w-8 h-8 rounded-xl border"
                          data-name="${it.name}" data-act="dec">−</button>
                  <div class="w-6 text-center text-sm" data-q="${it.name}">${q}</div>
                  <button type="button" class="w-8 h-8 rounded-xl bg-black text-white"
                          data-name="${it.name}" data-act="inc">+</button>
                </div>
              </div>
              <img src="${it.img || "https://placehold.co/110x70?text=food"}"
                   class="menu-card-img" alt="">
            </div>
          `);
          list.appendChild(row);
        });

        list.appendChild(el(`<div class="h-24"></div>`));
        vbox.appendChild(list);
        panel.appendChild(vbox);
        catPager.appendChild(panel);

        // touch-swipe по категориям
        let down = false,
          used = false,
          sx = 0,
          sy = 0,
          locked = null;
        const PIX_LOCK = 10;
        const THRESH = () => Math.max(40, panelW() * 0.25);

        function onPointerDown(e) {
          if (e.pointerType !== "touch" || isAnimating) return;
          down = true;
          used = false;
          sx = e.clientX;
          sy = e.clientY;
          locked = null;
          vbox.setPointerCapture?.(e.pointerId);
        }
        function onPointerMove(e) {
          if (e.pointerType !== "touch" || !down || used || isAnimating) return;
          const dx = e.clientX - sx,
            dy = e.clientY - sy;

          if (locked === null) {
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > PIX_LOCK)
              locked = "x";
            else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > PIX_LOCK)
              locked = "y";
          }

          if (locked === "x") {
            e.preventDefault();
            if (Math.abs(dx) >= THRESH()) {
              used = true;
              const next = dx < 0 ? activeIdx + 1 : activeIdx - 1;
              goToIndex(next, { animate: true });
            }
          }
        }
        function onPointerUp() {
          down = false;
          used = false;
          locked = null;
        }

        vbox.addEventListener("pointerdown", onPointerDown, { passive: true });
        vbox.addEventListener("pointermove", onPointerMove, {
          passive: false,
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach((evt) =>
          vbox.addEventListener(evt, onPointerUp)
        );
      });
    }

    // делегирование +/−
    catPager.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;

      const name = btn.dataset.name;
      const delta = btn.dataset.act === "inc" ? +1 : -1;
      const selector = `[data-q="${escAttr(name)}"]`;
      const cur =
        parseInt(catPager.querySelector(selector)?.textContent || "0", 10) ||
        0;
      const next = Math.max(0, cur + delta);

      catPager
        .querySelectorAll(selector)
        .forEach((n) => (n.textContent = String(next)));

      window.__orderCounts = window.__orderCounts || {};
      window.__orderCounts[name] = next;
      recalcTotal();
    });

    function applyHeights() {
      try {
        const headerH =
          document.querySelector(".brand-strip")?.getBoundingClientRect()
            .height || 0;
        const chipsH =
          root.querySelector(".sticky-top")?.getBoundingClientRect().height || 0;
        const confirmH =
          root.querySelector("#confirmBar")?.getBoundingClientRect().height || 0;
        const availH = Math.max(
          260,
          window.innerHeight - headerH - chipsH - confirmH - 8
        );

        const first = root.querySelector(".menu-card");
        const cardH = first ? Math.ceil(first.getBoundingClientRect().height) : 104;
        const h = Math.min(availH, cardH * 4 + 12 * 3 + 4);

        root
          .querySelectorAll(".v-scroll")
          .forEach((elm) => (elm.style.height = h + "px"));

        goToIndex(activeIdx, { animate: false });
      } catch {}
    }
    window.addEventListener("resize", applyHeights);

    catPager.addEventListener("scroll", () => {
      if (isAnimating) return;
      if (catPager._scrollTimer) clearTimeout(catPager._scrollTimer);
      catPager._scrollTimer = setTimeout(() => {
        const idx = Math.round(catPager.scrollLeft / panelW());
        if (idx !== activeIdx) {
          highlightChip(idx);
          activeIdx = idx;
        }
      }, 80);
    });

    function recalcTotal() {
      const counts = window.__orderCounts || {};
      let sum = 0;
      cfg.menu.forEach((cat) =>
        cat.items.forEach((it) => {
          sum += (counts[it.name] || 0) * (it.price || 0);
        })
      );
      totalEl.textContent = money(sum);
      confirmBtn.disabled = sum <= 0;
      return sum;
    }

    /* ---------- confirm/pay/QR ---------- */
    const payModal = ensurePayModal();
    const paySummary = payModal.querySelector("#paySummary");
    const payOk = payModal.querySelector("#payOk");
    const payCancel = payModal.querySelector("#payCancel");

    confirmBtn.addEventListener("click", () => {
      const counts = window.__orderCounts || {};
      const items = [];
      let total = 0;

      cfg.menu.forEach((cat) =>
        cat.items.forEach((it) => {
          const q = counts[it.name] || 0;
          if (q > 0) {
            items.push({ name: it.name, qty: q, price: it.price || 0 });
            total += q * (it.price || 0);
          }
        })
      );
      if (!items.length) return;

      paySummary.innerHTML = items
        .map((i) => {
          return `
            <div class="flex items-center justify-between">
              <div class="truncate">${i.name} ×${i.qty}</div>
              <div class="ml-2 whitespace-nowrap">${money(
                i.qty * i.price
              )}</div>
            </div>
          `;
        })
        .join("");

      paySummary.insertAdjacentHTML(
        "beforeend",
        `<div class="mt-2 pt-2 border-t flex items-center justify-between font-semibold">
           <div>Итого</div><div>${money(total)}</div>
         </div>`
      );

      payModal.classList.add("open");
    });

    function resetCounts() {
      window.__orderCounts = {};
      catPager.querySelectorAll("[data-q]").forEach((n) => (n.textContent = "0"));
      totalEl.textContent = money(0);
      confirmBtn.disabled = true;
    }

    function closePay() {
      payModal.classList.remove("open");
      confirmBtn._busy = false;
      confirmBtn.disabled = false;
    }

    payCancel.onclick = (e) => {
      e?.preventDefault();
      e?.stopPropagation();
      closePay();
    };
    payModal.onclick = (e) => {
      if (e.target === payModal) closePay();
    };

    payOk.onclick = async (e) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (confirmBtn._busy) return;
      confirmBtn._busy = true;

      const counts = window.__orderCounts || {};
      const itemsSel = [];
      let total = 0;

      cfg.menu.forEach((cat) =>
        cat.items.forEach((it) => {
          const q = counts[it.name] || 0;
          if (q > 0) {
            itemsSel.push({ name: it.name, qty: q, price: it.price || 0 });
            total += q * (it.price || 0);
          }
        })
      );

      if (!itemsSel.length) {
        closePay();
        return;
      }

      let order;
      try {
        const res = await rpc({
          op: "create",
          items: itemsSel,
          total,
          status: "готовится",
        });

        order = res?.order || {
          id: Date.now().toString().slice(-6),
          createdAt: Date.now(),
          items: itemsSel,
          total,
          status: "готовится",
          pay: "sbp",
        };

        // кладём в локальное табло
        const dash = loadDash();
        dash.unshift(order);
        saveDash(dash.slice(0, 200));
      } catch (err) {
        console.warn("RPC create error", err);
        showToast("Не удалось отправить заказ, попробуйте ещё раз.");
        confirmBtn._busy = false;
        return;
      }

      closePay();
      resetCounts();

      // строим SBP ссылку
      const c2 = loadConfig();
      let payUrl = null;
      if (c2.sbpPayBaseUrl) {
        try {
          const u = new URL(c2.sbpPayBaseUrl);
          u.searchParams.set("amount", String(order.total || total));
          u.searchParams.set("order", String(order.id));
          payUrl = u.toString();
        } catch {}
      }

      openQr(payUrl);
    };

    rebuildMenu();
    requestAnimationFrame(() => {
      highlightChip(0);
      goToIndex(0, { animate: false });
      recalcTotal();
      applyHeights();
    });

    root.cleanup = () => {
      setBodyScrollLock(false);
      window.removeEventListener("resize", applyHeights);
      if (idleT) clearTimeout(idleT);
      adOverlay.remove();
    };

    return root;
  }

  /* =========================================================
     ЭКРАН 2 — ТАБЛО КУХНИ
     ========================================================= */
  function DashboardView() {
    const root = el(`
      <div class="w-full max-w-full mx-auto pb-10 px-4">
        <div class="flex items-center justify-between py-4 flex-wrap gap-2">
          <h2 class="text-2xl font-bold">Табло кухни</h2>

          <div class="flex items-center gap-2">
            <button id="soundToggle" class="btn" title="Звук уведомлений">🔔 Звук</button>
            <a href="#/builder" class="btn">Конструктор</a>
            <a href="#/board" class="btn">Публичное табло</a>
            <button id="clearAll" class="btn" style="background:#fee2e2;color:#991b1b;border-color:#fecaca">Очистить всё</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6" id="gridWrap">
          <div>
            <h3 class="text-xl font-semibold mb-3">ГОТОВИТСЯ</h3>
            <div id="colPreparing" class="grid gap-4"></div>
          </div>

          <div>
            <h3 class="text-xl font-semibold mb-3">ГОТОВ</h3>
            <div id="colReady" class="grid gap-4"></div>
          </div>
        </div>

        <div class="mt-10">
          <button onclick="location.hash='#/order'" class="btn">Выйти</button>
        </div>
      </div>
    `);

    const colPrep = root.querySelector("#colPreparing");
    const colReady = root.querySelector("#colReady");
    const soundBtn = root.querySelector("#soundToggle");
    const ding = document.getElementById("orderDing");

    let dashOrders = loadDash();
    let knownIds = new Set(dashOrders.map((o) => String(o.id)));
    let pollTimer = null;
    let hiddenNewCount = 0;

    const soundOn = () => localStorage.getItem(SOUND_ON_KEY) === "1";
    const setSound = (on) => {
      localStorage.setItem(SOUND_ON_KEY, on ? "1" : "0");
      soundBtn.classList.toggle("bg-green-100", on);
      soundBtn.classList.toggle("border-green-600", on);
    };
    setSound(soundOn());
    soundBtn.onclick = () => setSound(!soundOn());

    function cardOrder(o) {
      return el(`
        <div class="bg-white border rounded-2xl p-4 shadow">
          <div class="flex items-center justify-between">
            <div class="text-3xl font-extrabold">#${o.id}</div>
            <div class="px-3 py-1 rounded-full bg-gray-100 text-sm">${o.status || "готовится"}</div>
          </div>

          <div class="text-sm text-gray-600 mt-1">
            ${o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : ""}
          </div>

          <div class="mt-3 grid gap-1 text-base">
            ${(o.items || []).map(i => `
              <div class="flex justify-between">
                <span>${i.name}</span>
                <span>${i.qty} × ${i.price}</span>
              </div>
            `).join("")}
          </div>

          <div class="text-lg font-bold mt-2">Итого: ${(o.total || 0)} ₽</div>

          <div class="flex gap-2 items-center mt-3">
            <select data-k="status" class="border rounded-xl p-2 text-sm">
              <option ${ (o.status || "готовится") === "готовится" ? "selected" : "" }>готовится</option>
              <option ${ (o.status || "") === "готов" ? "selected" : "" }>готов</option>
            </select>

            <button data-act="save" class="btn">Сохранить</button>
            <button data-act="delete" class="btn ml-auto" style="background:#fee2e2;color:#991b1b;border-color:#fecaca">Удалить</button>
          </div>
        </div>
      `);
    }

    function render() {
      colPrep.innerHTML = "";
      colReady.innerHTML = "";

      dashOrders.forEach((o) => {
        const card = cardOrder(o);

        const sel = card.querySelector('[data-k="status"]');
        const save = card.querySelector('[data-act="save"]');
        const del = card.querySelector('[data-act="delete"]');

        save.onclick = () => {
          const status = sel.value;
          const idx = dashOrders.findIndex((x) => String(x.id) === String(o.id));
          if (idx >= 0) {
            dashOrders[idx].status = status;
            saveDash(dashOrders);
            rpc({ op: "update", id: o.id, patch: { status } }).catch(() => {});
            render();
          }
        };

        del.onclick = () => {
          if (!confirm("Удалить заказ?")) return;
          dashOrders = dashOrders.filter((x) => String(x.id) !== String(o.id));
          saveDash(dashOrders);
          rpc({ op: "delete", id: o.id }).catch(() => {});
          render();
        };

        if ((o.status || "готовится") === "готов")
          colReady.appendChild(card);
        else colPrep.appendChild(card);
      });
    }

    function loadNewSound() {
      const map = new Map(dashOrders.map((o) => [String(o.id), o]));
      const newOnes = [...map.keys()].filter((id) => !knownIds.has(id));

      if (newOnes.length) {
        if (document.visibilityState === "visible" && soundOn()) {
          try {
            ding.currentTime = 0;
            ding.play().catch(() => {});
          } catch {}
        } else {
          hiddenNewCount += newOnes.length;
        }
      }
      knownIds = new Set(map.keys());
      render();
    }

    async function loadFromCloud() {
      try {
        const res = await rpc({ op: "list" });
        if (Array.isArray(res.orders)) {
          dashOrders = res.orders.slice();
          saveDash(dashOrders);
          loadNewSound();
        }
      } catch (e) {
        console.warn(e);
      }
    }

    root.querySelector("#clearAll").onclick = async () => {
      if (!confirm("Удалить ВСЕ заказы?")) return;

      const ids = dashOrders.map((o) => o.id);
      dashOrders = [];
      saveDash([]);
      render();

      try {
        await rpc({ op: "clear" });
      } catch {
        for (const id of ids) {
          try {
            await rpc({ op: "delete", id });
          } catch {}
        }
      }
    };

    loadFromCloud();
    pollTimer = setInterval(loadFromCloud, 5000);

    root.cleanup = () => {
      if (pollTimer) clearInterval(pollTimer);
    };

    return root;
  }

  /* =========================================================
     ЭКРАН 3 — ПУБЛИЧНОЕ ТАБЛО
     ========================================================= */
  function PublicBoardView() {
    const root = el(`
      <div class="w-full h-full px-6 py-4 board-dark">
        <div class="grid grid-cols-2 gap-6 mb-4">
          <div class="text-center text-3xl font-extrabold tracking-wide">ГОТОВИТСЯ</div>
          <div class="text-center text-3xl font-extrabold tracking-wide">ГОТОВ</div>
        </div>

        <div class="grid grid-cols-2 gap-6 h-[calc(100vh-120px)]">
          <div id="prepCol" class="grid gap-3 content-start"></div>
          <div id="readyCol" class="grid gap-3 content-start"></div>
        </div>

        <!-- скрытая зона 4-тапа снизу справа -->
        <div id="publicHotZone"
             style="position:fixed; right:0; bottom:0; width:220px; height:140px; z-index:9999; opacity:0;">
        </div>
      </div>
    `);

    const prepCol = root.querySelector("#prepCol");
    const readyCol = root.querySelector("#readyCol");
    const hotZone = root.querySelector("#publicHotZone");

    let orders = [];
    let pollTimer = null;

    function numCard(id) {
      return el(`<div class="board-num">${id}</div>`);
    }

    function render() {
      prepCol.innerHTML = "";
      readyCol.innerHTML = "";

      const prep = orders.filter((o) => (o.status || "готовится") !== "готов");
      const ready = orders.filter((o) => (o.status || "") === "готов");

      if (!prep.length)
        prepCol.appendChild(
          el(`<div class="text-gray-400 text-2xl font-semibold">—</div>`)
        );
      if (!ready.length)
        readyCol.appendChild(
          el(`<div class="text-gray-400 text-2xl font-semibold">—</div>`)
        );

      prep.forEach((o) => prepCol.appendChild(numCard(o.id)));
      ready.forEach((o) => readyCol.appendChild(numCard(o.id)));
    }

    async function loadFromCloud() {
      try {
        const res = await rpc({ op: "list" });
        if (Array.isArray(res.orders)) {
          orders = res.orders.slice();
          saveDash(orders);
          render();
        }
      } catch (e) {}
    }

    loadFromCloud();
    pollTimer = setInterval(loadFromCloud, 4000);

    // 4-тапа → PIN → выход на терминал
    (function bindHiddenExit() {
      if (!hotZone || hotZone._bound) return;
      hotZone._bound = true;

      let taps = 0,
        first = 0,
        timer = null;
      const windowMs = 1200;

      const reset = () => {
        taps = 0;
        first = 0;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const handler = () => {
        const now = Date.now();
        if (!first) first = now;
        taps++;
        if (now - first > windowMs) {
          reset();
          taps = 1;
          first = now;
        }

        if (taps >= 4) {
          reset();
          sessionStorage.setItem(WANT_EXIT_BOARD, "1");
          ensurePinModal().classList.add("open");
        } else {
          if (timer) clearTimeout(timer);
          timer = setTimeout(reset, windowMs);
        }
      };

      ["click", "pointerup", "touchend"].forEach((ev) =>
        hotZone.addEventListener(
          ev,
          (e) => {
            e.preventDefault();
            e.stopPropagation();
            handler();
          },
          { passive: false }
        )
      );
    })();

    root.cleanup = () => {
      if (pollTimer) clearInterval(pollTimer);
    };

    return root;
  }

  /* =========================================================
     КОНСТРУКТОР МЕНЮ
     ========================================================= */
  function BuilderView() {
    const cfg = loadConfig();

    const root = el(`
      <div class="grid gap-4 pb-28 shell">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h2 class="text-lg font-semibold">Конструктор меню</h2>
          <div class="flex gap-2">
            <button id="exportBtn" class="btn">Экспорт JSON</button>
            <label class="btn" style="cursor:pointer">
              Импорт JSON<input id="importInput" type="file" accept="application/json" class="hidden">
            </label>
            <button id="backBtn2" class="btn">Назад</button>
          </div>
        </div>

        <section class="card p-4 grid gap-2">
          <h3 class="font-semibold">Реклама на терминале</h3>
          <input id="adUrlInput" class="border rounded-xl p-3 w-full" placeholder="URL видео/гиф" value="${cfg.terminalAdUrl || ""}">
          <select id="adTypeInput" class="border rounded-xl p-3 w-full">
            <option value="video" ${cfg.terminalAdType==="video" ? "selected":""}>Видео</option>
            <option value="gif" ${cfg.terminalAdType==="gif" ? "selected":""}>GIF/картинка</option>
          </select>

          <h3 class="font-semibold mt-2">СБП ссылка (base URL)</h3>
          <input id="sbpBaseInput" class="border rounded-xl p-3 w-full" placeholder="https://...." value="${cfg.sbpPayBaseUrl || ""}">
          <div class="text-xs text-gray-500">Мы добавим параметры amount и order автоматически</div>
        </section>

        <section class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">Категории и товары</h3>
            <button id="addCatBtn" class="btn">+ Категория</button>
          </div>
          <div id="catsBox" class="grid gap-4"></div>
        </section>

        <div class="flex gap-2">
          <button id="applyBtn" class="btn btn-primary">Сохранить и обновить меню</button>
        </div>
      </div>
    `);

    const catsBox = root.querySelector("#catsBox");

    function render() {
      catsBox.innerHTML = "";
      cfg.menu.forEach((cat, cidx) => {
        const catCard = el(`
          <div class="border rounded-2xl p-3 bg-white">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <input value="${cat.title}" class="border rounded-xl p-2 font-semibold min-w-[140px]" data-k="title">
              <div class="flex gap-2">
                <button class="btn" data-act="up">↑</button>
                <button class="btn" data-act="down">↓</button>
                <button class="btn" data-act="del" style="color:#b91c1c">Удалить</button>
              </div>
            </div>
            <div class="text-xs text-gray-500 mt-1">key: <code>${cat.key}</code></div>

            <div class="mt-3">
              <button class="btn" data-act="addItem">+ Товар</button>
            </div>

            <div class="mt-3 grid gap-2" data-items></div>
          </div>
        `);

        const itemsBox = catCard.querySelector("[data-items]");

        cat.items.forEach((it, iidx) => {
          const row = el(`
            <div class="grid grid-cols-12 gap-2 border rounded-xl p-2">
              <input class="col-span-5 border rounded-lg p-2" placeholder="Название" value="${it.name||""}" data-k="name">
              <input class="col-span-2 border rounded-lg p-2" type="number" placeholder="Цена" value="${it.price||0}" data-k="price">
              <input class="col-span-4 border rounded-lg p-2" placeholder="URL фото" value="${it.img||""}" data-k="img">
              <div class="col-span-1 flex items-center gap-1 justify-end">
                <button class="btn" data-act="iUp">↑</button>
                <button class="btn" data-act="iDown">↓</button>
                <button class="btn" data-act="iDel" style="color:#b91c1c">✕</button>
              </div>
            </div>
          `);

          row.addEventListener("input", (e) => {
            const k = e.target.dataset.k;
            if (!k) return;
            if (k === "price") cat.items[iidx][k] = Number(e.target.value || 0);
            else cat.items[iidx][k] = e.target.value;
          });

          row.addEventListener("click", (e) => {
            const act = e.target.dataset.act;
            if (!act) return;

            if (act === "iDel") {
              cat.items.splice(iidx, 1);
              render();
            }
            if (act === "iUp" && iidx > 0) {
              const t = cat.items[iidx - 1];
              cat.items[iidx - 1] = cat.items[iidx];
              cat.items[iidx] = t;
              render();
            }
            if (act === "iDown" && iidx < cat.items.length - 1) {
              const t = cat.items[iidx + 1];
              cat.items[iidx + 1] = cat.items[iidx];
              cat.items[iidx] = t;
              render();
            }
          });

          itemsBox.appendChild(row);
        });

        catCard.addEventListener("input", (e) => {
          if (e.target.dataset.k === "title") cat.title = e.target.value;
        });

        catCard.addEventListener("click", (e) => {
          const act = e.target.dataset.act;
          if (!act) return;

          if (act === "del") {
            if (confirm("Удалить категорию?")) {
              cfg.menu.splice(cidx, 1);
              render();
            }
          }

          if (act === "up" && cidx > 0) {
            const t = cfg.menu[cidx - 1];
            cfg.menu[cidx - 1] = cfg.menu[cidx];
            cfg.menu[cidx] = t;
            render();
          }

          if (act === "down" && cidx < cfg.menu.length - 1) {
            const t = cfg.menu[cidx + 1];
            cfg.menu[cidx + 1] = cfg.menu[cidx];
            cfg.menu[cidx] = t;
            render();
          }

          if (act === "addItem") {
            cat.items.push({ name: "Новый товар", price: 0, img: "" });
            render();
          }
        });

        catsBox.appendChild(catCard);
      });
    }
    render();

    root.querySelector("#addCatBtn").onclick = () => {
      const id = "cat" + Date.now().toString().slice(-5);
      cfg.menu.push({ key: id, title: "Новая категория", items: [] });
      render();
    };

    root.querySelector("#exportBtn").onclick = () => {
      const blob = new Blob([JSON.stringify(cfg, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "yamamoto-config.json";
      a.click();
      URL.revokeObjectURL(a.href);
    };

    root.querySelector("#importInput").onchange = (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const json = JSON.parse(fr.result);
          saveConfig(json);
          showToast("Импортирован конфиг");
          location.reload();
        } catch {
          alert("Неверный JSON");
        }
      };
      fr.readAsText(f);
    };

    root.querySelector("#applyBtn").onclick = async () => {
      cfg.terminalAdUrl =
        root.querySelector("#adUrlInput").value.trim();
      cfg.terminalAdType =
        root.querySelector("#adTypeInput").value;
      cfg.sbpPayBaseUrl =
        root.querySelector("#sbpBaseInput").value.trim();

      saveConfig(cfg);
      applyTheme(cfg.theme);
      MENU_CATEGORIES = cfg.menu.slice();

      try {
        await rpc({ op: "config_set", config: cfg });
        showToast("Меню сохранено (сервер)");
      } catch (e) {
        console.warn("config_set error", e);
        showToast("Меню сохранено локально, сервер недоступен");
      }

      location.hash = "#/dashboard";
    };

    root.querySelector("#backBtn2").onclick = () =>
      history.length ? history.back() : (location.hash = "#/dashboard");

    return root;
  }

  /* =========================================================
     ROUTER / MOUNT
     ========================================================= */
  function mount(view) {
    const app = document.getElementById("app");
    if (!app) return;

    if (app.firstChild && typeof app.firstChild.cleanup === "function") {
      try {
        app.firstChild.cleanup();
      } catch {}
    }
    app.innerHTML = "";
    app.classList.add("shell");
    app.appendChild(view);
  }

  function realRouter() {
    const h = location.hash.split("?")[0];

    if (h === "#/dashboard") mount(DashboardView());
    else if (h === "#/board") mount(PublicBoardView());
    else if (h === "#/builder") mount(BuilderView());
    else mount(OrderView());
  }

  function router() {
    const h = location.hash.split("?")[0];

    // PIN защита на админ-экраны
    if (
      (h === "#/dashboard" || h === "#/board" || h === "#/builder") &&
      sessionStorage.getItem(TABLO_PIN_OK) !== "1"
    ) {
      sessionStorage.setItem(WANT_ROUTE, h);
      ensurePinModal().classList.add("open");
      const app = document.getElementById("app");
      if (app) app.innerHTML = "";
      return;
    }

    realRouter();
  }

  window.addEventListener("hashchange", () => {
    try {
      router();
    } catch (e) {
      console.error(e);
    }
  });

  /* =========================================================
     PIN логика + плавающая кнопка табло
     ========================================================= */
  document.addEventListener("DOMContentLoaded", async () => {
    // default route
    if (!location.hash || location.hash === "#" || location.hash === "#/")
      location.hash = "#/order";

    // плавающая кнопка входа на табло кухни
    const openDashBtn = document.getElementById("openDashBtn");
    if (openDashBtn) {
      openDashBtn.onclick = () => (location.hash = "#/dashboard");
    }

    // подтянуть конфиг сразу
    await fetchRemoteConfig().catch(() => {});

    // PIN modal handlers
    const pinM = ensurePinModal();
    const pinOk = pinM.querySelector("#pinOk");
    const pinCancel = pinM.querySelector("#pinCancel");
    const pinInput = pinM.querySelector("#pinInput");

    pinOk.onclick = (e) => {
      e?.preventDefault();
      if ((pinInput.value || "").length > 0) {
        pinM.classList.remove("open");

        // выход из board по PIN
        if (sessionStorage.getItem(WANT_EXIT_BOARD) === "1") {
          sessionStorage.removeItem(WANT_EXIT_BOARD);
          sessionStorage.removeItem(TABLO_PIN_OK); // сбросить авторизацию
          location.hash = "#/order";
          return;
        }

        sessionStorage.setItem(TABLO_PIN_OK, "1");

        const want = sessionStorage.getItem(WANT_ROUTE);
        sessionStorage.removeItem(WANT_ROUTE);

        location.hash = want || "#/dashboard";
      } else {
        showToast("Введите ключ");
      }
    };

    pinCancel.onclick = () => {
      pinM.classList.remove("open");
      sessionStorage.removeItem(WANT_ROUTE);
      sessionStorage.removeItem(WANT_EXIT_BOARD);
      location.hash = "#/order";
    };

    pinM.onclick = (e) => {
      if (e.target === pinM) pinCancel.onclick();
    };

    // стартуем
    try {
      router();
    } catch (e) {
      console.error(e);
    }
  });
})();
