// ==== ПОЛИФИЛЫ ДЛЯ СТАРЫХ/КАПРИЗНЫХ БРАУЗЕРОВ ====

// matches
if (!Element.prototype.matches) {
  Element.prototype.matches =
    Element.prototype.msMatchesSelector ||
    Element.prototype.webkitMatchesSelector ||
    function (selector) {
      const matches = (this.document || this.ownerDocument).querySelectorAll(selector);
      let i = matches.length;
      while (--i >= 0 && matches.item(i) !== this) {}
      return i > -1;
    };
}

// closest
if (!Element.prototype.closest) {
  Element.prototype.closest = function (selector) {
    let el = this;
    while (el && el.nodeType === 1) {
      if (el.matches(selector)) return el;
      el = el.parentElement || el.parentNode;
    }
    return null;
  };
}

// CSS.escape
if (!window.CSS) window.CSS = {};
if (typeof window.CSS.escape !== 'function') {
  window.CSS.escape = function (value) {
    return String(value).replace(/"/g, '\\"');
  };
}
/* ====== КОНСТАНТЫ ====== */
const API_URL = '/api/order';
const CONFIG_REMOTE_URL = '';
const BRAND_ICON_URL = 'https://storage.yandexcloud.net/audio123/free-icon-hot-coffee-3447211.png';
const BRAND_TITLE = 'ZM TIME';  // изменишь тут — поменяется в шапке и во вкладке
// === PUSH / VAPID ===
const VAPID_PUBLIC = 'BOdctEWx7fxuRtJB65AgcmgftUtHbFTBXX7qnpMCs5Bvh_hCErbrI18SGVzCJC8IoxP5LnMhjasuDlOvkgvbLRg';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}  
async function initPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push not supported');
    return;
  }

  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
      });
    } catch (e) {
      console.warn('Push subscribe error', e);
      return;
    }
  }

  try {
    await rpc({
      op: 'push_subscribe',
      clientId: getClientId(),
      subscription: sub
    });
  } catch (e) {
    console.warn('push_subscribe RPC error', e);
  }
}

const ADMIN_KEY_SS       = 'ADMIN_KEY_SESSION';

/* ===== RPC ===== */
async function rpc(payload){
  if (!API_URL) throw new Error('API_URL empty');

  const p = payload || {};
  const op = p.op;

  // операции, требующие adminKey на бэке
  const ADMIN_OPS = new Set([
    'setUnavailable',
    'stock_set',
    'config_set',
    'update',
    'delete',
    'clear'
  ]);

  // если операция админская — подмешиваем ключ из sessionStorage
  if (ADMIN_OPS.has(op)) {
    const adminKey = sessionStorage.getItem(ADMIN_KEY_SS) || '';
    if (adminKey) {
      p.adminKey = adminKey;
    }
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify(p)
  });

  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`RPC ${res.status}: ${t}`);
  }

  return res.json();
}

/* ===== ключи хранилищ ===== */
const PROFILE_LS_KEY     = 'client_profile_v1';
const CLIENT_HISTORY_KEY = 'orders_client_history_v1';
const UNAVAILABLE_LS_KEY = 'orders_unavailable_v1';
const DASHBOARD_LS_KEY   = 'dashboard_orders_v1';
const CONFIG_LS_KEY      = 'app_config_v1';
const TABLO_PIN_OK       = 'TABLO_PIN_OK';
const WANT_DASH          = 'WANT_DASH';
const SOUND_ON_KEY       = 'sound_on_v1';
const CLIENT_ID_KEY      = 'client_id_v1';
const NAV_HINT_KEY       = 'nav_hint_shown_v1';
const TABLE_ID_KEY       = 'table_id_v1';
const DASH_CLEARED_AFTER_KEY = 'dashboard_cleared_after_ts_v1';


  // ===== МИГРАЦИЯ ХРАНИЛИЩА =====
// один раз полностью очищаем старые данные,
// чтобы не мешала старая логика прошлых версий
(function clearLegacyStorage(){
  const VERSION_KEY = 'app_storage_version';
  const CURRENT_VERSION = '2'; // если опять всё менять — просто увеличишь число

  const stored = localStorage.getItem(VERSION_KEY);
  if (stored !== CURRENT_VERSION) {
    localStorage.clear();
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  }
})();


/* ===== утилиты ===== */
const el = (html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; };
const showToast = (msg)=>{ const t=document.getElementById('toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'), 1800); };
const money = (x)=> `${x} руб.`;
const setBodyScrollLock = (on)=> document.body.style.overflow = on ? 'hidden' : '';
function safeParse(k, f){ try{ const v=JSON.parse(localStorage.getItem(k)||'null'); if(v==null) return f; if(Array.isArray(f)) return Array.isArray(v)?v:[]; if(typeof f==='object') return v&&typeof v==='object'?v:{}; return v; }catch{ return f } }
function loadProfile(){ return safeParse(PROFILE_LS_KEY, {}); }
function saveProfile(p){ localStorage.setItem(PROFILE_LS_KEY, JSON.stringify(p||{})); }
function loadHistory(){ return safeParse(CLIENT_HISTORY_KEY, []); }
function saveHistory(list){
  const arr = Array.isArray(list) ? list : [];
  localStorage.setItem(CLIENT_HISTORY_KEY, JSON.stringify(arr));
}
function saveUnavailable(items){
  localStorage.setItem(UNAVAILABLE_LS_KEY, JSON.stringify(Array.isArray(items)?items:[]));
}
  
function loadUnavailable(){
  return safeParse(UNAVAILABLE_LS_KEY, []);
}

function loadDash(){ return safeParse(DASHBOARD_LS_KEY, []); }

function saveDash(list){
  const arr = Array.isArray(list) ? list : [];
  localStorage.setItem(DASHBOARD_LS_KEY, JSON.stringify(arr));
}
function getClientId(){
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (id) return id;

  const p = loadProfile();
  if (p && p.phone){
    // Привязываем ID к телефону, убираем пробелы
    id = 'tel:' + p.phone.replace(/\s+/g,'');
  } else {
    // Гостевой ID, если телефона ещё нет
    id = 'guest-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6);
  }
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

  function initTableIdFromUrl() {
  try {
    const sp = new URLSearchParams(location.search);
    // подхватываем ?table=1 или ?t=1
    const raw = sp.get('table') || sp.get('t');
    if (!raw) return;

    const cleaned = String(raw).trim();
    if (!cleaned) return;

    sessionStorage.setItem(TABLE_ID_KEY, cleaned);
  } catch (e) {
    console.warn('initTableIdFromUrl error', e);
  }
}

function getTableId() {
  return sessionStorage.getItem(TABLE_ID_KEY) || '';
}
  
function isProfileFilled(){
  const p = loadProfile();
  if (!p) return false;
  const name = (p.name || '').trim();
  const phone = (p.phone || '').trim();
  const addr  = (p.address || '').trim();
  return !!(name && phone && addr);
}

  let doneModalTimer = null;

function showDoneModal(){
  const dm = document.getElementById('doneModal');
  if (!dm) return;
  dm.classList.add('open');

  if (doneModalTimer) clearTimeout(doneModalTimer);
  doneModalTimer = setTimeout(() => hideDoneModal(), 5000);

  dm.onclick = () => hideDoneModal();
}

function hideDoneModal(){
  const dm = document.getElementById('doneModal');
  if (!dm) return;
  dm.classList.remove('open');
}

/* ===== конфиг (меню) ===== */
const DEFAULT_CONFIG = {
  brandTitle: BRAND_TITLE,
  
  // сюда подставишь свой URL иконки стакана
  logoUrl: '',
  theme: { cardRadius:20, imgRadius:12, imgW:110, imgH:70, cardMinH:104, showPrice:true },
  menu: [
    { key:'burgers', title:'Бургеры', items:[
      { name:'Говяжий бургер', price:280, img:'https://images.unsplash.com/photo-1603064752734-4c48eff53d05?w=400&auto=format&fit=crop' },
      { name:'Говяжий двойной', price:440, img:'https://images.unsplash.com/photo-1516684541-b4de0a07a2e1?w=400&auto=format&fit=crop' },
      { name:'Куриный бургер',  price:200, img:'https://images.unsplash.com/photo-1604908176997-1251882fde0b?w=400&auto=format&fit=crop' },
      { name:'Куриный двойной', price:250, img:'https://images.unsplash.com/photo-1603366615917-1fa6dad5c4fa?w=400&auto=format&fit=crop' },
      { name:'Чизбургер', price:220 }
    ]},
    { key:'twisters', title:'Твистеры', items:[
      { name:'Твистер обычный', price:200 },
      { name:'Твистер обычный с картошкой', price:220 },
      { name:'Твистер макс', price:250 },
      { name:'Твистер макс с картошкой', price:280 }
    ]},
    { key:'drinks',  title:'Напитки', items:[
      { name:'Добрый кола', price:100 }, { name:'Добрый апельсин', price:100 }, { name:'Добрый лайм', price:100 },
      { name:'фдэт-уайт', price:100 }, { name:'Раф банан', price:100 }, { name:'Эспрессо', price:100 }
    ]},
    { key:'sushi',   title:'Суши / роллы', items:[ { name:'Калифорния', price:350 }, { name:'Филадельфия', price:390 }, { name:'Аляска', price:350 } ]},
    { key:'semi',    title:'Полуфабрикаты', items:[ { name:'Курзе с мясом', price:160 }, { name:'Курзе с творогом ', price:210 }, { name:'хинкал слоенный', price:190 }, { name:'Хинкал тонкий', price:190 }, { name:'Хинкал толстый', price:190 } ]}
  ]
};
function loadConfig(){ return safeParse(CONFIG_LS_KEY, DEFAULT_CONFIG); }
function saveConfig(cfg){ localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(cfg||DEFAULT_CONFIG)); }
function applyTheme(theme){
  const r = document.documentElement;
  r.style.setProperty('--card-radius',  (theme.cardRadius||20)+'px');
  r.style.setProperty('--img-radius',   (theme.imgRadius||12)+'px');
  r.style.setProperty('--img-w',        (theme.imgW||110)+'px');
  r.style.setProperty('--img-h',        (theme.imgH||70)+'px');
  r.style.setProperty('--card-min-h',   (theme.cardMinH||104)+'px');

    const cfg   = loadConfig();
  const title = (cfg && cfg.brandTitle) ? cfg.brandTitle : BRAND_TITLE;

  // Обновляем название в шапке
  document.getElementById('brandTitle').textContent = title;

  // Обновляем заголовок вкладки браузера
  document.title = title + ' — локальный стенд';

  const logoEl = document.getElementById('brandLogo');
  if (logoEl) {
    if (cfg.logoUrl) {
      logoEl.src = cfg.logoUrl;
      logoEl.classList.remove('hidden');
    } else {
      logoEl.classList.add('hidden');
    }
  }
}

function calcConfigVersion(cfg) {
  try {
    return JSON.stringify((cfg && cfg.menu) || []).length;
  } catch {
    return 0;
  }
}

// глобальные переменные по меню / конфигу
let MENU_CATEGORIES = loadConfig().menu.slice();
let lastConfigVersion = calcConfigVersion(loadConfig());

