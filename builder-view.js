import { el, showToast, loadConfig, saveConfig, applyTheme, rpc } from './app.js';

export function BuilderView(){
  const cfg = loadConfig();

  const root = el(`
    <div class="grid gap-4 pb-28">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <h2 class="text-lg font-semibold">Конструктор меню</h2>
        <div class="flex gap-2">
          <button id="exportBtn" class="px-3 py-2 rounded-xl border">Экспорт JSON</button>
          <label class="px-3 py-2 rounded-xl border cursor-pointer">
            Импорт JSON<input id="importInput" type="file" accept="application/json" class="hidden">
          </label>
          <button id="backBtn" class="px-3 py-2 rounded-xl border">Назад</button>
        </div>
      </div>

      <section class="card p-4 grid gap-3">
        <h3 class="font-semibold">Реклама на терминале</h3>
        <input id="adUrlInput" class="border rounded-xl p-3 w-full"
               placeholder="URL видео/гиф" value="${cfg.terminalAdUrl||''}">
        <select id="adTypeInput" class="border rounded-xl p-3 w-full">
          <option value="video" ${cfg.terminalAdType==='video'?'selected':''}>Видео</option>
          <option value="gif"   ${cfg.terminalAdType==='gif'?'selected':''}>GIF/картинка</option>
        </select>
      </section>

      <section class="card p-4 grid gap-3">
        <h3 class="font-semibold">СБП ссылка</h3>
        <input id="sbpInput" class="border rounded-xl p-3 w-full"
               placeholder="База ссылки СБП (https://...)" value="${cfg.sbpPayBaseUrl||''}">
        <div class="text-xs text-gray-500">
          В QR будут подставляться параметры amount и order
        </div>
      </section>

      <section class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold">Категории и товары</h3>
          <button id="addCatBtn" class="px-3 py-2 rounded-xl border">+ Категория</button>
        </div>
        <div id="catsBox" class="grid gap-4"></div>
      </section>

      <button id="applyBtn" class="px-4 py-3 rounded-xl bg-black text-white">Сохранить</button>
    </div>
  `);

  const catsBox = root.querySelector('#catsBox');

  function render(){
    catsBox.innerHTML='';
    cfg.menu.forEach((cat, cidx)=>{
      const catCard = el(`
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

      const itemsBox = catCard.querySelector('[data-items]');
      cat.items.forEach((it, iidx)=>{
        const row = el(`
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
          const act=e.target.dataset.act; if(!act) return;
          if(act==='iDel'){ cat.items.splice(iidx,1); render(); }
          if(act==='iUp' && iidx>0){ [cat.items[iidx-1],cat.items[iidx]]=[cat.items[iidx],cat.items[iidx-1]]; render(); }
          if(act==='iDown' && iidx<cat.items.length-1){ [cat.items[iidx+1],cat.items[iidx]]=[cat.items[iidx],cat.items[iidx+1]]; render(); }
        });

        itemsBox.appendChild(row);
      });

      catCard.addEventListener('input',(e)=>{ if(e.target.dataset.k==='title') cat.title=e.target.value; });
      catCard.addEventListener('click',(e)=>{
        const act=e.target.dataset.act; if(!act) return;
        if(act==='del'){ if(confirm('Удалить категорию?')){ cfg.menu.splice(cidx,1); render(); } }
        if(act==='up' && cidx>0){ [cfg.menu[cidx-1],cfg.menu[cidx]]=[cfg.menu[cidx],cfg.menu[cidx-1]]; render(); }
        if(act==='down' && cidx<cfg.menu.length-1){ [cfg.menu[cidx+1],cfg.menu[cidx]]=[cfg.menu[cidx],cfg.menu[cidx+1]]; render(); }
        if(act==='addItem'){ cat.items.push({name:'Новый товар', price:0, img:''}); render(); }
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
    a.href=URL.createObjectURL(blob); a.download='yamamoto-config.json'; a.click();
    URL.revokeObjectURL(a.href);
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
    cfg.terminalAdUrl  = root.querySelector('#adUrlInput').value.trim();
    cfg.terminalAdType = root.querySelector('#adTypeInput').value;
    cfg.sbpPayBaseUrl  = root.querySelector('#sbpInput').value.trim();

    saveConfig(cfg);
    applyTheme(cfg.theme);

    try{
      await rpc({ op:'config_set', config: cfg });
      showToast('Меню сохранено (сервер)');
    }catch(e){
      console.warn(e);
      showToast('Сервер недоступен — сохранил локально');
    }
    location.hash='#/dashboard';
  };

  root.querySelector('#backBtn').onclick=()=>location.hash='#/dashboard';

  return root;
}
