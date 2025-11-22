import {
  el, showToast, money,
  loadDash, saveDash, rpc,
  SOUND_ON_KEY
} from './app.js';

export function DashboardView(){
  const root = el(`
    <div class="w-full max-w-full mx-auto pb-10 px-4">
      <div class="flex items-center justify-between py-4 flex-wrap gap-2">
        <h2 class="text-2xl font-bold">Табло кухни</h2>

        <div class="flex items-center gap-2">
          <button id="soundToggle" class="px-4 py-2 rounded-xl border bg-white" title="Звук">🔔</button>
          <a href="#/builder" class="px-4 py-2 rounded-xl border bg-white">Конструктор</a>
          <a href="#/board" class="px-4 py-2 rounded-xl border bg-white">Табло зала</a>
          <button id="clearAll" class="px-4 py-2 rounded-xl border bg-red-100 text-red-600">Очистить всё</button>
          <button id="exitBtn" class="px-4 py-2 rounded-xl border">Выйти</button>
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
    </div>
  `);

  const colPrep  = root.querySelector('#colPreparing');
  const colReady = root.querySelector('#colReady');
  const soundBtn = root.querySelector('#soundToggle');
  const ding     = document.getElementById('orderDing');

  let dashOrders = loadDash();
  let knownIds   = new Set(dashOrders.map(o => String(o.id)));
  let pollTimer  = null;

  const soundOn = ()=> localStorage.getItem(SOUND_ON_KEY)==='1';
  const setSound=(on)=>{
    localStorage.setItem(SOUND_ON_KEY,on?'1':'0');
    soundBtn.classList.toggle('bg-green-100',on);
  };
  setSound(soundOn());
  soundBtn.onclick=()=>setSound(!soundOn());

  root.querySelector('#exitBtn').onclick=()=>{
    sessionStorage.removeItem('TABLO_PIN_OK'); // чтобы при следующем входе попросил PIN
    location.hash='#/order';
  };

  function cardOrder(o){
    return el(`
      <div class="bg-white border rounded-2xl p-4 shadow">
        <div class="flex items-center justify-between">
          <div class="text-3xl font-extrabold">#${o.id}</div>
          <div class="px-3 py-1 rounded-full bg-gray-100 text-sm">${o.status}</div>
        </div>

        <div class="text-sm text-gray-600 mt-1">
          ${o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit'}) : ''}
        </div>

        <div class="mt-3 grid gap-1 text-base">
          ${(o.items||[]).map(i=>`
            <div class="flex justify-between">
              <span>${i.name}</span>
              <span>${i.qty} × ${i.price}</span>
            </div>
          `).join('')}
        </div>

        <div class="text-lg font-bold mt-2">
          Итого: ${(o.total||0)} ₽
        </div>

        <div class="flex gap-2 items-center mt-3">
          <select data-k="status" class="border rounded-xl p-2 text-sm">
            <option ${o.status==='готовится'?'selected':''}>готовится</option>
            <option ${o.status==='готов'?'selected':''}>готов</option>
          </select>

          <button data-act="save" class="px-3 py-2 rounded-xl border bg-white">Сохранить</button>
          <button data-act="delete" class="px-3 py-2 rounded-xl border bg-red-100 text-red-600 ml-auto">Удалить</button>
        </div>
      </div>
    `);
  }

  function render(){
    colPrep.innerHTML=''; colReady.innerHTML='';
    dashOrders.forEach(o=>{
      const card=cardOrder(o);
      const sel=card.querySelector('[data-k="status"]');
      const save=card.querySelector('[data-act="save"]');
      const del=card.querySelector('[data-act="delete"]');

      save.onclick=()=>{
        const status=sel.value;
        const idx=dashOrders.findIndex(x=>String(x.id)===String(o.id));
        if(idx>=0){
          dashOrders[idx]={...dashOrders[idx],status};
          saveDash(dashOrders);
          rpc({op:'update',id:o.id,patch:{status}}).catch(()=>{});
          render();
        }
      };

      del.onclick=()=>{
        if(!confirm('Удалить заказ?')) return;
        dashOrders=dashOrders.filter(x=>String(x.id)!==String(o.id));
        saveDash(dashOrders);
        rpc({op:'delete',id:o.id}).catch(()=>{});
        render();
      };

      (o.status==='готов'?colReady:colPrep).appendChild(card);
    });
  }

  function detectNewOrders(nextOrders){
    const map=new Map(nextOrders.map(o=>[String(o.id),o]));
    const incoming=[...map.keys()].filter(id=>!knownIds.has(id));
    if(incoming.length && document.visibilityState==='visible' && soundOn()){
      try{ ding.currentTime=0; ding.play().catch(()=>{}); }catch{}
    }
    knownIds=new Set(map.keys());
  }

  async function loadFromCloud(){
    try{
      const res=await rpc({op:'list'});
      if(Array.isArray(res.orders)){
        detectNewOrders(res.orders);
        dashOrders=res.orders;
        saveDash(dashOrders);
        render();
      }
    }catch(e){ console.warn(e); }
  }

  root.querySelector('#clearAll').onclick=async ()=>{
    if(!confirm('Удалить ВСЕ заказы?')) return;
    const ids=dashOrders.map(o=>o.id);
    dashOrders=[]; saveDash([]);
    render();
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