/* (опционально) удалённая конфигурация + меню с сервера */
async function fetchRemoteConfig(){
  // Вариант 1: отдельный JSON по URL (если когда-нибудь появится)
  if (CONFIG_REMOTE_URL){
    try{
      const res = await fetch(CONFIG_REMOTE_URL, { cache:'no-cache' });
      if(res.ok){
        const json = await res.json();
        if(json && json.menu){
          saveConfig(json);
          applyTheme(json.theme||{});
          MENU_CATEGORIES = json.menu.slice();
          return json;
        }
      }
    }catch(e){
      console.warn('fetchRemoteConfig URL', e);
    }
  }

  // Вариант 2: RPC к нашему бэку — общий конфиг для всех устройств
  try{
    const res = await rpc({ op: 'config_get' });
if (res && res.config && typeof res.config === 'object') {
  const local = loadConfig();
  const merged = { ...local, ...res.config };

  // menu берём с сервера только если он валидный массив, иначе оставляем локальный
  if (!Array.isArray(merged.menu)) merged.menu = local.menu || DEFAULT_CONFIG.menu;

  saveConfig(merged);
  applyTheme(merged.theme || {});
  MENU_CATEGORIES = (merged.menu || []).slice();
  return merged;
}

  }catch(e){
    console.warn('fetchRemoteConfig RPC', e);
  }
  return null;
}

/* ===== УДАЛЁННОЕ НАЛИЧИЕ ТОВАРОВ ===== */

// стянуть "нет в наличии" с сервера и сохранить локально
async function fetchUnavailableRemote(){
  try{
    const res = await rpc({ op: 'getUnavailable' });

    // на бэке мы всегда возвращаем { items: [...] }
    const items = Array.isArray(res?.items) ? res.items : [];

    // ВАЖНО: сохраняем ВСЕГДА, даже если список пустой
    saveUnavailable(items);

    return items;
  }catch(e){
    console.warn('fetchUnavailableRemote', e);
    return null;
  }
}

// отправить список отсутствующих товаров на сервер
async function pushUnavailableRemote(list){
  try{
    await rpc({
      op: 'setUnavailable',
      items: Array.isArray(list) ? list : []
    });
    showToast('Наличие обновлено на сервере');
  }catch(e){
    console.warn('pushUnavailableRemote', e);
    showToast('Не удалось обновить наличие на сервере');
  }
}

/* ===== анимации ===== */
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2 }
function animateScrollX(el, to, {duration=280, onEnd}={}){ const from=el.scrollLeft; const diff=to-from; if(!diff){ onEnd&&onEnd(); return; } const start=performance.now(); function step(ts){ const t=Math.min(1,(ts-start)/duration); el.scrollLeft=from+diff*easeInOutCubic(t); if(t<1) requestAnimationFrame(step); else onEnd&&onEnd(); } requestAnimationFrame(step); }

/* ===== синхронизация статуса локально ===== */
function syncOrderStatus(id, status){
  let hist = loadHistory(); let changed = false;
  for (let i=0;i<hist.length;i++){
    if (String(hist[i].id) === String(id)){
      if (hist[i].status !== status){ hist[i] = { ...hist[i], status }; changed = true; }
      break;
    }
  }
  if (changed){ saveHistory(hist); window.dispatchEvent(new CustomEvent('orders:history-updated')); }
}

/* === ПУЛЛИНГ СТАТУСОВ ИЗ ОБЛАКА === */
async function pullAndMergeStatuses(){
  try{
    const cloud = await rpc({ op:'list' });
    if(!cloud || !Array.isArray(cloud.orders)) return;

    const byId = new Map(cloud.orders.map(o => [String(o.id), o]));
    const hist = loadHistory();
    let changed = false;

    for (let i=0;i<hist.length;i++){
      const id = String(hist[i].id);
      const fromCloud = byId.get(id);
      if (!fromCloud) continue;

      // мержим не только статус, но и ETA (под пункт E)
      const next = {
        ...hist[i],
        status: fromCloud.status,
        etaMinutes: fromCloud.etaMinutes,
        etaUntil: fromCloud.etaUntil,
      };

      if (JSON.stringify(next) !== JSON.stringify(hist[i])) {
        hist[i] = next;
        changed = true;
      }
    }

    if(changed){
      saveHistory(hist);
      window.dispatchEvent(new CustomEvent('orders:history-updated'));
    }
  }catch(e){
    console.warn('pullAndMergeStatuses error', e);
  }
}

/* ===== Order ===== */
function OrderView(){
  const cfg = loadConfig();
  applyTheme(cfg.theme || {});
  MENU_CATEGORIES = cfg.menu.slice();

  // безопасный esc для селекторов [data-q="..."]
  const escAttr = (val) => {
    if (window.CSS && typeof CSS.escape === 'function'){
      return CSS.escape(val);
    }
    return String(val).replace(/"/g, '\\"');
  };

  const root = el(`
    <div class="relative">

      <!-- Карусель акций над меню -->
     <div id="promoStrip" class="mb-2 rounded-2xl overflow-hidden no-scrollbar hidden">
  <div id="promoStripInner"></div>
</div>

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
          <button
            id="confirmBtn"
            class="px-4 py-2 rounded-xl bg-black text-white flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled
          >
            Оформить заказ
          </button>
        </div>
      </div>
    </div>
  `);

  const categoryBar = root.querySelector('#categoryBar');
  const catPager    = root.querySelector('#catPager');
  const totalEl     = root.querySelector('#totalVal');
  const confirmBtn  = root.querySelector('#confirmBtn');

  setBodyScrollLock(true);

    // --- состояние карусели акций ---
  let promoSlides = [];    // {idx, title, url}
  let promoIndex  = 0;     // текущий слайд
  let promoDir    = 1;     // 1 — вперёд, -1 — назад
  let promoTimer  = null;  // setInterval
  
  confirmBtn._busy = false;

  let activeIdx         = 0;
  let isAnimating       = false;
  let unavailableClient = new Set(loadUnavailable());
  const scrollMemory    = new Map();

  const panelW = () => catPager.getBoundingClientRect().width || 1;

    // ====== РАЗМЕРЫ (мал/бол) ======
  const SIZE_BIG = 'big';
  const SIZE_SMALL = 'small';

  const sizeKey = (name, size) => `${name}__${size}`;

  function getSelectedSize(name){
    window.__sizeSel = window.__sizeSel || {};
    return window.__sizeSel[name] || SIZE_BIG;
  }
  function setSelectedSize(name, size){
    window.__sizeSel = window.__sizeSel || {};
    window.__sizeSel[name] = size;
  }

  function priceFor(it, size){
    // big = it.price, small = it.priceSmall (если нет — fallback на it.price)
    if (size === SIZE_SMALL) return Number(it.priceSmall || it.price || 0);
    return Number(it.price || 0);
  }
  // ====== /РАЗМЕРЫ ======

  function handleStockUpdated(){
    unavailableClient = new Set(loadUnavailable());
    rebuildMenu();
    recalcTotal();
    applyHeights();
  }

  // автоподстановка повторного заказа из истории
  function applyRepeatOrder(){
    const raw = sessionStorage.getItem('repeat_order_items');
    if (!raw) return;

    sessionStorage.removeItem('repeat_order_items');
    const autoPay = sessionStorage.getItem('open_pay_after_repeat') === '1';
    sessionStorage.removeItem('open_pay_after_repeat');

    let items = [];
    try { items = JSON.parse(raw) || []; } catch {}
    if (!Array.isArray(items) || !items.length) return;

    window.__orderCounts = window.__orderCounts || {};

    const cfg = loadConfig();
    const namesSet = new Set(
      cfg.menu.flatMap(cat => cat.items.map(it => it.name))
    );

    items.forEach(it => {
      if (!namesSet.has(it.name)) return;
      const q = Number(it.qty || it.count || 0);
      if (q <= 0) return;
      window.__orderCounts[it.name] = q;
    });

    // обновляем интерфейс
    catPager.querySelectorAll('[data-q]').forEach(node => {
      const name = node.getAttribute('data-q');
      const val  = window.__orderCounts[name] || 0;
      node.textContent = String(val);
    });

    recalcTotal();

    if (autoPay && !confirmBtn.disabled){
      setTimeout(() => {
        if (!confirmBtn.disabled) confirmBtn.click();
      }, 50);
    }
  }

  // построение чипов категорий
  loadConfig().menu.forEach((cat, idx) => {
    categoryBar.appendChild(
      el(`
        <button
          type="button"
          class="px-3 py-1.5 rounded-full border text-sm whitespace-nowrap ${idx === 0 ? 'bg-black text-white border-black' : 'bg-white/50'}"
          data-idx="${idx}"
        >
          ${cat.title}
        </button>
      `)
    );
  });

    // аккуратно подсечиваем активную категориюв
  // и принудительно ПРОКРУЧИВАЕМ полоску категорий
function highlightChip(idx) {
  const buttons = categoryBar.querySelectorAll('button');
  if (!buttons.length) return;

  // переключаем стили активной/неактивной кнопки
  buttons.forEach((b, i) => {
    const on = i === idx;
    b.classList.toggle('bg-black', on);
    b.classList.toggle('text-white', on);
    b.classList.toggle('border-black', on);
  });

  const activeBtn = buttons[idx];
  if (!activeBtn) return;

  // --- РУЧНОЙ автоскролл ряда категорий ---
  const bar      = categoryBar;
  const barWidth = bar.clientWidth;
  const btnLeft  = activeBtn.offsetLeft;
  const btnWidth = activeBtn.offsetWidth;

  // хотим, чтобы активная кнопка была примерно по центру
  let targetScroll = btnLeft - (barWidth - btnWidth) / 2;
  if (targetScroll < 0) targetScroll = 0;

  bar.scrollTo({
    left: targetScroll,
    behavior: 'smooth'
  });
}

  function goToIndex(idx, { animate = true } = {}){
    const cfg = loadConfig();
    idx = Math.max(0, Math.min(cfg.menu.length - 1, idx));
    const target = Math.round(panelW() * idx);
    highlightChip(idx);

    const box = catPager.children[idx]?.querySelector('.v-scroll');

    if (!animate){
      const old = catPager.children[activeIdx]?.querySelector('.v-scroll');
      if (old){
        scrollMemory.set(cfg.menu[activeIdx].key, old.scrollTop);
      }
      catPager.scrollLeft = target;
      if (box){
        box.scrollTop = scrollMemory.get(cfg.menu[idx].key) || 0;
      }
      activeIdx = idx;
      return;
    }

    isAnimating = true;
    const prevSnap = catPager.style.scrollSnapType;
    catPager.style.scrollSnapType = 'none';

    const old = catPager.children[activeIdx]?.querySelector('.v-scroll');
    if (old){
      scrollMemory.set(cfg.menu[activeIdx].key, old.scrollTop);
    }

    animateScrollX(catPager, target, {
      duration: 280,
      onEnd(){
        const cfg2 = loadConfig();
        const box2 = catPager.children[idx]?.querySelector('.v-scroll');
        if (box2){
          box2.scrollTop = scrollMemory.get(cfg2.menu[idx].key) || 0;
        }
        activeIdx = idx;
        isAnimating = false;
        catPager.style.scrollSnapType = prevSnap || 'x mandatory';
      }
    });
  }

  categoryBar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-idx]');
    if (!b || isAnimating) return;
    goToIndex(+b.dataset.idx, { animate: true });
  });

    // --- Карусель акций над меню: только авто-листание + клик в категорию ---
  function renderPromoStrip(categories) {
    const strip = root.querySelector('#promoStrip');
    const inner = root.querySelector('#promoStripInner');
    if (!strip || !inner) return;

    // глушим старый таймер, если был
    if (promoTimer) {
      clearInterval(promoTimer);
      promoTimer = null;
    }

    inner.innerHTML = '';
    promoSlides = [];
    promoIndex  = 0;
    promoDir    = 1; // 1 — вперёд, -1 — назад

    // собираем слайды: поддерживаем и новый формат promo[], и старый promoUrl
    (categories || []).forEach((cat, idx) => {
      if (!cat) return;

      let urls = [];
      if (Array.isArray(cat.promo)) {
        urls = cat.promo.filter(Boolean);
      } else if (cat.promoUrl) {
        urls = [cat.promoUrl];
      }

      urls.forEach((url) => {
        promoSlides.push({
          idx,               // индекс категории
          title: cat.title || '',
          url
        });
      });
    });

    if (!promoSlides.length) {
      strip.classList.add('hidden');
      return;
    }

    strip.classList.remove('hidden');

    // базовая раскладка
    inner.style.display     = 'flex';
    inner.style.flexWrap    = 'nowrap';
    inner.style.overflowX   = 'hidden';
    inner.style.touchAction = 'pan-y';
    inner.classList.add('no-scrollbar');

    promoSlides.forEach((p, i) => {
      const slide = el(`
        <button type="button" class="promo-slide">
          <img
            src="${p.url}"
            alt="${p.title}"
            loading="lazy"
            class="w-full h-32 sm:h-40 object-cover"
          >
        </button>
      `);

      // каждый слайд ровно ширина вьюпорта
      slide.style.flex    = '0 0 100%';
      slide.style.display = 'block';

      // клик по баннеру — переход в категорию
      slide.addEventListener('click', () => {
        promoIndex = i;
        goToIndex(p.idx, { animate: true });
      });

      inner.appendChild(slide);
    });

    const getSlideW = () => strip.getBoundingClientRect().width || 1;

    function snapToCurrent(animate = true) {
      const slideW = getSlideW();
      const target = promoIndex * slideW;
      if (animate) {
        animateScrollX(inner, target, { duration: 260 });
      } else {
        inner.scrollLeft = target;
      }
    }

    // стартовая позиция
    snapToCurrent(false);

    // --- автоперелистывание ---
    promoTimer = setInterval(() => {
      if (!promoSlides.length) return;

      // маятник: дошли до конца — поехали назад
      if (promoDir > 0 && promoIndex >= promoSlides.length - 1) {
        promoDir = -1;
      } else if (promoDir < 0 && promoIndex <= 0) {
        promoDir = 1;
      }

      promoIndex += promoDir;
      snapToCurrent(true);
    }, 4500); // 4.5 секунды между сменами
  }

