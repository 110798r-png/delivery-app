/* =========================================================
   ЯмаMoto — терминал + кухня + табло зала + конструктор
   Экраны:
     #/order      — терминал выбора товаров (Экран 1)
     #/dashboard  — табло кухни (Экран 2, PIN)
     #/board      — табло зала (Экран 3, PIN вход/выход)
     #/builder    — конструктор меню (PIN)
   ========================================================= */

/* ====== КОНСТАНТЫ / RPC ====== */
const API_URL = '/api/order';
const CONFIG_REMOTE_URL = ''; // если вдруг появится отдельный JSON-URL

async function rpc(payload){
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify(payload || {})
  });
  if (!res.ok){
    const t = await res.text().catch(()=>res.statusText);
    throw new Error(`RPC ${res.status}: ${t}`);
  }
  return res.json();
}

/* ====== LS KEYS ====== */
const CLIENT_HISTORY_KEY = 'orders_client_history_v1'; // можно не показывать, но пусть хранит
const DASHBOARD_LS_KEY   = 'dashboard_orders_v1';
const CONFIG_LS_KEY      = 'app_config_v2';
const SOUND_ON_KEY       = 'sound_on_v1';
const TABLO_PIN_OK       = 'TABLO_PIN_OK';
const WANT_ADMIN_ROUTE   = 'WANT_ADMIN_ROUTE';
const WANT_EXIT_BOARD    = 'WANT_EXIT_BOARD';

/* ====== УТИЛИТЫ ====== */
const el = (html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; };
const showToast=(msg)=>{
  const t=document.getElementById('toast');
  if(!t) return;
  t.textContent=msg;
  t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'),1800);
};
const money=(x)=>`${x} руб.`;
const setBodyScrollLock=(on)=>document.body.style.overflow=on?'hidden':'';

function safeParse(k,f){
  try{
    const v=JSON.parse(localStorage.getItem(k)||'null');
    if(v==null) return f;
    if(Array.isArray(f)) return Array.isArray(v)?v:[];
    if(typeof f==='object') return v&&typeof v==='object'?v:{};
    return v;
  }catch{ return f; }
}
function loadHistory(){ return safeParse(CLIENT_HISTORY_KEY, []); }
function saveHistory(list){ localStorage.setItem(CLIENT_HISTORY_KEY, JSON.stringify(Array.isArray(list)?list:[])); }
function loadDash(){ return safeParse(DASHBOARD_LS_KEY, []); }
function saveDash(list){ localStorage.setItem(DASHBOARD_LS_KEY, JSON.stringify(Array.isArray(list)?list:[])); }

/* ====== КОНФИГ МЕНЮ ====== */
const DEFAULT_CONFIG = {
  brandTitle:'ЯмаMoto',
  terminalAdUrl:'',
  terminalAdType:'video', // video|gif
  sbpPayBaseUrl:'',       // например: https://pay.example/sbp
  theme:{ cardRadius:20,imgRadius:12,imgW:110,imgH:70,cardMinH:104,showPrice:true },
  menu:[
    { key:'burgers', title:'Бургеры', items:[{name:'Говяжий бургер',price:280,img:''}] }
  ]
};

function loadConfig(){ return safeParse(CONFIG_LS_KEY, DEFAULT_CONFIG); }
function saveConfig(cfg){ localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(cfg||DEFAULT_CONFIG)); }
function applyTheme(theme){
  const r=document.documentElement;
  r.style.setProperty('--card-radius',(theme.cardRadius||20)+'px');
  r.style.setProperty('--img-radius',(theme.imgRadius||12)+'px');
  r.style.setProperty('--img-w',(theme.imgW||110)+'px');
  r.style.setProperty('--img-h',(theme.imgH||70)+'px');
  r.style.setProperty('--card-min-h',(theme.cardMinH||104)+'px');
  const bt=document.getElementById('brandTitle');
  if(bt) bt.textContent=(loadConfig().brandTitle||'ЯмаMoto');
}
function calcConfigVersion(cfg){
  try{ return JSON.stringify((cfg&&cfg.menu)||[]).length; }
  catch{ return 0; }
}
let lastConfigVersion = calcConfigVersion(loadConfig());

async function fetchRemoteConfig(){
  if(CONFIG_REMOTE_URL){
    try{
      const res=await fetch(CONFIG_REMOTE_URL,{cache:'no-cache'});
      if(res.ok){
        const json=await res.json();
        if(json?.menu){
          saveConfig(json);
          applyTheme(json.theme||{});
          return json;
        }
      }
    }catch(e){ console.warn('remote cfg url',e); }
  }
  try{
    const res=await rpc({op:'config_get'});
    if(res?.config?.menu){
      saveConfig(res.config);
      applyTheme(res.config.theme||{});
      return res.config;
    }
  }catch(e){ /* сервер может быть офф */ }
  return null;
}

