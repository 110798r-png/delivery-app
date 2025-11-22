import { el, rpc, saveDash, loadDash, WANT_EXIT_BOARD, TABLO_PIN_OK } from './app.js';

export function PublicBoardView(){
  const root = el(`
    <div class="w-full h-full px-6 py-4 bg-black text-white">
      <div class="grid grid-cols-2 gap-6 mb-4">
        <div class="text-center"><div class="text-3xl font-extrabold tracking-wide">ГОТОВИТСЯ</div></div>
        <div class="text-center"><div class="text-3xl font-extrabold tracking-wide">ГОТОВ</div></div>
      </div>

      <div class="grid grid-cols-2 gap-6 h-[calc(100vh-120px)]">
        <div id="prepCol" class="grid gap-3 content-start"></div>
        <div id="readyCol" class="grid gap-3 content-start"></div>
      </div>

      <!-- скрытая зона 4-тапа (выход по PIN) -->
      <div id="publicHotZone"
           style="position:fixed; right:0; bottom:0; width:220px; height:140px; z-index:9999;">
      </div>
    </div>
  `);

  const prepCol=root.querySelector('#prepCol');
  const readyCol=root.querySelector('#readyCol');
  const hotZone=root.querySelector('#publicHotZone');

  let orders=loadDash();
  let pollTimer=null;

  function numCard(id){
    return el(`
      <div class="rounded-2xl border border-white/25 bg-white/5 
                  text-center py-4 text-5xl font-extrabold tracking-widest">
        ${id}
      </div>
    `);
  }

  function render(){
    prepCol.innerHTML=''; readyCol.innerHTML='';
    const prep=orders.filter(o=>(o.status||'готовится')!=='готов');
    const ready=orders.filter(o=>(o.status||'')==='готов');

    if(!prep.length) prepCol.appendChild(el(`<div class="text-gray-500 text-2xl font-semibold">—</div>`));
    if(!ready.length) readyCol.appendChild(el(`<div class="text-gray-500 text-2xl font-semibold">—</div>`));

    prep.forEach(o=>prepCol.appendChild(numCard(o.id)));
    ready.forEach(o=>readyCol.appendChild(numCard(o.id)));
  }

  async function loadFromCloud(){
    try{
      const res=await rpc({op:'list'});
      if(Array.isArray(res.orders)){
        orders=res.orders.slice();
        saveDash(orders);
      }
    }catch{}
    render();
  }

  render();
  loadFromCloud();
  pollTimer=setInterval(loadFromCloud,4000);

  // 4-тапа → PIN → выход
  if(hotZone && !hotZone._bound){
    hotZone._bound=true;
    let taps=0, first=0, timer=null;
    const windowMs=1200;

    const reset=()=>{ taps=0; first=0; if(timer){clearTimeout(timer);timer=null;} };

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
  }

  root.cleanup=()=>{ if(pollTimer) clearInterval(pollTimer); };

  return root;
}