function rebuildMenu() {
  catPager.innerHTML = '';
  const cfg = loadConfig();

  cfg.menu.forEach((cat) => {
    const panel = el(`<div class="cat-panel"></div>`);
    const vbox  = el(`<div class="v-scroll px-0.5"></div>`);
    const list  = el(`<div class="grid gap-3"></div>`);

    cat.items.forEach(it => {
            const isSized  = !!it.sized;
      const curSize  = isSized ? getSelectedSize(it.name) : null;

      const key      = isSized ? sizeKey(it.name, curSize) : it.name;
      const q        = (window.__orderCounts?.[key] || 0);

      const disabled = unavailableClient.has(it.name);
      const showPrice = cfg.theme.showPrice;

      const curPrice = isSized ? priceFor(it, curSize) : Number(it.price || 0);
      const smallP   = isSized ? priceFor(it, 'small') : 0;
      const bigP     = isSized ? priceFor(it, 'big') : 0;

      const row = el(`
        <div class="menu-card ${disabled ? 'opacity-50' : ''}">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm flex items-center gap-2">
              ${it.name}
              ${disabled ? '<span class="badge red">Нет в наличии</span>' : ''}
            </div>
           ${
  showPrice
    ? (
        isSized
          ? `<div class="text-xs text-gray-500 mt-1">
               ${money(curPrice)}
               <span class="ml-2 opacity-70">(мал: ${money(smallP)} • бол: ${money(bigP)})</span>
             </div>`
          : `<div class="text-xs text-gray-500 mt-1">${money(curPrice)}</div>`
      )
    : ''
}

            ${
              isSized
  ? `
    <div class="flex items-center gap-2 mt-3">
      <button
        type="button"
        class="px-3 py-1 rounded-full border text-xs ${curSize === 'small' ? 'bg-black text-white border-black' : 'bg-white/60'}"
        data-act="size"
        data-name="${it.name}"
        data-size="small"
        ${disabled ? 'disabled' : ''}
      >Мал</button>

      <button
        type="button"
        class="px-3 py-1 rounded-full border text-xs ${curSize === 'big' ? 'bg-black text-white border-black' : 'bg-white/60'}"
        data-act="size"
        data-name="${it.name}"
        data-size="big"
        ${disabled ? 'disabled' : ''}
      >Бол</button>
    </div>
  `
  : ''
            }

            <div class="flex items-center gap-3 mt-3">
              <button
                type="button"
                class="w-8 h-8 rounded-xl border"
                data-name="${it.name}"
                data-act="dec"
                data-size="${isSized ? curSize : ''}"
                ${disabled ? 'disabled' : ''}
              >−</button>
              <div class="w-6 text-center text-sm" data-q="${key}">${q}</div>
              <button
                type="button"
                class="w-8 h-8 rounded-xl bg-black text-white"
                data-name="${it.name}"
                data-act="inc"
                ${disabled ? 'disabled' : ''}
              >+</button>
            </div>
          </div>
          <img
  src="${it.img || 'https://placehold.co/110x70?text=food'}"
  class="menu-card-img"
  alt=""
  loading="lazy"
  decoding="async"
  >
  
        </div>
      `);
      list.appendChild(row);
    });

    // запас снизу
    list.appendChild(el(`<div class="bottom-spacer"></div>`));

    vbox.appendChild(list);
    panel.appendChild(vbox);
    catPager.appendChild(panel);

    // === свайп по категориям (горизонтальный) ===
    const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
    const supportsPointer = !!window.PointerEvent;

    let down   = false;
    let used   = false;
    let sx     = 0;
    let sy     = 0;
    let locked = null;

    const PIX_LOCK = 10;
    const THRESH = () =>
      Math.max(40, (catPager.getBoundingClientRect().width || 1) * 0.25);

    function startDrag(x, y) {
      if (isAnimating) return;
      down = true;
      used = false;
      sx = x;
      sy = y;
      locked = null;
    }

    function moveDrag(x, y, e) {
      if (!down || used || isAnimating) return;

      const dx = x - sx;
      const dy = y - sy;

      if (locked === null) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > PIX_LOCK) {
          locked = 'x';
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > PIX_LOCK) {
          locked = 'y';
        }
      }

      if (locked === 'x') {
        // горизонтальный жест — листаем категории
        if (e && typeof e.preventDefault === 'function') {
          e.preventDefault();
        }

        if (Math.abs(dx) >= THRESH()) {
          used = true;
          const next = dx < 0 ? activeIdx + 1 : activeIdx - 1;
          goToIndex(next, { animate: true });
        }
      }
    }

    function endDrag() {
      down = false;
      used = false;
      locked = null;
    }

    // ANDROID / другие — Pointer Events
    if (supportsPointer && !isIOS) {
      vbox.addEventListener('pointerdown', (e) => {
        const pt = e.pointerType;
        if (pt && pt !== 'touch') return;   // мышь игнорим
        startDrag(e.clientX, e.clientY);
      }, { passive: true });

      vbox.addEventListener('pointermove', (e) => {
        const pt = e.pointerType;
        if (pt && pt !== 'touch') return;
        moveDrag(e.clientX, e.clientY, e);
      }, { passive: false });

      ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt =>
        vbox.addEventListener(evt, endDrag, { passive: true })
      );

    // iOS — touch-события
    } else {
      vbox.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        if (!t) return;
        startDrag(t.clientX, t.clientY);
      }, { passive: true });

      vbox.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        if (!t) return;
        moveDrag(t.clientX, t.clientY, e);
      }, { passive: false });

      ['touchend', 'touchcancel'].forEach(evt =>
        vbox.addEventListener(evt, endDrag, { passive: true })
      );
    }
    // === конец свайпа ===
  });
}

  // обработчик +/− по делегированию
  catPager.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn || btn.disabled) return;

    const name  = btn.dataset.name;
        const act = btn.dataset.act;

    // переключение размера
  if (act === 'size') {
  const size = btn.dataset.size || 'big';

  // сохраняем текущую прокрутку списка в активной категории
  const currentBox = catPager.children[activeIdx]?.querySelector('.v-scroll');
  const curTop = currentBox ? currentBox.scrollTop : 0;

  setSelectedSize(name, size);
  rebuildMenu();
  recalcTotal();
  applyHeights();

  // возвращаем прокрутку назад (после пересборки DOM)
  requestAnimationFrame(() => {
    const newBox = catPager.children[activeIdx]?.querySelector('.v-scroll');
    if (newBox) newBox.scrollTop = curTop;
  });

  return;
}

        const delta = act === 'inc' ? +1 : -1;

        // если товар sized — считаем по ключу name__size
    const cfg2 = loadConfig();
    const it2 = cfg2.menu.flatMap(c => c.items).find(x => x.name === name);
    const isSized = !!it2?.sized;
    const curSize = isSized ? (btn.dataset.size || getSelectedSize(name)) : null;
    const k = isSized ? sizeKey(name, curSize) : name;

    const selector = `[data-q="${escAttr(k)}"]`;

    const cur = parseInt(
      catPager.querySelector(selector)?.textContent || '0',
      10
    ) || 0;

    const next = Math.max(0, cur + delta);

    catPager.querySelectorAll(selector).forEach(n => {
      n.textContent = String(next);
    });

    if (!window.__orderCounts) window.__orderCounts = {};
     window.__orderCounts[k] = next;
    recalcTotal();
  });

    function applyHeights(){
    try {
      const headerH  = document.querySelector('.brand-strip')?.getBoundingClientRect().height || 0;
      const chipsH   = root.querySelector('.sticky-top')?.getBoundingClientRect().height || 0;
      const confirmEl = root.querySelector('#confirmBar');
      const confirmH = confirmEl?.getBoundingClientRect().height || 0;

      const availH   = Math.max(
        240,
        window.innerHeight - headerH - chipsH - confirmH - 8
      );

      const first  = root.querySelector('.menu-card');
      const cardH  = first ? Math.ceil(first.getBoundingClientRect().height) : 104;

      const h      = Math.min(availH, cardH * 4 + 12 * 3 + 4);

      root.querySelectorAll('.v-scroll').forEach(el => {
        el.style.height = h + 'px';
        // 👇 вот это главное: даём “запас” снизу,
        // чтобы последнюю карточку можно было доскроллить НАД плашкой
        el.style.paddingBottom = (confirmH + 16) + 'px';
      });

      const spacerH = confirmH + 32; // высота панели + запас
root.querySelectorAll('.bottom-spacer').forEach(el => {
  el.style.height = spacerH + 'px';
});
      
      goToIndex(activeIdx, { animate: false });
    } catch (err) {}
  }

  window.addEventListener('resize', applyHeights);

  catPager.addEventListener('scroll', () => {
    if (isAnimating) return;
    if (catPager._scrollTimer) clearTimeout(catPager._scrollTimer);
    catPager._scrollTimer = setTimeout(() => {
      const idx = Math.round(catPager.scrollLeft / (catPager.getBoundingClientRect().width || 1));
      if (idx !== activeIdx){
        highlightChip(idx);
        activeIdx = idx;
      }
    }, 80);
  });

 function recalcTotal(){
  const cfg    = loadConfig();
  const counts = window.__orderCounts || {};  // ✅ ВОТ ЭТОГО у тебя сейчас нет => ошибка

  let sum = 0;

  cfg.menu.forEach(cat =>
    cat.items.forEach(it => {
      if (it.sized) {
        const qb = counts[`${it.name}__big`]   || 0;
        const qs = counts[`${it.name}__small`] || 0;

        const pb = Number(it.price || 0);
        const ps = Number(it.priceSmall || it.price || 0);

        sum += qb * pb;
        sum += qs * ps;
      } else {
        sum += (counts[it.name] || 0) * Number(it.price || 0);
      }
    })
  );

  totalEl.textContent = money(sum);
  confirmBtn.disabled = sum <= 0;
  return sum;
}

  // обработка "Оформить заказ"
  confirmBtn.addEventListener('click', () => {
    const cfg    = loadConfig();
    const counts = window.__orderCounts || {};
    const items  = [];

    cfg.menu.forEach(cat =>
      cat.items.forEach(it => {
        const q = (counts[it.name] || 0);
                if (it.sized) {
          const qb = counts[sizeKey(it.name, 'big')] || 0;
          const qs = counts[sizeKey(it.name, 'small')] || 0;

          if (qb > 0) items.push({ name: `${it.name} (бол)`, qty: qb, price: priceFor(it, 'big'), baseName: it.name, size: 'big' });
          if (qs > 0) items.push({ name: `${it.name} (мал)`, qty: qs, price: priceFor(it, 'small'), baseName: it.name, size: 'small' });

        } else {
          const q = (counts[it.name] || 0);
          if (q > 0) items.push({ name: it.name, qty: q, price: Number(it.price || 0) });
        }
      })
    );

    if (!items.length) return;

    if (confirmBtn._busy) return;
    confirmBtn._busy   = true;
    confirmBtn.disabled = true;

    const sumBox = document.getElementById('paySummary');
    let total    = 0;
    sumBox.innerHTML = items.map(i => {
      total += i.qty * (i.price || 0);
      return `
        <div class="flex items-center justify-between">
          <div class="truncate">${i.name} ×${i.qty}</div>
          <div class="ml-2 whitespace-nowrap">${money(i.qty * (i.price || 0))}</div>
        </div>
      `;
    }).join('');

        const tableId = getTableId();
    if (tableId) {
      sumBox.insertAdjacentHTML(
        'afterbegin',
        `<div class="mb-2 text-sm text-gray-700">
           Столик: <b>№${tableId}</b>
         </div>`
      );
    }
    
    sumBox.insertAdjacentHTML(
      'beforeend',
      `<div class="mt-2 pt-2 border-t flex items-center justify-between font-semibold">
         <div>Итого</div><div>${money(total)}</div>
       </div>`
    );

    const sel  = document.getElementById('paySelect');
    sel.value  = 'cash';
    document.getElementById('payModal').classList.add('open');
  });

  function resetCounts(){
    window.__orderCounts = {};
    catPager.querySelectorAll('[data-q]').forEach(n => n.textContent = '0');
    totalEl.textContent   = money(0);
    confirmBtn.disabled   = true;
  }

  // биндим модалку оплаты (payModal)
  (function bindPayModal(){
    const m   = document.getElementById('payModal');
    const ok  = document.getElementById('payOk');
    const cancel = document.getElementById('payCancel');
    const sel = document.getElementById('paySelect');

    const close    = () => m.classList.remove('open');
    const finalize = () => { confirmBtn._busy = false; confirmBtn.disabled = false; };

    const onCancel = (e) => {
      if (e){
        e.preventDefault();
        e.stopPropagation();
      }
      close();
      finalize();
    };

    const onOk = async (e) => {
      if (e){
        e.preventDefault();
        e.stopPropagation();
      }

            // отключаем кнопку и сразу прячем модалку — защита от даблтапа
      if (ok.disabled) return;
      ok.disabled = true;
      close();

      const cfg    = loadConfig();
      const counts = window.__orderCounts || {};
      const itemsSel = [];
      let total = 0;

      cfg.menu.forEach(cat =>
  cat.items.forEach(it => {
    if (it.sized) {
      const qb = counts[sizeKey(it.name, 'big')] || 0;
      const qs = counts[sizeKey(it.name, 'small')] || 0;

      if (qb > 0){
        const pr = priceFor(it, 'big');
        itemsSel.push({ name: `${it.name} (бол)`, qty: qb, price: pr, baseName: it.name, size: 'big' });
        total += qb * pr;
      }
      if (qs > 0){
        const pr = priceFor(it, 'small');
        itemsSel.push({ name: `${it.name} (мал)`, qty: qs, price: pr, baseName: it.name, size: 'small' });
        total += qs * pr;
      }

    } else {
      const q = (counts[it.name] || 0);
      if (q > 0){
        const pr = Number(it.price || 0);
        itemsSel.push({ name: it.name, qty: q, price: pr });
        total += q * pr;
      }
    }
  })
);

           if (!itemsSel.length){
        ok.disabled = false;
        finalize();
        return;
      }

           const tableId = getTableId();

      try {
                const res = await rpc({
          op: 'create',
          data: {
            clientId: getClientId(),
            items: itemsSel,
            total,
            pay: sel.value || 'cash',
            table: tableId || null
          }
        });

        // --- НОВЫЙ БЛОК: ПРЯМАЯ ПЕЧАТЬ ЧЕРЕЗ КОМПАНЬОН ---
        try {
          // IP телефона нужно взять из настроек или ввести вручную. 
          // Для теста можно зашить IP, который покажет приложение на экране.
          const companionIp = "192.168.0.100"; // <--- ЗАМЕНИ НА IP ИЗ ЭКРАНА ТЕЛЕФОНА
          
          const printData = {
            orderId: res?.order?.id || Date.now().toString().slice(-6),
            table: tableId || "—",
            items: itemsSel, // массив [{name, qty, price}, ...]
            total: total,
            pay: sel.value === 'cash' ? 'Наличные' : 'Карта'
          };

          fetch(`http://${companionIp}:8080/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'no-cors', // Важно, чтобы браузер не ругался на разные адреса
            body: JSON.stringify(printData)
          });
          console.log("Запрос на печать отправлен в компаньон");
        } catch (e) {
          console.error("Компаньон не ответил", e);
        }
        // --- КОНЕЦ БЛОКА ПЕЧАТИ ---

        const order = res && res.order ? res.order : {
          id: Date.now().toString().slice(-6),
          createdAt: Date.now(),
          items: itemsSel,
          total,
          pay: sel.value || 'cash',
          status: 'новый',
          table: tableId || null
        };

        const history = loadHistory();
        history.unshift(order);
        saveHistory(history.slice(0, 50));

        const dash = loadDash();
        dash.unshift(order);
        saveDash(dash.slice(0, 200));

           } catch (err) {
        console.warn('RPC create error', err);
        showToast('Не удалось отправить заказ, попробуйте ещё раз.');
        ok.disabled = false;
        finalize();
        return;
      }

      ok.disabled = false;
      finalize();
      resetCounts();
      window.dispatchEvent(new CustomEvent('orders:history-updated'));
      showDoneModal();
    };

    if (ok._handler)     ok.removeEventListener('click', ok._handler);
    if (cancel._handler) cancel.removeEventListener('click', cancel._handler);

    ok._handler     = onOk;
    cancel._handler = onCancel;

    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);

    m.onclick = (e) => { if (e.target === m) onCancel(e); };
  })();

  renderPromoStrip(loadConfig().menu);
  
   rebuildMenu();

  requestAnimationFrame(() => {
    // выставляем высоты для внутреннего скролла
    applyHeights();

    highlightChip(0);
    goToIndex(0, { animate:false });
    recalcTotal();
    applyRepeatOrder();
  });

  // реагируем на изменения склада
  window.addEventListener('stock:updated', handleStockUpdated);

  // периодический синк: конфиг, статусы, наличие
  const syncTimer = setInterval(async () => {
    // конфиг меню
    try {
      const cfgRemote = await fetchRemoteConfig();
      if (cfgRemote){
        const v = calcConfigVersion(cfgRemote);
        if (v !== lastConfigVersion){
          lastConfigVersion = v;
          renderPromoStrip(cfgRemote.menu || []);
          rebuildMenu();
          recalcTotal();
          applyHeights();
        }
      }
    } catch (e) {}

    // статусы заказов
    await pullAndMergeStatuses().catch(() => {});

    // наличие с сервера
    const before = new Set(unavailableClient);
   const remote = await fetchUnavailableRemote().catch(() => []);
if (Array.isArray(remote)){
      const after = new Set(remote);
      if (
        before.size !== after.size ||
        [...before].some(x => !after.has(x))
      ){
        unavailableClient = after;
        rebuildMenu();
        recalcTotal();
        applyHeights();
      }
    }
  }, 4000);

  root.cleanup = () => {
    setBodyScrollLock(false);
    clearInterval(syncTimer);
    if (promoTimer) clearInterval(promoTimer);
    window.removeEventListener('stock:updated', handleStockUpdated);
    window.removeEventListener('resize', applyHeights);
  };

  return root;
}

/* ===== Контакты ===== */
function ProfileEditView(){ 
  const p=Object.assign({ name:'', phone:'', address:'', paymentMethod:'cash' }, loadProfile());
  const root=el(`
    <div class="grid gap-4 pb-24">
      <section class="glass-panel rounded-2xl p-5">
        <h2 class="text-lg font-semibold mb-3">Редактировать профиль</h2>
        <div class="grid gap-3">
          <input id="pName" class="border rounded-xl p-3" placeholder="Имя Фамилия" value="${p.name||''}">
          <input id="pPhone" class="border rounded-xl p-3" placeholder="Телефон (+7…)" value="${p.phone||''}">
          <input id="pAddr" class="border rounded-xl p-3" placeholder="Адрес доставки" value="${p.address||''}">
          <div id="pError" class="text-xs text-red-600"></div>
          <div class="flex gap-2">
            <button id="pSave" class="px-4 py-3 rounded-xl bg-black text-white flex-1">Сохранить</button>
            <button id="pBack" class="px-4 py-3 rounded-xl border flex-1">Назад</button>
          </div>
        </div>
      </section>
    </div>
  `);

  const errEl = root.querySelector('#pError');

  root.querySelector('#pSave').onclick = () => {
    const p2 = {
      name: root.querySelector('#pName').value.trim(),
      phone: root.querySelector('#pPhone').value.trim(),
      address: root.querySelector('#pAddr').value.trim(),
      paymentMethod: 'cash'
    };
    saveProfile(p2);

    // Обновляем clientId, если появился нормальный телефон
    if (p2.phone){
      const currentId = localStorage.getItem(CLIENT_ID_KEY);
      if (!currentId || currentId.startsWith('guest-')){
        localStorage.setItem(CLIENT_ID_KEY, 'tel:' + p2.phone.replace(/\s+/g,''));
      }
    }

    if (!isProfileFilled()){
      errEl.textContent = 'Заполните профиль полностью (имя, телефон и адрес).';
    } else {
      errEl.textContent = '';
            showToast('Профиль сохранён');
      location.hash = '#/order';
    }
  };

  root.querySelector('#pBack').onclick=()=> history.length ? history.back() : (location.hash='#/order');
  return root;
}

/* ===== История ===== */
function HistoryView(){ 
  const root = el(`
    <div class="grid gap-3 pb-24">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Мои заказы</h2>
        <div class="flex gap-2">
          <button id="clearAll" class="px-3 py-2 rounded-xl border">Очистить всё</button>
          <button id="back" class="px-3 py-2 rounded-xl border">Назад</button>
        </div>
      </div>
      <div id="historyList" class="grid gap-3"></div>
    </div>
  `);

  const box = root.querySelector('#historyList');

  function cardView(o, idx){
    const items = o.items || [];
    const active = !['завершён','отменён'].includes(o.status || 'новый');
    const chipClass = active ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-700';
    const outerBg  = active ? 'bg-yellow-50 border-yellow-200' : 'bg-white';

    const etaText = o.etaUntil
      ? `<div class="text-xs text-gray-700 mt-1">
           Ожидаемое время: ${o.etaMinutes || ''} мин
           (примерно в ${new Date(o.etaUntil).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})
         </div>`
      : '';

    const elCard = el(`
      <div class="card p-4 ${outerBg}">
        <div class="flex items-center justify-between">
          <div class="text-2xl font-extrabold">№ ${o.id || '—'}</div>
          <span class="chip ${chipClass}">${o.status || 'новый'}</span>
        </div>
          <div class="text-xs text-gray-500 mt-1">
          ${o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}
        </div>
        ${o.table ? `<div class="text-sm text-gray-700 mt-1">Столик: №${o.table}</div>` : ''}
        ${etaText}

        <div class="mt-3 grid gap-2">
          ${
            items.map(i => `
              <div class="flex items-center justify-between text-sm">
                <div class="truncate mr-2">${i.name}</div>
                <div class="whitespace-nowrap">${i.qty} × ${i.price} ₽</div>
              </div>
            `).join('')
          }
        </div>
        <div class="mt-3 border-t pt-2 flex items-center justify-between">
          <div class="font-semibold">Итого: ${money(o.total || 0)}</div>
          <div class="flex gap-2">
            <button class="px-3 py-2 rounded-xl border" data-repeat>Повторить заказ</button>
            <button class="px-3 py-2 rounded-xl border text-red-600" data-del>Удалить</button>
          </div>
        </div>
      </div>
    `);

    elCard.querySelector('[data-repeat]').onclick = () => {
      sessionStorage.setItem('repeat_order_items', JSON.stringify(items));
      sessionStorage.setItem('open_pay_after_repeat', '1');
      location.hash = '#/order';
    };

    elCard.querySelector('[data-del]').onclick = () => {
      const cur = loadHistory();
      cur.splice(idx, 1);
      saveHistory(cur);
      render();
      window.dispatchEvent(new CustomEvent('orders:history-updated'));
    };

    return elCard;
  }

  function render(){
    const list = loadHistory();
    box.innerHTML = '';
    if (!Array.isArray(list) || !list.length){
      box.innerHTML = '<div class="text-sm text-gray-400">Пока нет заказов.</div>';
      return;
    }
    list.forEach((o, idx) => box.appendChild(cardView(o, idx)));
  }

  root.querySelector('#clearAll').onclick = () => {
    if (confirm('Очистить всю историю?')){
      saveHistory([]);
      render();
      window.dispatchEvent(new CustomEvent('orders:history-updated'));
    }
  };

  root.querySelector('#back').onclick = () =>
    history.length ? history.back() : (location.hash = '#/order');

    // при открытии экрана сразу подтягиваем актуальные статусы/ETA
  pullAndMergeStatuses().then(render).catch(() => render());

  // автосинк статусов на экране истории
  const syncTimer = setInterval(async () => {
    await pullAndMergeStatuses().catch(()=>{});
    render();
  }, 7000);

  root.cleanup = () => clearInterval(syncTimer);

  return root;
}

/* ==== PDF-ОТЧЁТ (pdfmake, поддержка кириллицы) ==== */

// Ленивая подгрузка pdfmake + шрифтов (один раз)
let pdfReady = null;
function ensurePdfLib() {
  if (window.pdfMake) return Promise.resolve();
  if (!pdfReady) {
    pdfReady = new Promise((resolve, reject) => {
      const s1 = document.createElement('script');
      s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js';
        s2.onload = () => resolve();
        s2.onerror = reject;
        document.head.appendChild(s2);
      };
      s1.onerror = reject;
      document.head.appendChild(s1);
    });
  }
  return pdfReady;
}

function formatMoneyPlain(num) {
  num = Number(num || 0);
  return `${Math.round(num)} ₽`;
}

// Основная функция выгрузки PDF
async function exportReportPdf() {
  await ensurePdfLib();

  // 1. Берём ВСЕ заказы с сервера
  let allOrders = [];
  try {
    const res = await rpc({ op: 'list', all: true });
    if (Array.isArray(res.orders)) {
      allOrders = res.orders;
    }
  } catch (e) {
    console.warn('exportReportPdf: rpc list error', e);
  }

  if (!allOrders.length) {
    showToast('Нет заказов для отчёта');
    return;
  }

  const MS_DAY = 24 * 60 * 60 * 1000;
  const nowTs  = Date.now();
  const dayFrom   = nowTs - MS_DAY;        // последние 24 часа
  const weekFrom  = nowTs - 7 * MS_DAY;    // последние 7 дней
  const monthFrom = nowTs - 30 * MS_DAY;   // последние 30 дней

  let totalAll = 0;

  // Для среднего чека
  let revDay = 0,   cntDay = 0;
  let revWeek = 0,  cntWeek = 0;
  let revMonth = 0, cntMonth = 0;

  // Для топов
  const weekAgg  = new Map(); // name -> { qty, sum }
  const monthAgg = new Map();

  function orderTotal(o) {
    const items = Array.isArray(o.items) ? o.items : [];
    const client = items.reduce(
      (s, it) => s + (Number(it.qty || 0) * Number(it.price || 0)),
      0
    );
    if (typeof o.total === 'number' && o.total > 0) {
      return Math.max(o.total, client);
    }
    return client;
  }

    // ====== 31 ДЕНЬ (08:00–23:00) ======
  const SHOP_TZ = 'Europe/Moscow';

  function toTZDate(ts) {
    return new Date(new Date(ts).toLocaleString('en-US', { timeZone: SHOP_TZ }));
  }

  function ymdKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function startOfDay08(d) {
    const x = new Date(d);
    x.setHours(8, 0, 0, 0);
    return x;
  }

  function endOfDay23(d) {
    const x = new Date(d);
    x.setHours(23, 0, 0, 0);
    return x;
  }

  function isAfter23(d) {
    return d.getHours() >= 23;
  }

  // Время "сейчас" в МСК
  const nowTZ = toTZDate(Date.now());
  const todayClosed = isAfter23(nowTZ);

  // Выручка по дням (YYYY-MM-DD) только 08:00–23:00
  const dayRevenueMap = new Map();

  // считаем выручку по окну 08:00–23:00
  allOrders.forEach(o => {
    const ts = Number(o.createdAt || 0);
    if (!ts) return;

    const sum = orderTotal(o);
    const t = toTZDate(ts);

    const dayBase = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const from = startOfDay08(dayBase);
    const to   = endOfDay23(dayBase);

    if (t >= from && t < to) {
      const key = ymdKey(t);
      dayRevenueMap.set(key, (dayRevenueMap.get(key) || 0) + sum);
    }
  });

  // готовим 31 строку для PDF
  const days31 = [];
  for (let i = 0; i < 31; i++) {
    const d = new Date(nowTZ);
    d.setDate(d.getDate() - i);

    const key = ymdKey(d);

    // сегодня показываем только после 23:00
    const isToday = ymdKey(nowTZ) === key;
    const rev = (isToday && !todayClosed) ? null : (dayRevenueMap.get(key) || 0);

    const weekday = new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      timeZone: SHOP_TZ
    }).format(d);

    const dateText = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: SHOP_TZ
    }).format(d);

    const monthText = new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
      timeZone: SHOP_TZ
    }).format(d);

    days31.push({
      dateText,
      weekday,
      monthText,
      revenueText: (rev === null ? '—' : formatMoneyPlain(rev))
    });
  }

  // делаем старые сверху, новые снизу
  days31.reverse();
  // ====== /31 ДЕНЬ ======

  allOrders.forEach(o => {
    const t = Number(o.createdAt || 0);
    const sum = orderTotal(o);
    totalAll += sum;

    if (t >= dayFrom) {
      revDay += sum;
      cntDay++;
    }
    if (t >= weekFrom) {
      revWeek += sum;
      cntWeek++;
    }
    if (t >= monthFrom) {
      revMonth += sum;
      cntMonth++;
    }

    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach(it => {
      const name = it.name || '';
      if (!name) return;
      const q = Number(it.qty || 0);
      const p = Number(it.price || 0);
      const s = q * p;

      if (t >= weekFrom) {
        const rec = weekAgg.get(name) || { qty: 0, sum: 0 };
        rec.qty += q;
        rec.sum += s;
        weekAgg.set(name, rec);
      }
      if (t >= monthFrom) {
        const rec = monthAgg.get(name) || { qty: 0, sum: 0 };
        rec.qty += q;
        rec.sum += s;
        monthAgg.set(name, rec);
      }
    });
  });

  function avgCheck(rev, cnt) {
    if (!cnt) return '—';
    return formatMoneyPlain(rev / cnt);
  }

  const avgDay    = avgCheck(revDay,   cntDay);
  const avgWeek   = avgCheck(revWeek,  cntWeek);
  const avgMonth  = avgCheck(revMonth, cntMonth);

  function top5FromMap(m) {
    return [...m.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, sum: v.sum }))
      .sort((a,b) => b.qty - a.qty)
      .slice(0, 5);
  }

  const topWeek  = top5FromMap(weekAgg);
  const topMonth = top5FromMap(monthAgg);

  const now = new Date();

  // Готовим docDefinition для pdfmake
  const docDefinition = {
    content: [
      { text: 'Отчёт по продажам', style: 'header' },
      { text: `Заведение: ${BRAND_TITLE}`, style: 'subheader' },
      { text: `Дата и время выгрузки: ${now.toLocaleString('ru-RU')}`, margin: [0, 0, 0, 10] },

      {
        text: 'Выручка на момент выгрузки',
        style: 'sectionHeader',
        margin: [0, 10, 0, 4]
      },
      {
        text: formatMoneyPlain(totalAll),
        style: 'bigNumber',
        margin: [0, 0, 0, 14]
      },

      {
        text: 'Средний чек',
        style: 'sectionHeader',
        margin: [0, 6, 0, 4]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto'],
          body: [
            ['Период', 'Средний чек'],
            ['День (последние 24 часа)',  avgDay],
            ['Неделя (последние 7 дней)', avgWeek],
            ['Месяц (последние 30 дней)', avgMonth],
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12]
      },

      {
        text: 'ТОП-5 позиций за неделю',
        style: 'sectionHeader',
        margin: [0, 10, 0, 4]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [
            ['Позиция', 'Кол-во', 'Выручка'],
            ...(
              topWeek.length
                ? topWeek.map(it => [it.name, it.qty, formatMoneyPlain(it.sum)])
                : [['Нет данных', '', '']]
            )
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 12]
      },

      {
        text: 'ТОП-5 позиций за месяц',
        style: 'sectionHeader',
        margin: [0, 10, 0, 4]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [
            ['Позиция', 'Кол-во', 'Выручка'],
            ...(
              topMonth.length
                ? topMonth.map(it => [it.name, it.qty, formatMoneyPlain(it.sum)])
                : [['Нет данных', '', '']]
            )
          ]
        },
        layout: 'lightHorizontalLines'
      },

            // ====== СТРАНИЦА 2: 31 ДЕНЬ (08:00–23:00) ======
      { text: 'Выручка по дням (31 день)', style: 'header', pageBreak: 'before' },
      {
        text: 'Окно дня: 08:00–23:00 (МСК). Сегодня появится только после 23:00.',
        style: 'subheader',
        margin: [0, 0, 0, 8]
      },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto'],
          body: [
            ['Дата', 'День', 'Месяц', 'Выручка'],
            ...days31.map(r => [r.dateText, r.weekday, r.monthText, r.revenueText])
          ]
        },
        layout: 'lightHorizontalLines'
      },
      // ====== /СТРАНИЦА 2 ======
      
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 4]
      },
      subheader: {
        fontSize: 11,
        color: '#555555',
        margin: [0, 0, 0, 2]
      },
      sectionHeader: {
        fontSize: 13,
        bold: true
      },
      bigNumber: {
        fontSize: 20,
        bold: true
      }
    },
    defaultStyle: {
      font: 'Roboto'
    }
  };

  const fname =
    `report_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`
    + `-${String(now.getDate()).padStart(2,'0')}_`
    + `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.pdf`;

  pdfMake.createPdf(docDefinition).download(fname);
  showToast('PDF-отчёт выгружен');
}

/* ===== Табло ===== */
function DashboardView(){ 
const root = el(`
  <div class="grid gap-4 max-w-6xl pb-24">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-semibold">Текущие заказы</h2>
        <button id="soundToggle" class="px-3 py-1.5 rounded-xl border bg-white" title="Звук уведомлений">🔔 Звук</button>
      </div>
      <div class="flex items-center gap-2">
        <a href="#/builder" class="px-3 py-2 rounded-xl border bg-white" title="Конструктор">Конструктор</a>
          <button id="exportPdfBtn" class="px-3 py-2 rounded-xl border bg-white">Выгрузить PDF</button>
            <button id="printOrdersBtn" class="px-3 py-2 rounded-xl border bg-white">Печать ордеров</button>
        <button id="btnClearAll" class="px-3 py-2 rounded-xl border bg-red-50 text-red-700">Очистить всё</button>
        <button id="btnClearHistory" class="px-3 py-2 rounded-xl border bg-red-100 text-red-800">Очистить историю</button>
      </div>
    </div>

        <div class="p-4 rounded-2xl bg-white border">
      <!-- Кнопка-шапка шторки -->
      <button
        id="stockToggle"
        class="w-full flex items-center justify-between gap-2 text-left"
        type="button"
      >
        <span class="font-semibold">Наличие товаров</span>
        <span id="stockArrow" class="text-lg leading-none">▼</span>
      </button>

      <!-- Содержимое, по умолчанию скрыто -->
      <div id="stockPanel" class="mt-3 hidden">
        <p class="text-sm text-gray-500 mb-3">
          Отметьте галкой, чего НЕТ — на телефоне товар станет серым и его нельзя будет добавить.
        </p>

        <div id="stockList" class="grid gap-2 md:grid-cols-3"></div>

        <div class="mt-3 flex gap-2">
          <button id="saveStock" class="px-3 py-2 rounded-xl border bg-black text-white">Сохранить</button>
          <button id="resetStock" class="px-3 py-2 rounded-xl border">Все в наличии</button>
        </div>
      </div>
    </div>

        <div
      id="list"
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 max-w-5xl mx-auto"
    ></div>

    <div>
      <button class="px-3 py-2 rounded-xl border" onclick="location.hash='#/order'">Назад</button>
    </div>
  </div>
`);

     // Кнопка “Выгрузить PDF”
const exportPdfBtn = root.querySelector('#exportPdfBtn');
if (exportPdfBtn) {
  exportPdfBtn.onclick = () => exportReportPdf();
}

// Кнопка “Печать ордеров”
const printOrdersBtn = root.querySelector('#printOrdersBtn');
if (printOrdersBtn) {
  printOrdersBtn.onclick = () => {
    window.print(); // откроется стандартное окно печати браузера
  };
}
  
   const list       = root.querySelector('#list');
  const stockList  = root.querySelector('#stockList');
  const stockPanel = root.querySelector('#stockPanel');
  const stockToggle= root.querySelector('#stockToggle');
  const stockArrow = root.querySelector('#stockArrow');

  if (!list || !stockList || !stockPanel || !stockToggle || !stockArrow) {
    console.error('DashboardView: missing containers', { list, stockList, stockPanel, stockToggle, stockArrow });
    showToast('Табло сломано: нет контейнеров list/stockList/stockPanel');
    return root;
  }

  // Открыть/закрыть шторку
  stockToggle.onclick = () => {
    const isHidden = stockPanel.classList.toggle('hidden'); // toggle вернёт true, если теперь скрыто
    stockArrow.textContent = isHidden ? '▼' : '▲';
  };
 
  let unavailable = new Set(loadUnavailable());

  // когда последний раз очищали табло (только локально)
  const clearedAfterTs = Number(localStorage.getItem(DASH_CLEARED_AFTER_KEY) || 0);

  // подгружаем локальное табло с учётом этого времени
  let dashOrders = loadDash().filter(o => {
    if (!clearedAfterTs) return true;
    const t = Number(o.createdAt || 0);
    // если нет createdAt — оставляем, иначе сравниваем
    return !t || t >= clearedAfterTs;
  });
   // на табло показываем только не завершённые и не отменённые
  dashOrders = dashOrders.filter(o =>
    o.status !== 'завершён' && o.status !== 'отменён'
  );
  window.__dashOrders = dashOrders;

  let knownIds       = new Set(dashOrders.map(o => String(o.id)));
  const ding         = document.getElementById('orderDing');
  
  const soundBtn     = root.querySelector('#soundToggle');
  let hiddenNewCount = 0;
  let pollTimer      = null;

  const soundOn  = () => localStorage.getItem(SOUND_ON_KEY) === '1';
  const setSound = (on) => {
    localStorage.setItem(SOUND_ON_KEY, on ? '1' : '0');
    soundBtn.classList.toggle('bg-green-50', on);
    soundBtn.classList.toggle('border-green-600', on);
  };

  setSound(soundOn());
  soundBtn.onclick = () => setSound(!soundOn());

  function handleVisibilityChange(){
    if (document.visibilityState === 'visible' && hiddenNewCount > 0){
      showToast(`Новых заказов: ${hiddenNewCount}`);
      hiddenNewCount = 0;
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  function renderStock(){
    stockList.innerHTML = '';
    loadConfig().menu.forEach(cat =>
      cat.items.forEach(item => {
        const row = el(`
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" value="${item.name}" ${unavailable.has(item.name) ? 'checked' : ''} />
            <span>${item.name}</span>
          </label>
        `);
        stockList.appendChild(row);
      })
    );
  }
  renderStock();

  root.querySelector('#saveStock').onclick = async () => {
    const checked = [...stockList.querySelectorAll('input[type=checkbox]:checked')]
      .map(i => i.value);

    saveUnavailable(checked);
    unavailable = new Set(checked);
    showToast('Наличие сохранено');

    window.dispatchEvent(new CustomEvent('stock:updated'));
    await pushUnavailableRemote(checked);
    };
  root.querySelector('#resetStock').onclick = async () => {
  // Локально считаем, что всё в наличии
  saveUnavailable([]);
  unavailable = new Set();

  // Обновляем свой UI (чтоб галочки снялись)
  renderStock();

  // Сообщаем другим экранам этого же браузера
  window.dispatchEvent(new CustomEvent('stock:updated'));

  // Пишем на сервер пустой список, чтобы другие устройства при синке тоже обнулили
  try {
    await pushUnavailableRemote([]);
    showToast('Все товары в наличии');
  } catch (e) {
    console.warn('resetStock error', e);
    showToast('Не удалось отправить на сервер, но локально всё в наличии');
  }
};

  // ====== ОВЕРЛЕЙ ДЛЯ "ЕЩЁ" ======

  // создаём оверлей, если его ещё нет в DOM
  let overlay = document.getElementById('orderOverlay');
  if (!overlay) {
    overlay = el(`
      <div
        id="orderOverlay"
        class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40"
      >
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 p-5 relative">
          <button
            id="orderOverlayClose"
            type="button"
            class="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
          <div id="orderOverlayContent"></div>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);
  }

  const overlayClose = overlay.querySelector('#orderOverlayClose');
  const overlayBody  = overlay.querySelector('#orderOverlayContent');

  // открыть модалку с полным списком позиций
  function openOrderOverlay(order) {
    if (!overlay || !overlayBody) return;

    const items   = Array.isArray(order.items) ? order.items : [];
    const created = order.createdAt ? new Date(order.createdAt) : null;

    const clientTotal = items.reduce(
      (s, i) => s + (i.price || 0) * (i.qty || 0),
      0
    );
    const total = Math.max(
      typeof order.total === 'number' ? order.total : 0,
      clientTotal
    );

    overlayBody.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div>
          <div class="text-xl font-extrabold">#${order.id || '—'}</div>
          ${order.table ? `<div class="text-xs text-gray-700 mt-0.5">Столик: №${order.table}</div>` : ''}
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-medium border bg-white/60">
          ${order.status || 'новый'}
        </span>
      </div>

      <div class="text-xs text-gray-500 mb-2">
        ${created ? created.toLocaleString() : ''}
      </div>

      <div class="border rounded-2xl p-2 mb-3 max-h-[50vh] overflow-y-auto">
        ${
          items.length
            ? items.map(i => `
                <div class="flex justify-between text-sm py-0.5">
                  <div class="mr-2">${i.name}</div>
                  <div class="whitespace-nowrap">${i.qty} × ${i.price}</div>
                </div>
              `).join('')
            : '<div class="text-sm text-gray-400">Нет позиций</div>'
        }
      </div>

      <div class="flex items-center justify-between font-semibold">
        <div>Итого:</div>
        <div>${total} ₽</div>
      </div>
    `;

    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // закрыть модалку
  function closeOrderOverlay() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  if (overlayClose) {
    overlayClose.onclick = () => closeOrderOverlay();
  }

  // клик по тёмному фону – тоже закрывает
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOrderOverlay();
  });

  // ====== /ОВЕРЛЕЙ ======
function orderCard(o) {
  const items = Array.isArray(o.items) ? o.items : [];

  const clientTotal = items.reduce(
    (s, i) => s + (i.price || 0) * (i.qty || 0),
    0
  );
  const total   = Math.max(typeof o.total === 'number' ? o.total : 0, clientTotal);
  const created = o.createdAt ? new Date(o.createdAt) : new Date();

  const colorMap = {
    'новый':     'bg-yellow-50 border-yellow-300',
    'готовится': 'bg-blue-50 border-blue-300',
    'в пути':    'bg-purple-50 border-purple-300',
    'готов':     'bg-green-50 border-green-300',
    'завершён':  'bg-gray-100 border-gray-300',
    'отменён':   'bg-red-50 border-red-300'
  };
  const statusColor = colorMap[o.status] || 'bg-white border-gray-200';

  // --- экранная версия: максимум 3 позиции ---
  const MAX_INLINE  = 3;
  const hasMore     = items.length > MAX_INLINE;
  const inlineItems = hasMore ? items.slice(0, MAX_INLINE) : items;

  const itemsHtmlScreen = inlineItems.map(i => `
      <div class="flex justify-between">
        <div class="mr-2">${i.name}</div>
        <div class="font-semibold whitespace-nowrap">${i.qty} × ${i.price}</div>
      </div>
    `).join('');

  const etaBlock = o.etaUntil
    ? `<div class="text-sm text-gray-700 mt-1">
         Готово примерно в ${new Date(o.etaUntil).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
       </div>`
    : '';

  // --- печатная версия: ВСЕ позиции, только название + qty ---
  const itemsHtmlPrint = items.map(i => `
      <div class="flex justify-between text-sm">
        <div class="mr-2">${i.name}</div>
        <div class="whitespace-nowrap">× ${i.qty}</div>
      </div>
    `).join('') || '<div class="text-sm text-gray-400">Нет позиций</div>';

  const card = el(`
    <div
      class="
        order-card
        p-4 rounded-3xl border-2 ${statusColor} shadow-sm
        flex flex-col gap-2
        transition-transform hover:scale-[1.01] hover:shadow-md
      "
      data-id="${o.id}"
    >
      <!-- ЭКРАННАЯ ЧАСТЬ -->
      <div class="order-card-main">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xl font-extrabold tracking-tight">#${o.id || '—'}</div>
            ${o.table ? `<div class="text-xs text-gray-700 mt-0.5">Столик: №${o.table}</div>` : ''}
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-medium border bg-white/50">
            ${o.status || 'новый'}
          </span>
        </div>

        <div class="text-gray-600 text-xs mt-1">
          ${created.toLocaleString()}
        </div>

        ${etaBlock}

        <!-- список позиций (кратко) -->
        <div class="order-card-items mt-2 grid gap-1 text-sm">
          ${itemsHtmlScreen || '—'}
          ${hasMore ? `<div class="text-xs text-blue-700 mt-1">…ещё позиций</div>` : ''}
        </div>

        <!-- Итоговая сумма -->
        <div class="mt-2 flex items-center justify-between text-lg font-bold">
          <span>Итого:</span>
          <div>${total} ₽</div>
        </div>

      <!-- Кнопки управления, только на экране -->
<div class="mt-3 flex flex-col items-center gap-2 no-print">
  <button
    type="button"
    class="w-full max-w-[140px] px-3 py-2 rounded-xl border bg-white hover:bg-gray-100 text-sm flex items-center justify-center gap-1"
    data-act="print"
    title="Печать этого заказа"
  >
    🖨️ Печать
  </button>

  <button
    type="button"
    class="w-full max-w-[140px] px-3 py-2 rounded-xl border bg-white hover:bg-gray-100 text-sm"
    data-act="ready"
  >
    Оплачено
  </button>

  <button
    type="button"
    class="w-full max-w-[140px] px-3 py-2 rounded-xl border bg-red-50 hover:bg-red-100 text-red-600 text-sm"
    data-act="delete"
  >
    Удалить
  </button>
</div>
      </div>

      <!-- ПЕЧАТНАЯ ЧАСТЬ (показывается только @media print) -->
      <div class="order-card-print text-sm">
        <div class="text-base font-extrabold mb-1">#${o.id || '—'}</div>
        ${o.table ? `<div class="mb-1">Столик: №${o.table}</div>` : ''}
        <div class="mt-1 pt-1 border-t border-gray-300">
          ${itemsHtmlPrint}
        </div>
      </div>
    </div>
  `);

  // обработка кликов по карточке
  card.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');

    // 1) Клик по кнопкам "Готово" / "Удалить"
    if (btn) {
      const act = btn.dataset.act;

      if (act === 'print') {
  // печатаем ТОЛЬКО эту карточку
  const listEl = document.getElementById('list');
  if (!listEl) return;

  // включаем режим "одна карточка"
  listEl.classList.add('print-one-mode');

  // снимаем старые метки
  listEl.querySelectorAll('.order-card.print-one').forEach(x => x.classList.remove('print-one'));

  // помечаем текущую карточку
  card.classList.add('print-one');

  // печать
  window.print();

  // после печати — возвращаем как было
  setTimeout(() => {
    card.classList.remove('print-one');
    listEl.classList.remove('print-one-mode');
  }, 400);

  return;
}

      if (act === 'ready') {
        const nowTs = Date.now();
        const patch = { status: 'готов', readyAt: nowTs };

        const i = dashOrders.findIndex(x => String(x.id) === String(o.id));
        if (i >= 0) {
          dashOrders[i] = { ...dashOrders[i], ...patch };
          saveDash(dashOrders);
          syncOrderStatus(o.id, patch.status);
          showToast(`Заказ #${o.id} отмечен как готов`);
          renderOrders();
        }

        try { rpc({ op: 'update', id: o.id, patch }).catch(() => {}); } catch {}
        return;
      }

      if (act === 'delete') {
        if (!card.dataset.confirm) {
          card.dataset.confirm = '1';
          btn.textContent = 'Точно удалить?';
          setTimeout(() => {
            if (card && card.dataset.confirm === '1') {
              delete card.dataset.confirm;
              btn.textContent = 'Удалить';
            }
          }, 3000);
          return;
        }

        delete card.dataset.confirm;

        dashOrders = dashOrders.filter(x => String(x.id) !== String(o.id));
        saveDash(dashOrders);
        card.remove();
        showToast(`Заказ #${o.id} убран с табло (в истории он останется)`);

        const nowTs = Date.now();
        const patch = { status: 'завершён', finishedAt: nowTs };

        try {
          rpc({ op: 'update', id: o.id, patch }).catch(() => {});
        } catch {}
        return;
      }

      return;
    }

    // 2) Клик по самой карточке (не по кнопкам) – можно при желании
    //    оставить открытие модалки с полным описанием:
    openOrderOverlay(o);
  });

  return card;
}

  function renderOrders(){
    const unique = new Map();
    dashOrders.forEach(o => unique.set(String(o.id), o));
    const orders = [...unique.values()];
    list.innerHTML = '';
    orders.forEach(o => list.appendChild(orderCard(o)));
  }

  function load(){
    const unique = new Map();
    dashOrders.forEach(o => unique.set(String(o.id), o));

    const incoming = [...unique.keys()].filter(id => !knownIds.has(id));

    if (incoming.length){
      if (document.visibilityState === 'visible' && soundOn()){
        try {
          ding.currentTime = 0;
          ding.play().catch(()=>{});
        } catch {}
      } else if (document.visibilityState === 'hidden'){
        hiddenNewCount += incoming.length;
      }
    }

    knownIds = new Set(unique.keys());
    dashOrders = [...unique.values()];
    renderOrders();
  }

    root.querySelector('#btnClearAll').onclick = async () => {
    if (!confirm('Очистить только табло (заказы останутся в истории и отчётах)?')) return;

    const now = Date.now();
    // запоминаем, что все заказы до этого момента — "старые", их не показываем
    localStorage.setItem(DASH_CLEARED_AFTER_KEY, String(now));

    dashOrders = [];
    saveDash(dashOrders);
    window.__dashOrders = dashOrders;
    knownIds = new Set();
    load();

    showToast('Табло очищено. Все заказы остались на сервере.');
  };

    root.querySelector('#btnClearHistory').onclick = async () => {
    const pin = prompt('Введите PIN для очистки истории:');

    if (pin === null) {
      // нажал "Отмена"
      return;
    }

    if (pin !== 'zamir05') {
      showToast('Неверный PIN');
      return;
    }

    if (!confirm('Точно удалить всю историю заказов на сервере? Это также очистит отчёты.')) {
      return;
    }

    try {
      await rpc({ op: 'clear' });

      // локально тоже всё обнуляем
      dashOrders = [];
      saveDash(dashOrders);
      window.__dashOrders = dashOrders;
      knownIds = new Set();
      localStorage.removeItem(DASH_CLEARED_AFTER_KEY);
      load();

      showToast('История заказов на сервере очищена');
    } catch (e) {
      console.warn('btnClearHistory clear error', e);
      showToast('Не удалось очистить историю на сервере');
    }
  };