/* ====== АНИМАЦИИ ====== */
function easeInOutCubic(t){ return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
function animateScrollX(elm,to,{duration=280,onEnd}={}){
  const from=elm.scrollLeft, diff=to-from;
  if(!diff){ onEnd&&onEnd(); return; }
  const start=performance.now();
  function step(ts){
    const t=Math.min(1,(ts-start)/duration);
    elm.scrollLeft=from+diff*easeInOutCubic(t);
    if(t<1) requestAnimationFrame(step);
    else onEnd&&onEnd();
  }
  requestAnimationFrame(step);
}

/* =========================================================
   ===============   ЭКРАН 1 — ТЕРМИНАЛ   ==================
   ========================================================= */
function OrderView(){
  const cfg=loadConfig();
  applyTheme(cfg.theme||{});

  const escAttr=(val)=>{
    if(window.CSS && typeof CSS.escape==='function') return CSS.escape(val);
    return String(val).replace(/"/g,'\\"');
  };

  const root=el(`
    <div class="relative">
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
          <button id="confirmBtn"
            class="px-4 py-2 rounded-xl bg-black text-white flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled>Оформить заказ</button>
        </div>
      </div>
    </div>
  `);

  const categoryBar=root.querySelector('#categoryBar');
  const catPager=root.querySelector('#catPager');
  const totalEl=root.querySelector('#totalVal');
  const confirmBtn=root.querySelector('#confirmBtn');

  setBodyScrollLock(true);
  confirmBtn._busy=false;

  let activeIdx=0, isAnimating=false;
  const scrollMemory=new Map();
  const panelW=()=>catPager.getBoundingClientRect().width||1;

  /* --- idle-реклама --- */
  const adOverlay=el(`
    <div id="adOverlay" class="fixed inset-0 bg-black hidden z-[9999] flex items-center justify-center">
      <video id="adVideo" class="w-full h-full object-cover hidden" muted loop playsinline></video>
      <img id="adImg" class="w-full h-full object-cover hidden" />
    </div>
  `);
  document.body.appendChild(adOverlay);

  function showAd(){
    const c=loadConfig();
    const url=c.terminalAdUrl;
    if(!url) return;
    const v=adOverlay.querySelector('#adVideo');
    const i=adOverlay.querySelector('#adImg');
    adOverlay.classList.remove('hidden');
    if(c.terminalAdType==='gif'){
      v.pause(); v.classList.add('hidden');
      i.classList.remove('hidden'); i.src=url;
    }else{
      i.classList.add('hidden');
      v.classList.remove('hidden'); v.src=url; v.play().catch(()=>{});
    }
  }
  function hideAd(){ adOverlay.classList.add('hidden'); }
  let idleT=null;
  function resetIdle(){
    if(idleT) clearTimeout(idleT);
    hideAd();
    idleT=setTimeout(showAd,15000);
  }
  ['click','pointerdown','touchstart','scroll','wheel'].forEach(ev=>{
    root.addEventListener(ev, resetIdle, {passive:true});
  });
  resetIdle();

  /* --- chips категорий --- */
  cfg.menu.forEach((cat,idx)=>{
    categoryBar.appendChild(el(`
      <button type="button"
        class="px-3 py-1.5 rounded-full border text-sm whitespace-nowrap ${idx===0?'bg-black text-white border-black':'bg-white/50'}"
        data-idx="${idx}">${cat.title}</button>
    `));
  });

  function highlightChip(idx){
    const btns=categoryBar.querySelectorAll('button');
    btns.forEach((b,i)=>{
      const on=i===idx;
      b.classList.toggle('bg-black',on);
      b.classList.toggle('text-white',on);
      b.classList.toggle('border-black',on);
      if(on) b.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
    });
  }

  function goToIndex(idx,{animate=true}={}){
    idx=Math.max(0,Math.min(cfg.menu.length-1,idx));
    const target=Math.round(panelW()*idx);
    highlightChip(idx);

    const box=catPager.children[idx]?.querySelector('.v-scroll');

    if(!animate){
      const old=catPager.children[activeIdx]?.querySelector('.v-scroll');
      if(old) scrollMemory.set(cfg.menu[activeIdx].key, old.scrollTop);
      catPager.scrollLeft=target;
      if(box) box.scrollTop=scrollMemory.get(cfg.menu[idx].key)||0;
      activeIdx=idx; return;
    }

    isAnimating=true;
    const prevSnap=catPager.style.scrollSnapType;
    catPager.style.scrollSnapType='none';

    const old=catPager.children[activeIdx]?.querySelector('.v-scroll');
    if(old) scrollMemory.set(cfg.menu[activeIdx].key, old.scrollTop);

    animateScrollX(catPager,target,{
      duration:280,
      onEnd(){
        const box2=catPager.children[idx]?.querySelector('.v-scroll');
        if(box2) box2.scrollTop=scrollMemory.get(cfg.menu[idx].key)||0;
        activeIdx=idx; isAnimating=false;
        catPager.style.scrollSnapType=prevSnap||'x mandatory';
      }
    });
  }

  categoryBar.addEventListener('click',(e)=>{
    const b=e.target.closest('button[data-idx]');
    if(!b||isAnimating) return;
    goToIndex(+b.dataset.idx,{animate:true});
  });

  /* --- меню --- */
  function rebuildMenu(){
    catPager.innerHTML='';
    cfg.menu.forEach(cat=>{
      const panel=el(`<div class="cat-panel"></div>`);
      const vbox=el(`<div class="v-scroll px-0.5"></div>`);
      const list=el(`<div class="grid gap-3"></div>`);

      cat.items.forEach(it=>{
        const q=(window.__orderCounts?.[it.name]||0);
        list.appendChild(el(`
          <div class="menu-card">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm">${it.name}</div>
              ${cfg.theme.showPrice?`<div class="text-xs text-gray-500 mt-1">${money(it.price||0)}</div>`:''}
              <div class="flex items-center gap-3 mt-3">
                <button type="button" class="w-8 h-8 rounded-xl border" data-name="${it.name}" data-act="dec">−</button>
                <div class="w-6 text-center text-sm" data-q="${it.name}">${q}</div>
                <button type="button" class="w-8 h-8 rounded-xl bg-black text-white" data-name="${it.name}" data-act="inc">+</button>
              </div>
            </div>
            <img src="${it.img||'https://placehold.co/110x70?text=food'}" class="menu-card-img" alt="">
          </div>
        `));
      });

      list.appendChild(el(`<div class="h-24"></div>`));
      vbox.appendChild(list);
      panel.appendChild(vbox);
      catPager.appendChild(panel);

      // touch swipe между категориями
      let down=false, used=false, sx=0, sy=0, locked=null;
      const PIX_LOCK=10;
      const THRESH=()=>Math.max(40,panelW()*0.25);

      function onDown(e){
        if(e.pointerType!=='touch'||isAnimating) return;
        down=true; used=false; sx=e.clientX; sy=e.clientY; locked=null;
        vbox.setPointerCapture?.(e.pointerId);
      }
      function onMove(e){
        if(e.pointerType!=='touch'||!down||used||isAnimating) return;
        const dx=e.clientX-sx, dy=e.clientY-sy;
        if(locked===null){
          if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>PIX_LOCK) locked='x';
          else if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>PIX_LOCK) locked='y';
        }
        if(locked==='x'){
          e.preventDefault();
          if(Math.abs(dx)>=THRESH()){
            used=true;
            goToIndex(dx<0?activeIdx+1:activeIdx-1,{animate:true});
          }
        }
      }
      function onUp(){ down=false; used=false; locked=null; }
      vbox.addEventListener('pointerdown',onDown,{passive:true});
      vbox.addEventListener('pointermove',onMove,{passive:false});
      ['pointerup','pointercancel','pointerleave'].forEach(ev=>vbox.addEventListener(ev,onUp));
    });
  }

  // делегирование +/- 
  catPager.addEventListener('click',(e)=>{
    const btn=e.target.closest('button[data-act]');
    if(!btn) return;
    const name=btn.dataset.name;
    const delta=btn.dataset.act==='inc'?1:-1;
    const selector=`[data-q="${escAttr(name)}"]`;
    const cur=parseInt(catPager.querySelector(selector)?.textContent||'0',10)||0;
    const next=Math.max(0,cur+delta);
    catPager.querySelectorAll(selector).forEach(n=>n.textContent=String(next));
    window.__orderCounts=window.__orderCounts||{};
    window.__orderCounts[name]=next;
    recalcTotal();
  });

  function applyHeights(){
    try{
      const headerH=document.querySelector('.brand-strip')?.getBoundingClientRect().height||0;
      const chipsH=root.querySelector('.sticky-top')?.getBoundingClientRect().height||0;
      const confirmH=root.querySelector('#confirmBar')?.getBoundingClientRect().height||0;
      const availH=Math.max(260,window.innerHeight-headerH-chipsH-confirmH-8);
      const first=root.querySelector('.menu-card');
      const cardH=first?Math.ceil(first.getBoundingClientRect().height):104;
      const h=Math.min(availH, cardH*4+12*3+4);
      root.querySelectorAll('.v-scroll').forEach(v=>v.style.height=h+'px');
      goToIndex(activeIdx,{animate:false});
    }catch{}
  }
  window.addEventListener('resize',applyHeights);

  function recalcTotal(){
    const counts=window.__orderCounts||{};
    let sum=0;
    cfg.menu.forEach(cat=>cat.items.forEach(it=>{
      sum+=(counts[it.name]||0)*(it.price||0);
    }));
    totalEl.textContent=money(sum);
    confirmBtn.disabled=sum<=0;
    return sum;
  }

  /* --- SBP QR modal --- */
  function ensureQrModal(){
    let m=document.getElementById('qrModal');
    if(m) return m;
    m=el(`
      <div id="qrModal" class="modal">
        <div class="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-xl text-center">
          <h3 class="text-lg font-semibold">Оплата по СБП</h3>
          <div class="text-sm text-gray-600">Отсканируйте QR и оплатите заказ</div>
          <img id="qrImg" class="mx-auto rounded-xl border w-64 h-64 object-contain" alt="QR">
          <a id="qrLink" class="block text-blue-600 underline text-sm" href="#" target="_blank" rel="noopener">Открыть ссылку оплаты</a>
          <div class="text-xs text-gray-500 mt-2">Оплата картой — у кассира/терминала POS</div>
          <button id="qrOk" class="px-3 py-2 rounded-xl bg-black text-white w-full">Готово</button>
        </div>
      </div>
    `);
    document.body.appendChild(m);
    m.onclick=(e)=>{ if(e.target===m) m.classList.remove('open'); };
    m.querySelector('#qrOk').onclick=()=>m.classList.remove('open');
    return m;
  }
  function openQr(payUrl){
    const m=ensureQrModal();
    const qi=m.querySelector('#qrImg');
    const ql=m.querySelector('#qrLink');
    if(!payUrl){
      qi.src='https://placehold.co/256x256?text=SBP+URL+not+set';
      ql.textContent='Ссылка оплаты не настроена';
      ql.removeAttribute('href');
    }else{
      const encoded=encodeURIComponent(payUrl);
      qi.src=`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encoded}`;
      ql.href=payUrl; ql.textContent=payUrl;
    }
    m.classList.add('open');
  }

  // confirm -> payModal
  confirmBtn.addEventListener('click',()=>{
    const counts=window.__orderCounts||{};
    const items=[]; let total=0;
    cfg.menu.forEach(cat=>cat.items.forEach(it=>{
      const q=counts[it.name]||0;
      if(q>0){ items.push({name:it.name,qty:q,price:it.price||0}); total+=q*(it.price||0); }
    }));
    if(!items.length) return;
    const sumBox=document.getElementById('paySummary');
    sumBox.innerHTML=items.map(i=>`
      <div class="flex items-center justify-between">
        <div class="truncate">${i.name} ×${i.qty}</div>
        <div class="ml-2 whitespace-nowrap">${money(i.qty*i.price)}</div>
      </div>
    `).join('');
    sumBox.insertAdjacentHTML('beforeend',`
      <div class="mt-2 pt-2 border-t flex items-center justify-between font-semibold">
        <div>Итого</div><div>${money(total)}</div>
      </div>
    `);
    document.getElementById('payModal').classList.add('open');
  });

  function resetCounts(){
    window.__orderCounts={};
    catPager.querySelectorAll('[data-q]').forEach(n=>n.textContent='0');
    totalEl.textContent=money(0);
    confirmBtn.disabled=true;
  }

  // pay modal ok/cancel
  (function bindPayModal(){
    const m=document.getElementById('payModal');
    const ok=document.getElementById('payOk');
    const cancel=document.getElementById('payCancel');

    const close=()=>m.classList.remove('open');
    const finalize=()=>{ confirmBtn._busy=false; confirmBtn.disabled=false; };

    cancel.onclick=(e)=>{ e?.preventDefault(); close(); finalize(); };

    ok.onclick=async (e)=>{
      e?.preventDefault();
      if(confirmBtn._busy) return;
      confirmBtn._busy=true;

      const counts=window.__orderCounts||{};
      const itemsSel=[]; let total=0;
      cfg.menu.forEach(cat=>cat.items.forEach(it=>{
        const q=counts[it.name]||0;
        if(q>0){ itemsSel.push({name:it.name,qty:q,price:it.price||0}); total+=q*(it.price||0); }
      }));
      if(!itemsSel.length){ close(); finalize(); return; }

      let order;
      try{
        const res=await rpc({ op:'create', data:{ clientId:'terminal', items:itemsSel, total, pay:'sbp', status:'готовится' }});
        order=res?.order || { id:Date.now().toString().slice(-6), createdAt:Date.now(), items:itemsSel, total, pay:'sbp', status:'готовится' };

        const dash=loadDash(); dash.unshift(order); saveDash(dash.slice(0,200));
        const hist=loadHistory(); hist.unshift(order); saveHistory(hist.slice(0,50));
      }catch(err){
        console.warn(err); showToast('Не удалось отправить заказ'); finalize(); return;
      }

      close(); finalize(); resetCounts();
      window.dispatchEvent(new CustomEvent('orders:history-updated'));

      // SBP ссылка из конфига
      const c2=loadConfig();
      let payUrl=null;
      if(c2.sbpPayBaseUrl){
        const u=new URL(c2.sbpPayBaseUrl);
        u.searchParams.set('amount',String(order.total||total));
        u.searchParams.set('order',String(order.id));
        payUrl=u.toString();
      }
      openQr(payUrl);
    };

    m.onclick=(e)=>{ if(e.target===m) cancel.onclick(); };
  })();

  rebuildMenu();

  requestAnimationFrame(()=>{
    highlightChip(0);
    goToIndex(0,{animate:false});
    recalcTotal();
    applyHeights();
  });

  // синк конфиг/статусы
  const syncTimer=setInterval(async ()=>{
    try{
      const cfgRemote=await fetchRemoteConfig();
      if(cfgRemote){
        const v=calcConfigVersion(cfgRemote);
        if(v!==lastConfigVersion){ lastConfigVersion=v; location.reload(); }
      }
    }catch{}
  },10000);

  root.cleanup=()=>{
    clearInterval(syncTimer);
    setBodyScrollLock(false);
    window.removeEventListener('resize',applyHeights);
    if(idleT) clearTimeout(idleT);
    adOverlay.remove();
  };

  return root;
}

