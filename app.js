import { OrderView } from './order-view.js';
import { DashboardView } from './dashboard-view.js';
import { PublicBoardView } from './public-board-view.js';
import { BuilderView } from './builder-view.js';

/* ====== КОНСТАНТЫ ====== */
export const API_URL = '/api/order';
export const CONFIG_REMOTE_URL = '';

// LS keys
export const CLIENT_HISTORY_KEY = 'orders_client_history_v1'; // история клиента (но мы её не используем)
export const DASHBOARD_LS_KEY   = 'dashboard_orders_v1';
export const CONFIG_LS_KEY      = 'app_config_v1';
export const SOUND_ON_KEY       = 'sound_on_v1';

export const TABLO_PIN_OK     = 'TABLO_PIN_OK';
export const WANT_ADMIN_ROUTE = 'WANT_ADMIN_ROUTE';
export const WANT_EXIT_BOARD  = 'WANT_EXIT_BOARD';

/* ===== утилиты ===== */
export const el = (html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; };
export const showToast = (msg)=>{
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'), 1800);
};
export const money = (x)=> `${x} руб.`;
export const setBodyScrollLock = (on)=> document.body.style.overflow = on ? 'hidden' : '';

export function safeParse(k, f){
  try{
    const v=JSON.parse(localStorage.getItem(k)||'null');
    if(v==null) return f;
    if(Array.isArray(f)) return Array.isArray(v)?v:[];
    if(typeof f==='object') return v&&typeof v==='object'?v:{};
    return v;
  }catch{ return f }
}

/* ===== RPC ===== */
export async function rpc(payload){
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify(payload || {})
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`RPC ${res.status}: ${t}`);
  }
  return res.json();
}

/* ===== Конфиг (меню) ===== */
export const DEFAULT_CONFIG = {
  brandTitle: 'ЯмаMoto',
  terminalAdUrl: "",
  terminalAdType: "video", // "video" | "gif"
  sbpPayBaseUrl: "", // база СБП (например https://pay.yoursite.ru/sbp)
  theme: {
    cardRadius:20, imgRadius:12, imgW:110, imgH:70, cardMinH:104, showPrice:true
  },
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
      { name:'Добрый кола', price:100 },
      { name:'Добрый апельсин', price:100 },
      { name:'Добрый лайм', price:100 },
      { name:'фдэт-уайт', price:100 },
      { name:'Раф банан', price:100 },
      { name:'Эспрессо', price:100 }
    ]},
    { key:'sushi', title:'Суши / роллы', items:[
      { name:'Калифорния', price:350 },
      { name:'Филадельфия', price:390 },
      { name:'Аляска', price:350 }
    ]},
  ]
};

export function loadConfig(){ return safeParse(CONFIG_LS_KEY, DEFAULT_CONFIG); }
export function saveConfig(cfg){ localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(cfg||DEFAULT_CONFIG)); }

export function applyTheme(theme){
  const r = document.documentElement;
  r.style.setProperty('--card-radius',  (theme.cardRadius||20)+'px');
  r.style.setProperty('--img-radius',   (theme.imgRadius||12)+'px');
  r.style.setProperty('--img-w',        (theme.imgW||110)+'px');
  r.style.setProperty('--img-h',        (theme.imgH||70)+'px');
  r.style.setProperty('--card-min-h',   (theme.cardMinH||104)+'px');
  document.getElementById('brandTitle').textContent = (loadConfig().brandTitle||'ЯмаMoto');
}

export function calcConfigVersion(cfg) {
  try { return JSON.stringify((cfg && cfg.menu) || []).length; }
  catch { return 0; }
}

export async function fetchRemoteConfig(){
  if (CONFIG_REMOTE_URL){
    try{
      const res = await fetch(CONFIG_REMOTE_URL, { cache:'no-cache' });
      if(res.ok){
        const json = await res.json();
        if(json && json.menu){
          saveConfig(json);
          applyTheme(json.theme||{});
          return json;
        }
      }
    }catch(e){ console.warn('fetchRemoteConfig URL', e); }
  }

  try{
    const res = await rpc({ op: 'config_get' });
    if (res && res.config && Array.isArray(res.config.menu)){
      saveConfig(res.config);
      applyTheme(res.config.theme||{});
      return res.config;
    }
  }catch(e){ console.warn('fetchRemoteConfig RPC', e); }

  return null;
}