async function loadOrdersFromCloud(){
  try{
    const res = await rpc({ op:'list' });
    if (Array.isArray(res.orders)){
      // берём только активные заказы:
      // не показываем завершённые и отменённые
      let serverOrders = res.orders.filter(o =>
        o.status !== 'завершён' && o.status !== 'отменён'
      );

      // фильтруем по моменту последней очистки табло
      const clearedAfter = Number(localStorage.getItem(DASH_CLEARED_AFTER_KEY) || 0);
      if (clearedAfter) {
        serverOrders = serverOrders.filter(o => {
          const t = Number(o.createdAt || 0);
          return !t || t >= clearedAfter;
        });
      }

      saveDash(serverOrders);
      dashOrders = serverOrders.slice();
      window.__dashOrders = dashOrders;
      load();
    }
  } catch(e){
    console.warn('loadOrdersFromCloud', e);
  }
}
  
  load();
  loadOrdersFromCloud();
  pollTimer = setInterval(loadOrdersFromCloud, 3000);

  root.cleanup = () => {
    if (pollTimer) clearInterval(pollTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  return root;
}

/* ===== КОНСТРУКТОР (меню) ===== */
function BuilderView(){
  const cfg = loadConfig();
  let openCatKey = null; // запоминаем открытую категорию

  const root = el(`
    <div class="grid gap-4 pb-28">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Конструктор меню</h2>
        <button id="backBtn2" class="px-3 py-2 rounded-xl border">Назад</button>
      </div>

      <section class="card p-4">
        <h3 class="font-semibold mb-2">Настройки</h3>

        <div class="grid gap-2">
          <label class="text-xs text-gray-500">Название заведения</label>
          <input
            id="brandTitleInput"
            class="border rounded-xl p-3 font-semibold"
            placeholder="Например: ZM TIME"
            value="${(cfg.brandTitle || '').replace(/"/g,'&quot;')}"
          >
        </div>
      </section>

      <section class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold">Категории и товары</h3>
          <button id="addCatBtn" class="px-3 py-2 rounded-xl border">+ Категория</button>
        </div>
        <div id="catsBox" class="grid gap-4"></div>
      </section>

      <div class="flex gap-2">
        <button id="applyBtn" class="px-4 py-3 rounded-xl bg-black text-white">
          Сохранить и обновить меню
        </button>
      </div>
    </div>
  `);

  const catsBox = root.querySelector('#catsBox');

  function render(){
    catsBox.innerHTML = '';

    cfg.menu.forEach((cat, cidx) => {
      // миграция старого promoUrl → в массив promo
      if (!Array.isArray(cat.promo)) {
        cat.promo = cat.promoUrl ? [cat.promoUrl] : [];
      }
      // максимум 5 URL
      cat.promo = cat.promo.slice(0, 5);

      const catCard = el(`
        <details class="border rounded-2xl p-3 bg-white" data-cat="${cat.key}">
          <summary class="flex items-center justify-between cursor-pointer select-none">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-semibold truncate">${cat.title}</span>
              <span class="text-xs text-gray-500">(${cat.items.length})</span>
            </div>
            <span class="chev text-gray-500">▼</span>
          </summary>

          <div class="mt-3">
            <div class="flex items-center justify-between">
              <input
                value="${cat.title}"
                class="border rounded-xl p-2 font-semibold w-1/2"
                data-k="title"
              >
              <div class="flex gap-2">
                <button class="px-2 py-1 rounded-lg border" data-act="up">↑</button>
                <button class="px-2 py-1 rounded-lg border" data-act="down">↓</button>
                <button class="px-2 py-1 rounded-lg border text-red-600" data-act="del">Удалить</button>
              </div>
            </div>

            <div class="text-xs text-gray-500 mt-1">
              key: <code>${cat.key}</code>
            </div>

            <div class="mt-2">
              <div class="text-xs text-gray-600 mb-1">Акции (до 5 картинок для карусели)</div>
              <div class="grid gap-1" data-promo-box></div>
            </div>

            <div class="mt-3">
              <button class="px-3 py-2 rounded-xl border" data-act="addItem">+ Товар</button>
            </div>

            <div class="mt-3 grid gap-2" data-items></div>
          </div>
        </details>
      `);

      // восстановление открытого трея
      if (openCatKey === cat.key) catCard.open = true;

      // промо (5 строк)
      const promoBox = catCard.querySelector('[data-promo-box]');
      const renderPromos = () => {
        promoBox.innerHTML = '';

        let promos = Array.isArray(cat.promo) ? cat.promo.slice(0, 5) : [];
        while (promos.length < 5) promos.push('');
        cat.promo = promos;

        promos.forEach((url, idx) => {
          const line = el(`
            <div class="flex items-center gap-1">
              <input
                class="flex-1 border rounded-lg p-2 text-xs"
                placeholder="URL акции ${idx + 1}"
                value="${url || ''}"
                data-promo-idx="${idx}"
              >
            </div>
          `);

          const input = line.querySelector('input');
          input.addEventListener('input', (e) => {
            const i = Number(e.target.dataset.promoIdx || 0);
            cat.promo[i] = (e.target.value || '').trim();

            // совместимость
            const firstNonEmpty = cat.promo.find(u => u && u.trim()) || '';
            cat.promoUrl = firstNonEmpty || '';
          });

          promoBox.appendChild(line);
        });
      };
      renderPromos();

      // товары
      const itemsBox = catCard.querySelector('[data-items]');
      cat.items.forEach((it, iidx) => {
        const row = el(`
                   <div class="grid grid-cols-12 gap-2 border rounded-xl p-2">
  <input class="col-span-4 min-w-0 w-full border rounded-lg p-2"
    placeholder="Название" value="${it.name || ''}" data-k="name">

  <input class="col-span-2 min-w-0 w-full border rounded-lg p-2"
    type="number" placeholder="Цена (бол)" value="${it.price || 0}" data-k="price">

  <input class="col-span-2 min-w-0 w-full border rounded-lg p-2"
    type="number" placeholder="Цена (мал)" value="${it.priceSmall || 0}" data-k="priceSmall">

  <input class="col-span-2 min-w-0 w-full border rounded-lg p-2 text-xs"
    placeholder="URL фото" value="${it.img || ''}" data-k="img">

  <div class="col-span-2 flex flex-col items-end gap-1 justify-start">
    <label class="text-[10px] leading-none flex items-center gap-1 whitespace-nowrap select-none">
      <input type="checkbox" data-k="sized" ${it.sized ? 'checked' : ''}>
      <span>бол/мал</span>
    </label>
    <button class="px-2 py-1 rounded-md border" data-act="iUp">↑</button>
    <button class="px-2 py-1 rounded-md border" data-act="iDown">↓</button>
    <button class="px-2 py-1 rounded-md border text-red-600" data-act="iDel">✕</button>
  </div>
</div>
        `);

        row.addEventListener('input', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;

  if (k === 'price' || k === 'priceSmall') {
    cat.items[iidx][k] = Number(e.target.value || 0);
    return;
  }

  if (k === 'sized') {
    cat.items[iidx].sized = !!e.target.checked;
    // если включили размеры и не задана priceSmall — подставим копию price
    if (cat.items[iidx].sized && !cat.items[iidx].priceSmall) {
      cat.items[iidx].priceSmall = Number(cat.items[iidx].price || 0);
    }
    return;
  }

  cat.items[iidx][k] = e.target.value;
});

        row.addEventListener('click', (e) => {
          const act = e.target.dataset.act;
          if (!act) return;

          if (act === 'iDel') { cat.items.splice(iidx, 1); render(); return; }

          if (act === 'iUp' && iidx > 0) {
            [cat.items[iidx - 1], cat.items[iidx]] = [cat.items[iidx], cat.items[iidx - 1]];
            render(); return;
          }

          if (act === 'iDown' && iidx < cat.items.length - 1) {
            [cat.items[iidx + 1], cat.items[iidx]] = [cat.items[iidx], cat.items[iidx + 1]];
            render(); return;
          }
        });

        itemsBox.appendChild(row);
      });

      // изменение названия категории
      catCard.addEventListener('input', (e) => {
        const k = e.target.dataset.k;
        if (k === 'title') cat.title = e.target.value;
      });

      // кнопки категории
      catCard.addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (!act) return;

        if (act === 'del') {
          if (confirm('Удалить категорию?')) {
            cfg.menu.splice(cidx, 1);
            render();
          }
          return;
        }

        if (act === 'up' && cidx > 0) {
          [cfg.menu[cidx - 1], cfg.menu[cidx]] = [cfg.menu[cidx], cfg.menu[cidx - 1]];
          render(); return;
        }

        if (act === 'down' && cidx < cfg.menu.length - 1) {
          [cfg.menu[cidx + 1], cfg.menu[cidx]] = [cfg.menu[cidx], cfg.menu[cidx + 1]];
          render(); return;
        }

        if (act === 'addItem') {
          cat.items.push({ name: 'Новый товар', price: 0, priceSmall: 0, sized: false, img: '' });
          render(); return;
        }
      });

      // аккордеон: открыта только одна
      catCard.addEventListener('toggle', () => {
        if (catCard.open) {
          openCatKey = cat.key;
          catsBox.querySelectorAll('details').forEach(d => { if (d !== catCard) d.open = false; });
        } else {
          if (openCatKey === cat.key) openCatKey = null;
        }
      });

      catsBox.appendChild(catCard);
    });
  }

  // стартовый рендер
  render();

  // новая категория
  root.querySelector('#addCatBtn').onclick = () => {
    const id = 'cat' + (Date.now().toString().slice(-5));
    cfg.menu.push({ key: id, title: 'Новая категория', items: [], promo: [] });
    render();
  };

  // сохранить меню
  root.querySelector('#applyBtn').onclick = async () => {
    saveConfig(cfg);
    applyTheme(cfg.theme);
    MENU_CATEGORIES = cfg.menu.slice();

    try {
      await rpc({ op: 'config_set', config: cfg });
    } catch (e) {
      console.warn('config_set error', e);
      showToast('Меню сохранено локально, но сервер недоступен');
      history.length ? history.back() : (location.hash = '#/dashboard');
      return;
    }

    showToast('Меню сохранено (сервер)');
    history.length ? history.back() : (location.hash = '#/dashboard');
  };

  // назад
  root.querySelector('#backBtn2').onclick = () => {
    if (history.length) history.back();
    else location.hash = '#/dashboard';
  };

    // --- brandTitle ---
  const brandTitleInput = root.querySelector('#brandTitleInput');
  if (brandTitleInput) {
    brandTitleInput.addEventListener('input', () => {
      cfg.brandTitle = (brandTitleInput.value || '').trim();
    });
  }
  
  return root;
}