/* =========================================================
   ============   ЭКРАН 2 — ТАБЛО КУХНИ   ==================
   ========================================================= */
function DashboardView(){
  const root=el(`
    <div class="w-full max-w-full mx-auto pb-10 px-4">
      <div class="flex items-center justify-between py-4">
        <h2 class="text-2xl font-bold">Табло кухни</h2>
        <div class="flex items-center gap-3">
          <button id="soundToggle" class="px-4 py-2 rounded-xl border bg-white" title="Звук">🔔</button>
          <a href="#/builder" class="px-4 py-2 rounded-xl border bg-white">Конструктор</a>
          <button id="clearAll" class="px-4 py-2 rounded-xl border bg-red-100 text-red-600">Очистить всё</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-6">
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
        <button onclick="location.hash='#/order'" class="px-4 py-2 rounded-xl border">Выйти</button>
      </div>
    </div>
  `);

  const colPrep=root.querySelector('#colPreparing');
  const colReady=root.querySelector('#colReady');
  const soundBtn=root.querySelector('#soundToggle');
  const ding=document.getElementById('orderDing');

  let dashOrders=loadDash();
  let knownIds=new Set(dashOrders.map(o=>String(o.id)));
  let pollTimer=null;

  const soundOn=()=>localStorage.getItem(SOUND_ON_KEY)==='1';
  const setSound=(on)=>{
    localStorage.setItem(SOUND_ON_KEY,on?'1':'0');
    soundBtn.classList.toggle('bg-green-100',on);
  };
  setSound(soundOn());
  soundBtn.onclick=()=>setSound(!soundOn());

  function cardOrder(o){
    const card=el(`
      <div class="bg-white border rounded-2xl p-4 shadow">
        <div class="flex items-center justify-between">
          <div class="text-3xl font-extrabold">#${o.id}</div>
          <select data-k="status" class="border rounded-xl p-2 text-sm">
            <option ${o.status==='готовится'?'selected':''}>готовится</option>
            <option ${o.status==='готов'?'selected':''}>готов</option>
          </select>
        </div>

        <div class="mt-3 grid gap-1 text-base">
          ${(o.items||[]).map(i=>`
            <div class="flex justify-between">
              <span>${i.name}</span>
              <span>${i.qty} × ${i.price}</span>
            </div>
          `).join('')}
        </div>

        <div class="text-lg font-bold mt-2">Итого: ${o.total||0} ₽</div>

        <div class="flex gap-2 items-center mt-3">
          <button data-act="save" class="px-3 py-2 rounded-xl border bg-white">Сохранить</button>
          <button data-act="delete" class="px-3 py-2 rounded-xl border bg-red-100 text-red-600 ml-auto">Удалить</button>
        </div>
      </div>
    `);

    const sel=card.querySelector('[data-k="status"]');
    card.querySelector('[data-act="save"]').onclick=()=>{
      const status=sel.value;
      const idx=dashOrders.findIndex(x=>String(x.id)===String(o.id));
      if(idx>=0){
        dashOrders[idx].status=status;
        saveDash(dashOrders);
        rpc({op:'update',id:o.id,patch:{status}}).catch(()=>{});
        render();
      }
    };

    card.querySelector('[data-act="delete"]').onclick=()=>{
      if(!confirm('Удалить заказ?')) return;
      dashOrders=dashOrders.filter(x=>String(x.id)!==String(o.id));
      saveDash(dashOrders);
      rpc({op:'delete',id:o.id}).catch(()=>{});
      render();
    };

    return card;
  }

  function render(){
    colPrep.innerHTML=''; colReady.innerHTML='';
    dashOrders.forEach(o=>{
      const c=cardOrder(o);
      if(o.status==='готов') colReady.appendChild(c);
      else colPrep.appendChild(c);
    });
  }

  async function loadFromCloud(){
    try{
      const res=await rpc({op:'list'});
      if(Array.isArray(res.orders)){
        dashOrders=res.orders.slice();
        saveDash(dashOrders);

        // звук на новые
        const newIds=res.orders.map(o=>String(o.id)).filter(id=>!knownIds.has(id));
        if(newIds.length && soundOn()){
          ding.currentTime=0; ding.play().catch(()=>{});
        }
        knownIds=new Set(res.orders.map(o=>String(o.id)));

        render();
      }
    }catch(e){ /* молча */ }
  }

  root.querySelector('#clearAll').onclick=async ()=>{
    if(!confirm('Удалить ВСЕ заказы?')) return;
    const ids=dashOrders.map(o=>o.id);
    dashOrders=[]; saveDash([]); render();
    try{ await rpc({op:'clear'}); }
    catch{
      for(const id of ids){ try{ await rpc({op:'delete',id}); }catch{} }
    }
  };

  render();
  loadFromCloud();
  pollTimer=setInterval(loadFromCloud,5000);

  root.cleanup=()=>{ if(pollTimer) clearInterval(pollTimer); };
  return root;
}