/* ===== Dash LS ===== */
export function loadDash(){ return safeParse(DASHBOARD_LS_KEY, []); }
export function saveDash(list){
  const arr = Array.isArray(list) ? list : [];
  localStorage.setItem(DASHBOARD_LS_KEY, JSON.stringify(arr));
}

/* ===== Router mount ===== */
function mount(view){
  const app=document.getElementById('app');
  if(app.firstChild && typeof app.firstChild.cleanup==='function'){
    try{ app.firstChild.cleanup(); }catch{}
  }
  app.innerHTML='';
  app.classList.add('phone-shell');
  app.appendChild(view);
}

/* ===== Router ===== */
function realRouter(){
  const h=location.hash.split('?')[0];

  if(h==='#/dashboard') mount(DashboardView());
  else if(h==='#/board') mount(PublicBoardView());
  else if(h==='#/builder') mount(BuilderView());
  else mount(OrderView());
}

function router(){
  const h=location.hash.split('?')[0];

  // PIN защита всех админских экранов
  if((h==='#/dashboard' || h==='#/board' || h==='#/builder')
      && sessionStorage.getItem(TABLO_PIN_OK)!=='1'){
    sessionStorage.setItem(WANT_ADMIN_ROUTE, h);
    document.getElementById('pinModal')?.classList.add('open');
    const app=document.getElementById('app'); if(app) app.innerHTML='';
    return;
  }

  realRouter();
}

window.addEventListener('hashchange', ()=>{ try{ router(); }catch(e){ console.error(e); }});

document.addEventListener('DOMContentLoaded', async ()=>{
  // дефолтный роут
  if (!location.hash || location.hash==='#' || location.hash==='#/') location.hash='#/order';

  // плавающая кнопка → кухня
  document.getElementById('openDashBtn')?.addEventListener('click', ()=>{
    location.hash='#/dashboard';
  });

  // remote config
  await fetchRemoteConfig().catch(()=>{});

  // PIN modal logic
  const pinM=document.getElementById('pinModal');
  const pinOk=document.getElementById('pinOk');
  const pinCancel=document.getElementById('pinCancel');
  const pinInput=document.getElementById('pinInput');

  pinOk.onclick=(e)=>{
    e?.preventDefault();
    if((pinInput.value||'').trim().length>0){
      sessionStorage.setItem(TABLO_PIN_OK,'1');
      pinM.classList.remove('open');

      if (sessionStorage.getItem(WANT_EXIT_BOARD)==='1'){
        sessionStorage.removeItem(WANT_EXIT_BOARD);
        sessionStorage.removeItem(TABLO_PIN_OK);
        location.hash='#/order';
        return;
      }

      const want = sessionStorage.getItem(WANT_ADMIN_ROUTE) || '#/dashboard';
      sessionStorage.removeItem(WANT_ADMIN_ROUTE);
      location.hash = want;
    } else {
      showToast('Введите ключ');
    }
  };

  pinCancel.onclick=()=>{
    pinM.classList.remove('open');
    sessionStorage.removeItem(WANT_ADMIN_ROUTE);
    sessionStorage.removeItem(WANT_EXIT_BOARD);
    location.hash='#/order';
  };
  pinM.onclick=(e)=>{ if(e.target===pinM) pinCancel.onclick(); };

  // QR modal close
  document.getElementById('qrOk')?.addEventListener('click', ()=>{
    document.getElementById('qrModal')?.classList.remove('open');
  });
  document.getElementById('qrModal')?.addEventListener('click', (e)=>{
    if(e.target.id==='qrModal') e.target.classList.remove('open');
  });

  // pay modal outside close
  document.getElementById('payModal')?.addEventListener('click', (e)=>{
    if(e.target.id==='payModal') e.target.classList.remove('open');
  });

  router();

  // service worker без пушей
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); }
    catch(e){ console.warn('SW registration failed', e); }
  }
});