/* ===== 4-тап зона ===== */
function bindTabloTapZone(){
  const hot = document.getElementById('profileBtn');
  if (!hot || hot._bound) return;
hot._bound = true;
  let taps = 0, first = 0, timer = null;
  const windowMs = 1200;
  function reset(){ taps = 0; first = 0; if (timer){ clearTimeout(timer); timer = null; } }
  function handler(){
    const now = Date.now();
    if (!first) first = now; taps++;
    if (now - first > windowMs){ reset(); taps = 1; first = now; }
    if (taps >= 4){
  reset();
  document.getElementById('payModal')?.classList.remove('open');

  // всегда только через PIN
  sessionStorage.setItem(WANT_DASH, '1');
  document.getElementById('pinModal').classList.add('open');
} else {
  if (timer) clearTimeout(timer);
  timer = setTimeout(reset, windowMs);
}
  }
  ['click','pointerup','touchend'].forEach(ev => hot.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); handler(); }, {passive:false}));
}

/* ===== Router ===== */
function mount(view){
  const app = document.getElementById('app');
  if (app.firstChild && typeof app.firstChild.cleanup === 'function') {
    try { app.firstChild.cleanup(); } catch {}
  }
  app.innerHTML = '';
  app.classList.add('phone-shell');
  app.appendChild(view);
}