/* =========================================================
   ============   ЭКРАН 3 — ТАБЛО ДЛЯ ЗАЛА  =================
   ========================================================= */
function PublicBoardView(){
  const root=el(`
    <div class="w-full h-full px-6 py-4 bg-black text-white">
      <div class="grid grid-cols-2 gap-6 mb-4">
        <div class="text-center text-3xl font-extrabold tracking-wide">ГОТОВИТСЯ</div>
        <div class="text-center text-3xl font-extrabold tracking-wide">ГОТОВ</div>
      </div>

      <div class="grid grid-cols-2 gap-6 h-[calc(100vh-120px)]">
        <div id="prepCol" class="grid gap-3 content-start"></div>
        <div id="readyCol" class="grid gap-3 content-start"></div>
      </div>

      <!-- скрытая зона 4-тапа снизу справа для выхода -->
      <div id="publicHotZone"
           style="position:fixed; right:0; bottom:0; width:220px; height:140px; z-index:9999;">
      </div>
    </div>
  `);

  const prepCol=root.querySelector('#prepCol');
  const readyCol=root.querySelector('#readyCol');
  const hotZone=root.querySelector('#publicHotZone');

  let orders=[]; let pollTimer=null;

  function numCard(id){
    return el(`
      <div class="rounded-2xl border border-white/25 bg-white/5 text-center py-4 text-5xl font-extrabold tracking-widest">
        ${id}
      </div>
    `);
  }

  function render(){
    prepCol.innerHTML=''; readyCol.innerHTML='';
    const prep=orders.filter(o=>(o.status||'готовится')!=='готов');
    const ready=orders.filter(o=>(o.status||'')==='готов');

    prep.forEach(o=>prepCol.appendChild(numCard(o.id)));
    ready.forEach(o=>readyCol.appendChild(numCard(o.id)));

    if(!prep.length) prepCol.appendChild(el(`<div class="text-white/40 text-2xl font-semibold">—</div>`));
    if(!ready.length) readyCol.appendChild(el(`<div class="text-white/40 text-2xl font-semibold">—</div>`));
  }

  async function loadFromCloud(){
    try{
      const res=await rpc({op:'list'});
      if(Array.isArray(res.orders)){
        orders=res.orders.slice();
        render();
      }
    }catch(e){}
  }
  loadFromCloud();
  pollTimer=setInterval(loadFromCloud,4000);

  // 4 taps -> PIN -> выход
  (function bindHiddenExit(){
    if(!hotZone || hotZone._bound) return;
    hotZone._bound=true;
    let taps=0, first=0, timer=null;
    const windowMs=1200;
    const reset=()=>{ taps=0; first=0; if(timer){clearTimeout(timer); timer=null;} };
    const handler=()=>{
      const now=Date.now();
      if(!first) first=now;
      taps++;
      if(now-first>windowMs){ reset(); taps=1; first=now; }
      if(taps>=4){
        reset();
        sessionStorage.setItem(WANT_EXIT_BOARD,'1');
        document.getElementById('pinModal')?.classList.add('open');
      }else{
        if(timer) clearTimeout(timer);
        timer=setTimeout(reset,windowMs);
      }
    };
    ['click','pointerup','touchend'].forEach(ev=>{
      hotZone.addEventListener(ev,(e)=>{ e.preventDefault(); e.stopPropagation(); handler(); },{passive:false});
    });
  })();

  root.cleanup=()=>{ if(pollTimer) clearInterval(pollTimer); };
  return root;
}

