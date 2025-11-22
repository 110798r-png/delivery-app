import {
  el, showToast, money, setBodyScrollLock,
  loadConfig, applyTheme, rpc,
  loadDash, saveDash
} from './app.js';

/* ===== анимации свайпа ===== */
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2 }
function animateScrollX(elm, to, {duration=280, onEnd}={}){
  const from=elm.scrollLeft; const diff=to-from;
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

export function OrderView(){
  const cfg = loadConfig();
  applyTheme(cfg.theme || {});

  const escAttr = (val) => {
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(val);
    return String(val).replace(/"/g, '\\"');
  };

  const root = el(`
    <div class="relative pb-28">
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
          >Оформить заказ</button>
        </div>
      </div>
    </div>
  `);

  const categoryBar = root.querySelector('#categoryBar');
  const catPager    = root.querySelector('#catPager');
  const totalEl     = root.querySelector('#totalVal');
  const confirmBtn  = root.querySelector('#confirmBtn');

  setBodyScrollLock(true);

  let activeIdx=0, isAnimating=false;
  const scrollMemory=new Map();
  const panelW=()=>catPager.getBoundingClientRect().width||1;

  /* ---------- idle-реклама ---------- */
  const adOverlay = el(`
    <div id="adOverlay" class="fixed inset-0 bg-black hidden z-[9999] flex items-center justify-center">
      <video id="adVideo" class="w-full h-full object-cover hidden" muted loop playsinline></video>
      <img id="adImg" class="w-full h-full object-cover hidden" alt="Реклама"/>
    </div>
  `);
  document.body.appendChild(adOverlay);

  function showAd(){
    const c = loadConfig();
    const url = c.terminalAdUrl;
    if (!url) return;

    const v = adOverlay.querySelector('#adVideo');
    const i = adOverlay.querySelector('#adImg');
    adOverlay.classList.remove('hidden');

    if (c.terminalAdType === 'gif'){
      v.pause(); v.classList.add('hidden');
      i.classList.remove('hidden'); i.src=url;
    } else {
      i.classList.add('hidden');
      v.classList.remove('hidden');
      v.src=url; v.play().catch(()=>{});
    }
  }
  function hideAd(){ adOverlay.classList.add('hidden'); }

  let idleT=null;
  function resetIdle(){
    if (idleT) clearTimeout(idleT);
    hideAd();
    idleT=setTimeout(showAd,15000);
  }
  ['click','pointerdown','touchstart','scroll','wheel'].forEach(ev=>{
    root.addEventListener(ev, resetIdle, {passive:true});
  });
  resetIdle();

  /* ---------- категории ---------- */
  cfg.menu.forEach((cat, idx)=>{
    categoryBar.appendChild(el(`
      <button type="button"
        class="px-3 py-1.5 rounded-full border text-sm whitespace-nowrap ${idx===0?'bg-black text-white border-black':'bg-white/50'}"
        data-idx="${idx}">${cat.title}</button>
    `));
  });

  function highlightChip(idx){
    categoryBar.querySelectorAll('button').forEach((b,i)=>{
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
      if(old) scrollMemory.set(cfg.menu[activeIdx].key,old.scrollTop);
      catPager.scrollLeft=target;
      if(box) box.scrollTop=scrollMemory.get(cfg.menu[idx].key)||0;
      activeIdx=idx; return;
    }

    isAnimating=true;
    const prevSnap=catPager.style.scrollSnapType;
    catPager.style.scrollSnapType='none';

    const old=catPager.children[activeIdx]?.querySelector('.v-scroll');
    if(old) scrollMemory.set(cfg.menu[activeIdx].key,old.scrollTop);

    animateScrollX(catPager,target,{
      duration:280,
      onEnd(){
        if(box) box.scrollTop=scrollMemory.get(cfg.menu[idx].key)||0;
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

  /* ---------- меню ---------- */
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
      vbox.appendChild(list); panel.appendChild(vbox); catPager.appendChild(panel);

      // swipe categories (touch)
      let down=false, used=false, sx=0, sy=0, locked=null;
      const PIX_LOCK=10;
      const THRESH=()=>Math.max(40,panelW()*0.25);
      function onPointerDown(e){
        if(e.pointerType!=='touch'||isAnimating) return;
        down=true; used=false; sx=e.clientX; sy=e.clientY; locked=null;
        vbox.setPointerCapture?.(e.pointerId);
      }
      function onPointerMove(e){
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
            const next=dx<0?activeIdx+1:activeIdx-1;
            goToIndex(next,{animate:true});
          }
        }
      }
      function onPointerUp(){ down=false; used=false; locked=null; }
      vbox.addEventListener('pointerdown',onPointerDown,{passive:true});
      vbox.addEventListener('pointermove',onPointerMove,{passive:false});
      ['pointerup','pointercancel','pointerleave'].forEach(evt=>vbox.addEventListener(evt,onPointerUp));
    });
  }

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
      const h=Math.min(availH,cardH*4+12*3+4);

      root.querySelectorAll('.v-scroll').forEach(x=>x.style.height=h+'px');
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

  /* ---------- pay modal ---------- */
  confirmBtn.addEventListener('click',()=>{
    const counts=window.__orderCounts||{};
    const items=[];
    let total=0;
    cfg.menu.forEach(cat=>cat.items.forEach(it=>{
      const q=counts[it.name]||0;
      if(q>0){
        items.push({name:it.name,qty:q,price:it.price||0});
        total+=q*(it.price||0);
      }
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

  const payOk=document.getElementById('payOk');
  const payCancel=document.getElementById('payCancel');

  payCancel.onclick=()=>{
    document.getElementById('payModal').classList.remove('open');
  };

  payOk.onclick=async ()=>{
    const counts=window.__orderCounts||{};
    const itemsSel=[];
    let total=0;

    cfg.menu.forEach(cat=>cat.items.forEach(it=>{
      const q=counts[it.name]||0;
      if(q>0){
        itemsSel.push({name:it.name,qty:q,price:it.price||0});
        total+=q*(it.price||0);
      }
    }));
    if(!itemsSel.length) return;

    let order=null;
    try{
      const res=await rpc({
        op:'create',
        data:{
          clientId:'terminal',
          items:itemsSel,
          total,
          pay:'sbp',
          status:'готовится'
        }
      });
      order=res?.order || {
        id:Date.now().toString().slice(-6),
        createdAt:Date.now(),
        items:itemsSel,
        total,
        pay:'sbp',
        status:'готовится'
      };

      const dash=loadDash();
      dash.unshift(order);
      saveDash(dash.slice(0,200));
    }catch(e){
      console.warn(e);
      showToast('Не удалось отправить заказ');
      return;
    }

    document.getElementById('payModal').classList.remove('open');
    resetCounts();

    // QR
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

  function openQr(payUrl){
    const m=document.getElementById('qrModal');
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

  rebuildMenu();
  requestAnimationFrame(()=>{
    highlightChip(0);
    goToIndex(0,{animate:false});
    recalcTotal();
    applyHeights();
  });

  root.cleanup=()=>{
    setBodyScrollLock(false);
    window.removeEventListener('resize',applyHeights);
    if(idleT) clearTimeout(idleT);
    adOverlay.remove();
  };

  return root;
}