function realRouter(){
  const h = location.hash.split('?')[0];
  if (h === '#/profile-edit') mount(ProfileEditView());
  else if (h === '#/history') mount(HistoryView());
  else if (h === '#/dashboard') mount(DashboardView());
  else if (h === '#/builder') mount(BuilderView());
  else mount(OrderView());
}

// просто решает, какой хедер показывать и можно ли идти на табло
function router(){
  const h = location.hash.split('?')[0];
  const profileBtn = document.getElementById('profileBtn');
  const backBtn    = document.getElementById('backBtn');

  const showBack =
    h === '#/history' ||
    h === '#/profile-edit' ||
    h === '#/builder';

  if (showBack) {
    profileBtn.classList.add('hidden');
    backBtn.classList.remove('hidden');
  } else {
    backBtn.classList.add('hidden');
    profileBtn.classList.remove('hidden');
  }

 // защищаем табло PIN-ом: каждый раз
if (h === '#/dashboard') {
  const canEnterOnce = sessionStorage.getItem(TABLO_PIN_OK) === '1';

  if (canEnterOnce) {
    // расходуем одноразовый допуск
    sessionStorage.removeItem(TABLO_PIN_OK);
    realRouter();
  } else {
    sessionStorage.setItem(WANT_DASH, '1');
    document.getElementById('pinModal').classList.add('open');
    const app = document.getElementById('app');
    if (app) app.innerHTML = '';
  }
  return;
}

realRouter();
}