/* =========================================================
   =================   КОНСТРУКТОР МЕНЮ  ===================
   ========================================================= */
function BuilderView(){
  const cfg=loadConfig();

  const root=el(`
    <div class="grid gap-4 pb-28">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Конструктор меню</h2>
        <div class="flex gap-2">
          <button id="exportBtn" class="px-3 py-2 rounded-xl border">Экспорт JSON</button>
          <label class="px-3 py-2 rounded-xl border cursor-pointer">
            Импорт JSON<input id="importInput" type="file" accept="application/json" class="hidden">
          </label>
          <button id="backBtn2" class="px-3 py-2 rounded-xl border">Назад</button>
        </div>
      </div>

      <section class="card p-4">
        <h3 class="font-semibold mb-2">Реклама на терминале</h3>
        <input id="adUrlInput" class="border rounded-xl p-3 w-full" placeholder="URL видео/гиф" value="${cfg.terminalAdUrl||''}">
        <select id="adTypeInput" class="border rounded-xl p-3 w-full mt-2">
          <option value="video" ${cfg.terminalAdType==='video'?'selected':''}>Видео</option>
          <option value="gif" ${cfg.terminalAdType==='gif'?'selected':''}>GIF/картинка</option>
        </select>
      </section>

      <section class="card p-4">
        <h3 class="font-semibold mb-2">SBP ссылка (база)</h3>
        <input id="sbpInput" class="border rounded-xl p-3 w-full" placeholder="https://pay.example/sbp" value="${cfg.sbpPayBaseUrl||''}">
        <div class="text-xs text-gray-500 mt-1">
          При оплате мы добавим параметры amount и order.
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
        <button id="applyBtn" class="px-4 py-3 rounded-xl bg-black text-white">Сохранить и обновить меню</button>
      </div>
    </div>
  `);

  const catsBox=root.querySelector('#catsBox');

  function render(){
    catsBox.innerHTML='';
    cfg.menu.forEach((cat,cidx)=>{
      const catCard=el(`
        <div class="border rounded-2xl p-3 bg-white">
          <div class="flex items-center justify-between">
            <input value="${cat.title}" class="border rounded-xl p-2 font-semibold w-1/2" data-k="title">
            <div class="flex gap-2">
              <button class="px-2 py-1 rounded-lg border" data-act="up">↑</button>
              <button class="px-2 py-1 rounded-lg border" data-act="down">↓</button>
              <button class="px-2 py-1 rounded-lg border text-red-600" data-act="del">Удалить</button>
            </div>
          </div>
          <div class="text-xs text-gray-500 mt-1">key: <code>${cat.key}</code></div>
          <div class="mt-3">
            <button class="px-3 py-2 rounded-xl border" data-act="addItem">+ Товар</button>
          </div>
          <div class="mt-3 grid gap-2" data-items></div>
        </div>
      `);

      const itemsBox=catCard.querySelector('[data-items]');
      cat.items.forEach((it,iidx)=>{
        const row=el(`
          <div class="grid grid-cols-12 gap-2 border rounded-xl p-2">
            <input class="col-span-5 border rounded-lg p-2" placeholder="Название" value="${it.name||''}" data-k="name">
            <input class="col-span-2 border rounded-lg p-2" type="number" placeholder="Цена" value="${it.price||0}" data-k="price">
            <input class="col-span-4 border rounded-lg p-2" placeholder="URL фото" value="${it.img||''}" data-k="img">
            <div class="col-span-1 flex items-center gap-1 justify-end">
              <button class="px-2 py-1 rounded-md border" data-act="iUp">↑</button>
              <button class="px-2 py-1 rounded-md border" data-act="iDown">↓</button>
              <button class="px-2 py-1 rounded-md border text-red-600" data-act="iDel">✕</button>
            </div>
          </div>
        `);

        row.addEventListener('input',(e)=>{
          const k=e.target.dataset.k;
          if(k==='price') cat.items[iidx][k]=Number(e.target.value||0);
          else cat.items[iidx][k]=e.target.value;
        });

        row.addEventListener('click',(e)=>{
          const act=e.target.dataset.act;
          if(!act) return;
          if(act==='iDel'){ cat.items.splice(iidx,1); render(); }
          if(act==='iUp' && iidx>0){ [cat.items[iidx-1],cat.items[iidx]]=[cat.items[iidx],cat.items[iidx-1]]; render(); }
          if(act==='iDown' && iidx<cat.items.length-1){ [cat.items[iidx+1],cat.items[iidx]]=[cat.items[iidx],cat.items[iidx+1]]; render(); }
        });

        itemsBox.appendChild(row);
      });

      catCard.addEventListener('input',(e)=>{
        if(e.target.dataset.k==='title') cat.title=e.target.value;
      });

      catCard.addEventListener('click',(e)=>{
        const act=e.target.dataset.act;
        if(!act) return;

        if(act==='del' && confirm('Удалить категорию?')){ cfg.menu.splice(cidx,1); render(); }
        if(act==='up' && cidx>0){ [cfg.menu[cidx-1],cfg.menu[cidx]]=[cfg.menu[cidx],cfg.menu[cidx-1]]; render(); }
        if(act==='down' && cidx<cfg.menu.length-1){ [cfg.menu[cidx+1],cfg.menu[cidx]]=[cfg.menu[cidx],cfg.menu[cidx+1]]; render(); }
        if(act==='addItem'){ cat.items.push({name:'Новый товар',price:0,img:''}); render(); }
      });

      catsBox.appendChild(catCard);
    });
  }
  render();

  root.querySelector('#addCatBtn').onclick=()=>{
    const id='cat'+Date.now().toString().slice(-5);
    cfg.menu.push({key:id,title:'Новая категория',items:[]});
    render();
  };

  root.querySelector('#exportBtn').onclick=()=>{
    const blob=new Blob([JSON.stringify(cfg,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='yamamoto-config.json';
    a.click(); URL.revokeObjectURL(a.href);
  };

  root.querySelector('#importInput').onchange=(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const fr=new FileReader();
    fr.onload=()=>{
      try{
        const json=JSON.parse(fr.result);
        saveConfig(json);
        showToast('Импортирован конфиг');
        location.reload();
      }catch{ alert('Неверный JSON'); }
    };
    fr.readAsText(f);
  };

  root.querySelector('#applyBtn').onclick=async ()=>{
    cfg.terminalAdUrl = root.querySelector('#adUrlInput').value.trim();
    cfg.terminalAdType= root.querySelector('#adTypeInput').value;
    cfg.sbpPayBaseUrl = root.querySelector('#sbpInput').value.trim();

    saveConfig(cfg);
    applyTheme(cfg.theme||{});

    try{ await rpc({op:'config_set',config:cfg}); }
    catch(e){ showToast('Сохранено локально (сервер недоступен)'); }

    showToast('Меню сохранено');
    location.hash='#/dashboard';
  };

  root.querySelector('#backBtn2').onclick=()=>location.hash='#/dashboard';
  return root;
}

/* =========================================================
   =====================   ROUTER + PIN  ===================
   ========================================================= */

function mount(view){
  const app=document.getElementById('app');
  if(app.firstChild && typeof app.firstChild.cleanup==='function'){
    try{ app.firstChild.cleanup(); }catch{}
  }
  app.innerHTML='';
  app.classList.add('phone-shell');
  app.appendChild(view);
}

function realRouter(){
  const h=location.hash.split('?')[0];
  if(h==='#/dashboard') mount(DashboardView());
  else if(h==='#/board') mount(PublicBoardView());
  else if(h==='#/builder') mount(BuilderView());
  else mount(OrderView());
}

function router(){
  const h=location.hash.split('?')[0];

  // защита PIN на админ-экраны
  if((h==='#/dashboard'||h==='#/board'||h==='#/builder') && sessionStorage.getItem(TABLO_PIN_OK)!=='1'){
    sessionStorage.setItem(WANT_ADMIN_ROUTE, h);
    document.getElementById('pinModal')?.classList.add('open');
    document.getElementById('app').innerHTML='';
    return;
  }
  realRouter();
}

window.addEventListener('hashchange',()=>{ try{ router(); }catch(e){ console.error(e); }});
document.addEventListener('DOMContentLoaded',()=>{
  if(!location.hash || location.hash==='#' || location.hash==='#/') location.hash='#/order';

  // кнопка табло кухни снизу справа
  const openDash=document.getElementById('openDashBtn');
  openDash.onclick=()=>location.hash='#/dashboard';

  // PIN modal
  const pinM=document.getElementById('pinModal');
  const pinOk=document.getElementById('pinOk');
  const pinCancel=document.getElementById('pinCancel');
  const pinInput=document.getElementById('pinInput');

  pinOk.onclick=(e)=>{
    e?.preventDefault();
    if((pinInput.value||'').trim().length===0){ showToast('Введите ключ'); return; }

    const wanted=sessionStorage.getItem(WANT_ADMIN_ROUTE) || '#/dashboard';
    pinM.classList.remove('open');

    // выход из public board
    if(sessionStorage.getItem(WANT_EXIT_BOARD)==='1'){
      sessionStorage.removeItem(WANT_EXIT_BOARD);
      sessionStorage.removeItem(TABLO_PIN_OK); // сбросим чтобы следующий вход опять просил PIN
      location.hash='#/order';
      return;
    }

    sessionStorage.setItem(TABLO_PIN_OK,'1');
    sessionStorage.removeItem(WANT_ADMIN_ROUTE);
    location.hash=wanted;
  };

  pinCancel.onclick=()=>{
    pinM.classList.remove('open');
    sessionStorage.removeItem(WANT_ADMIN_ROUTE);
    sessionStorage.removeItem(WANT_EXIT_BOARD);
    location.hash='#/order';
  };

  pinM.onclick=(e)=>{ if(e.target===pinM) pinCancel.onclick(); };

  // первый синк конфига
  fetchRemoteConfig().catch(()=>{});
  router();
});