// реагируем на смену hash
window.addEventListener('hashchange', () => {
  try { router(); } catch (e) { console.error(e); }
});

// === общий старт приложения ===
document.addEventListener('DOMContentLoaded', async () => {
  initTableIdFromUrl();

    // подставляем иконку
  const iconEl = document.getElementById('brandIcon');
  if (iconEl && BRAND_ICON_URL) {
    iconEl.src = BRAND_ICON_URL;
  }

  // дефолтный роут
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    location.hash = '#/order';
  }

  // 1) сначала подтягиваем актуальное меню/наличие
  try { await fetchRemoteConfig(); } catch (e) {}
  try { await fetchUnavailableRemote(); } catch (e) {}

  // 2) только потом рисуем UI (без “старого меню” на первом запуске)
  router();

  // кнопка "Назад" в шапке идёт всегда на /order
  const backButton = document.getElementById('backBtn');
  const goOrder = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    location.hash = '#/order';
  };
  ['click', 'pointerup', 'touchend'].forEach(ev =>
    backButton.addEventListener(ev, goOrder, { passive: false })
  );

  // скрытый вход на табло по 4-тапу
  bindTabloTapZone();

  // --- PIN-модалка ---
  const pinM     = document.getElementById('pinModal');
  const pinOk    = document.getElementById('pinOk');
  const pinCancel= document.getElementById('pinCancel');
  const pinInput = document.getElementById('pinInput');

  const ADMIN_PIN = 'zamir05'; // ← поменяй как хочешь

function normalizePin(v){
  return String(v || '').trim();
}

function openPinModal(){
  pinM.classList.add('open');
  pinInput.value = '';
  // фокус чуть позже, чтобы модалка успела открыться
  setTimeout(() => pinInput.focus(), 50);
}

function closePinModal(){
  pinM.classList.remove('open');
  pinInput.value = '';
}

pinOk.onclick = (e) => {
  e && e.preventDefault();

  const entered = normalizePin(pinInput.value);

  if (!entered) {
    showToast('Введите PIN');
    return;
  }

  // ✅ строгая проверка
  if (entered !== ADMIN_PIN) {
    showToast('Неверный PIN');
    pinInput.value = '';
    pinInput.focus();
    return;
  }

  // ✅ только после верного PIN выдаём допуск
  closePinModal();

  // это ключ для админ RPC (если бэк его проверяет)
  sessionStorage.setItem(ADMIN_KEY_SS, entered);

  if (sessionStorage.getItem(WANT_DASH) === '1') {
    sessionStorage.removeItem(WANT_DASH);
    sessionStorage.setItem(TABLO_PIN_OK, '1');
    location.hash = '#/dashboard';
  } else {
    router();
  }
};

pinCancel.onclick = () => {
  closePinModal();
  sessionStorage.removeItem(ADMIN_KEY_SS);
  sessionStorage.removeItem(WANT_DASH);
  location.hash = '#/order';
};

pinM.onclick = (e) => {
  if (e.target === pinM) pinCancel.onclick();
};

// ✅ удобно: Enter подтверждает
pinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') pinOk.click();
});

  pinCancel.onclick = () => {
    pinM.classList.remove('open');
    sessionStorage.removeItem(ADMIN_KEY_SS);
    sessionStorage.removeItem(WANT_DASH);
    location.hash = '#/order';
  };

  pinM.onclick = (e) => {
    if (e.target === pinM) pinCancel.onclick();
  };

  // --- Service worker ---
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered (cleanup mode)');
    } catch (e) {
      console.warn('SW registration failed', e);
    }
  }

  // --- WebPush ---
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          initPushSubscription().catch(() => {});
        }
      } catch (e) {
        console.warn('Notification permission error', e);
      }
    } else if (Notification.permission === 'granted') {
      initPushSubscription().catch(() => {});
    }
  }
});


  
  window.addEventListener('load', () => {
  setTimeout(() => {
    // старый, но иногда рабочий трюк — прокрутить страницу на 1px,
    // чтобы браузер спрятал адресную строку
    window.scrollTo(0, 1);
  }, 250);
});
