/* ===== Playerok Mini App v6 (API + admin) ===== */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try { tg && tg.ready(); tg && tg.expand(); } catch(e){}

const CFG = window.PLAYEROK_CONFIG || { API_BASE: '', TIMEOUT_MS: 9000 };
const API_BASE = (CFG.API_BASE || '').replace(/\/+$/, '');
const INIT_DATA = (tg && tg.initData) || '';

const FEE = 1, MIN_WITHDRAW = 500, MIN_DEALS = 3;
const SUPPORT = '@PlayerokGiftsRelayer';
const CMC = 'https://s2.coinmarketcap.com/static/img/coins/128x128/';
const FLG = 'https://hatscripts.github.io/circle-flags/flags/';
const APP_URL = (location.origin + location.pathname).replace(/\/+$/, '/');

const FIAT = [
  {code:'RUB',name:'Рос. рубль',unit:'Руб',flag:'ru'},
  {code:'KZT',name:'Тенге',unit:'Тенге',flag:'kz'},
  {code:'BYN',name:'Бел. рубль',unit:'Бел.руб',flag:'by'},
  {code:'UZS',name:'Сум',unit:'Сум',flag:'uz'},
  {code:'UAH',name:'Гривна',unit:'Грн',flag:'ua'},
  {code:'AMD',name:'Драм',unit:'Драм',flag:'am'},
  {code:'KGS',name:'Сом',unit:'Сом',flag:'kg'},
  {code:'AZN',name:'Манат AZ',unit:'Манат',flag:'az'},
  {code:'EUR',name:'Евро',unit:'Евро',flag:'european_union'},
  {code:'GEL',name:'Лари',unit:'Лари',flag:'ge'},
  {code:'MDL',name:'Лей',unit:'Лей',flag:'md'},
  {code:'TJS',name:'Сомони',unit:'Сомони',flag:'tj'},
  {code:'TMT',name:'Манат TM',unit:'Манат',flag:'tm'},
  {code:'USD',name:'Доллар',unit:'USD',flag:'us'},
];
const CRYPTO = [
  {code:'TON',name:'Toncoin',unit:'TON',cmc:11419},
  {code:'STARS',name:'TG Stars',unit:'Звёзд',cmc:28057},
  {code:'USDT',name:'Tether',unit:'USDT',cmc:825},
  {code:'BTC',name:'Bitcoin',unit:'BTC',cmc:1},
  {code:'ETH',name:'Ethereum',unit:'ETH',cmc:1027},
  {code:'BNB',name:'BNB',unit:'BNB',cmc:1839},
  {code:'SOL',name:'Solana',unit:'SOL',cmc:5426},
  {code:'TRX',name:'Tron',unit:'TRX',cmc:1958},
  {code:'DOGE',name:'Dogecoin',unit:'DOGE',cmc:74},
  {code:'NOT',name:'Notcoin',unit:'NOT',cmc:28850},
];
const ALL = [...CRYPTO, ...FIAT];
const BY_CODE = Object.fromEntries(ALL.map(c => [c.code, c]));
function iconUrl(code){const c=BY_CODE[code];if(!c)return '';return c.cmc?CMC+c.cmc+'.png':FLG+c.flag+'.svg'}
function unitOf(code){return (BY_CODE[code]||{}).unit||code}
function methodOf(code){if(code==='TON')return 'ton';if(code==='STARS')return 'stars';if(BY_CODE[code]&&BY_CODE[code].cmc)return 'crypto';return 'card'}
function methodLabel(m){return({ton:'TON-кошелёк',card:'Карта / СБП',stars:'Звёзды Telegram',crypto:'Криптокошелёк'})[m]||'—'}

/* ---- API client ---- */
const api = {
  async call(path, opts={}){
    if(!API_BASE) throw new Error('offline');
    const ctrl = new AbortController();
    const tm = setTimeout(()=>ctrl.abort(), CFG.TIMEOUT_MS||9000);
    try{
      const r = await fetch(API_BASE + path, {
        method: opts.method||'GET',
        headers: { 'Content-Type':'application/json', 'X-Telegram-Init-Data': INIT_DATA, ...(opts.headers||{}) },
        body: opts.body? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
      const j = await r.json().catch(()=>({ok:false,error:'bad-json'}));
      if(!r.ok || j.ok===false) throw new Error(j.error||('http '+r.status));
      return j;
    } finally { clearTimeout(tm); }
  },
  me(){return this.call('/api/me')},
  deals(){return this.call('/api/deals')},
  createDeal(b){return this.call('/api/deals',{method:'POST',body:b})},
  cancelDeal(id){return this.call('/api/deals/'+encodeURIComponent(id)+'/cancel',{method:'POST'})},
  setCard(b){return this.call('/api/wallet/card',{method:'POST',body:b})},
  withdraw(b){return this.call('/api/wallet/withdraw',{method:'POST',body:b})},
  admUsers(){return this.call('/api/admin/users')},
  admBalance(b){return this.call('/api/admin/balance',{method:'POST',body:b})},
  admStars(b){return this.call('/api/admin/stars',{method:'POST',body:b})},
  admWd(){return this.call('/api/admin/withdrawals')},
  admWdAct(id,act){return this.call('/api/admin/withdrawals/'+encodeURIComponent(id)+'/'+act,{method:'POST'})},
};

/* ---- Local cache (offline fallback + UI snapshot) ---- */
const LS='playerok_v6';
const dflt=()=>({theme:'light',deals:[],ops:[],lang:'ru',hideZero:false,me:null,users:[],wd:[]});
let state=(()=>{try{return {...dflt(),...JSON.parse(localStorage.getItem(LS)||'{}')}}catch{return dflt()}})();
const save=()=>localStorage.setItem(LS,JSON.stringify(state));

/* ---- Helpers ---- */
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>Array.from(el.querySelectorAll(s));
const fmt=(n,dp=2)=>Number(n||0).toLocaleString('ru-RU',{minimumFractionDigits:dp,maximumFractionDigits:dp});
const fmtI=n=>Number(n||0).toLocaleString('ru-RU');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){const t=$('#toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2000);try{tg&&tg.HapticFeedback&&tg.HapticFeedback.impactOccurred('light')}catch(e){}}
function openLink(u){try{if(tg&&tg.openTelegramLink&&u.includes('t.me'))return tg.openTelegramLink(u);if(tg&&tg.openLink)return tg.openLink(u)}catch(e){}window.open(u,'_blank')}
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch{try{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);return true}catch{return false}}}

/* ---- Theme ---- */
function applyTheme(){document.body.dataset.theme=state.theme;try{tg&&tg.setHeaderColor&&tg.setHeaderColor(state.theme==='dark'?'#0a0e17':'#f4f6fb')}catch(e){}}
function toggleTheme(){state.theme=state.theme==='dark'?'light':'dark';save();applyTheme()}
$('#theme-toggle')&&$('#theme-toggle').addEventListener('click',toggleTheme);
$('#theme-toggle-2')&&$('#theme-toggle-2').addEventListener('click',toggleTheme);

/* ---- Nav ---- */
function showScreen(name){$$('.screen').forEach(s=>s.classList.remove('active'));const el=$('#screen-'+name);if(el)el.classList.add('active');window.scrollTo({top:0})}
function switchTab(name){$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));showScreen(name);if(name==='wallets')renderWallets();if(name==='leaders')renderLeaders();if(name==='profile')renderProfile();if(name==='deals')renderDeals()}
$$('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.back)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>{const g=b.dataset.go;if(g==='support')openLink('https://t.me/'+SUPPORT.replace('@',''));else if(g==='referral')shareRef();else if(g==='rules')openLink('https://telegra.ph/Pravila-i-usloviya-soglasheniya-Garant-botom-Playerok-05-24');else if(g==='languages')showScreen('lang')}));

/* ---- Connection status ---- */
const netBadge=$('#net-badge');
function setNet(ok,txt){if(!netBadge)return;netBadge.textContent=txt;netBadge.className='brand-sub '+(ok?'online':'offline')}

/* ---- Me / bootstrap ---- */
async function loadMe(){
  if(!API_BASE){setNet(false,'offline — нет API');return null}
  if(!INIT_DATA){setNet(false,'открой в Telegram');return null}
  try{
    const j=await api.me();
    state.me=j; save();
    setNet(true,'online • '+(j.user.username?'@'+j.user.username:('id '+j.user.id)));
    return j;
  }catch(e){
    setNet(false,'оффлайн: '+e.message);
    return state.me||null;
  }
}

function renderUser(){
  const m=state.me;
  const u=(m&&m.user)||((tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user)||{});
  const name=[u.first_name,u.last_name].filter(Boolean).join(' ')||'Гость';
  $('#profile-name')&&($('#profile-name').textContent=name);
  $('#profile-uname')&&($('#profile-uname').textContent=u.username?'@'+u.username:'@guest');
  $('#profile-avatar')&&($('#profile-avatar').textContent=(name[0]||'N').toUpperCase());
  const isAdmin=!!(m&&m.is_admin);
  $('#profile-badge')&&($('#profile-badge').hidden=!isAdmin);
  $('#open-admin')&&($('#open-admin').hidden=!isAdmin);
}

/* ---- Deals ---- */
const ST={created:'Создана',waiting:'Ожидает',paid:'Оплачена',escrow:'Эскроу',done:'Завершена',canceled:'Отменена'};
const STEP={created:1,waiting:2,paid:3,escrow:4,done:5,canceled:1};
async function renderDeals(){
  if(API_BASE){try{const j=await api.deals();state.deals=j.deals||[];save()}catch(e){/* keep cached */}}
  const active=state.deals.filter(d=>!['done','canceled'].includes(d.status));
  const history=state.deals.filter(d=>['done','canceled'].includes(d.status));
  $('#active-count')&&($('#active-count').textContent=active.length+' сделок');
  $('#history-count')&&($('#history-count').textContent=history.length+' сделок');
  const list=$('#deals-list');if(!list)return;
  if(!state.deals.length){list.innerHTML='<div class="empty"><div class="empty-emoji">📭</div><div class="empty-text">Нет сделок</div><div class="empty-sub">Нажмите КНОПКУ выше чтобы создать</div></div>';return}
  list.innerHTML=state.deals.slice(0,20).map(d=>`<div class="deal-item" data-deal="${esc(d.id)}"><img class="di-ico" src="${iconUrl(d.currency)}" alt=""><div style="flex:1;min-width:0"><div class="di-title">${esc(d.desc||d.id)}</div><div class="di-sub">${esc(d.id)} · ${new Date(d.created_at||d.createdAt).toLocaleDateString('ru-RU')}</div></div><div style="text-align:right"><div class="di-amount">${fmt(d.price)} ${esc(d.currency)}</div><div class="di-status s-${esc(d.status)}">${ST[d.status]||esc(d.status)}</div></div></div>`).join('');
  $$('#deals-list .deal-item').forEach(el=>el.addEventListener('click',()=>openDeal(el.dataset.deal)));
}

/* ---- Create deal ---- */
let draft={currency:null,method:null,price:0,desc:''};
$('#btn-create-deal')&&$('#btn-create-deal').addEventListener('click',()=>{draft={currency:null,method:null,price:0,desc:''};const fp=$('#f-price'),fd=$('#f-desc');fp&&(fp.value='');fd&&(fd.value='');renderCurrencyPicker();gotoStep(1);showScreen('create')});

function gotoStep(n){$$('#screen-create .step').forEach(s=>{const v=+s.dataset.step;s.classList.toggle('active',v===n);s.classList.toggle('done',v<n)});$$('#screen-create .step-pane').forEach(p=>p.classList.remove('active'));const pane=$('#pane-'+n);if(pane)pane.classList.add('active')}

function renderCurrencyPicker(){
  const renderGrid=(arr,isCrypto)=>arr.map(c=>`<button class="cur-card ${isCrypto?'crypto':''}" data-cur="${c.code}"><img src="${iconUrl(c.code)}" loading="lazy" alt=""><div class="cur-card-name">${c.code}</div><div class="cur-card-unit">${esc(c.unit)}</div></button>`).join('');
  $('#grid-crypto')&&($('#grid-crypto').innerHTML=renderGrid(CRYPTO,true));
  $('#grid-fiat')&&($('#grid-fiat').innerHTML=renderGrid(FIAT,false));
  $$('#screen-create .cur-card').forEach(b=>b.addEventListener('click',()=>{draft.currency=b.dataset.cur;draft.method=methodOf(draft.currency);$('#f-unit-label')&&($('#f-unit-label').textContent=unitOf(draft.currency));gotoStep(2)}));
}

$$('[data-back-step]').forEach(b=>b.addEventListener('click',()=>gotoStep(+b.dataset.backStep)));
$('#f-price')&&$('#f-price').addEventListener('input',()=>{const p=parseFloat($('#f-price').value.replace(',','.'))||0;const fee=p*FEE/100;$('#f-fee')&&($('#f-fee').textContent=fmt(fee));$('#f-net')&&($('#f-net').textContent=fmt(p-fee))});
$$('[data-next]').forEach(b=>b.addEventListener('click',()=>{const n=+b.dataset.next;if(n===3){const p=parseFloat(($('#f-price').value||'').replace(',','.'));if(!p||p<=0)return toast('Укажите сумму');draft.price=p}gotoStep(n)}));

$('#btn-finalize')&&$('#btn-finalize').addEventListener('click',async()=>{
  const v=($('#f-desc').value||'').trim();
  if(v.length<3)return toast('Опишите товар (мин. 3 символа)');
  draft.desc=v;
  let deal;
  if(API_BASE){
    try{const j=await api.createDeal({price:draft.price,currency:draft.currency,desc:draft.desc,method:draft.method});deal=j.deal}
    catch(e){return toast('Ошибка: '+e.message)}
  } else {
    deal={id:'PLR-'+Math.random().toString(36).slice(2,9).toUpperCase(),desc:draft.desc,price:draft.price,currency:draft.currency,method:draft.method,status:'created',created_at:new Date().toISOString()};
    state.deals.unshift(deal);save();
  }
  deal.link=APP_URL+'?deal='+deal.id;
  $('#deal-link')&&($('#deal-link').textContent=deal.link);
  gotoStep(4);
  try{tg&&tg.HapticFeedback&&tg.HapticFeedback.notificationOccurred('success')}catch(e){}
  renderDeals();
});

$('#btn-share')&&$('#btn-share').addEventListener('click',()=>{const d=state.deals[0];if(d)shareDeal(d)});
function shareDeal(d){const link=d.link||(APP_URL+'?deal='+d.id);const text='💎 Playerok · Сделка #'+d.id+'\n💰 '+fmt(d.price)+' '+d.currency+'\n\nОткрыть в мини-аппе:';openLink('https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(text))}
function shareRef(){const me=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user)||{};const link=APP_URL+'?ref='+(me.id||'me');openLink('https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent('✨ Playerok — безопасные сделки и NFT-подарки в Telegram!'))}

document.addEventListener('click',async ev=>{if(ev.target&&ev.target.id==='deal-link'){const t=(ev.target.textContent||'').trim();if(!t||t==='—')return;const ok=await copyText(t);toast(ok?'Ссылка скопирована':'Не удалось')}});

/* ---- Deal detail ---- */
function openDeal(id){
  const d=state.deals.find(x=>x.id===id);if(!d)return;
  const set=(s,v)=>{const e=$(s);if(e)e.textContent=v};
  set('#deal-id',d.id);set('#deal-amount',fmt(d.price)+' '+d.currency);set('#deal-status-badge',ST[d.status]||d.status);set('#deal-desc',d.desc);set('#deal-method',methodLabel(d.method));set('#deal-created',new Date(d.created_at||d.createdAt).toLocaleString('ru-RU'));
  const step=STEP[d.status]||1;
  $$('#screen-deal .step').forEach(s=>{const n=+s.dataset.st;s.classList.toggle('active',n===step);s.classList.toggle('done',n<step)});
  showScreen('deal');
  $('#btn-share-deal').onclick=()=>shareDeal(d);
  $('#btn-cancel-deal').onclick=async()=>{if(['done','canceled'].includes(d.status))return toast('Сделка завершена');ask('Отменить сделку?','Средства вернутся в течение 24ч',async()=>{if(API_BASE){try{await api.cancelDeal(d.id)}catch(e){return toast('Ошибка: '+e.message)}}d.status='canceled';save();openDeal(id);renderDeals();toast('Отменено')})};
  $('#btn-advance-deal').onclick=()=>{const order=['created','waiting','paid','escrow','done'];const i=order.indexOf(d.status);if(i<0||i>=order.length-1)return toast('Статус финальный');d.status=order[i+1];save();openDeal(id);renderDeals();toast('Статус: '+(ST[d.status]||d.status))};
}

/* ---- Wallets ---- */
let curCur='RUB';
function renderTabs(){const tabs=$('#currency-tabs');if(!tabs)return;tabs.innerHTML=FIAT.map(f=>`<button class="ctab ${f.code===curCur?'active':''}" data-cur="${f.code}"><img src="${iconUrl(f.code)}" alt=""><span>${f.code}</span></button>`).join('');$$('#currency-tabs .ctab').forEach(t=>t.addEventListener('click',()=>{curCur=t.dataset.cur;renderWallets()}))}
function renderWallets(){
  renderTabs();
  const f=BY_CODE[curCur];if(!f)return;
  const set=(s,v)=>{const e=$(s);if(e)e.textContent=v};
  const bal=(state.me&&state.me.balances&&Number(state.me.balances[curCur]))||0;
  const card=(state.me&&state.me.cards&&state.me.cards[curCur])||'';
  set('#wallet-amount',fmt(bal));set('#wallet-cur',curCur);set('#wallet-unit',f.unit);set('#card-cur',curCur);set('#card-number',card||'Не указаны');
  const bg=$('#wallet-card-bg');if(bg)bg.src=iconUrl(curCur);
  const ops=(state.ops||[]).filter(o=>o.cur===curCur).slice(-10).reverse();const list=$('#wallet-ops');if(!list)return;
  if(!ops.length){list.innerHTML='<div class="empty"><div class="empty-emoji">💳</div><div class="empty-text">Операций пока нет</div></div>';return}
  list.innerHTML=ops.map(o=>`<div class="deal-item"><img class="di-ico" src="${iconUrl(o.cur)}" alt=""><div style="flex:1"><div class="di-title">${o.type==='topup'?'Пополнение':'Вывод'}</div><div class="di-sub">${new Date(o.at).toLocaleString('ru-RU')}</div></div><div class="di-amount" style="color:${o.type==='topup'?'var(--ok)':'var(--danger)'}">${o.type==='topup'?'+':'−'}${fmt(o.amount)} ${o.cur}</div></div>`).join('');
}

$('#btn-edit-card')&&$('#btn-edit-card').addEventListener('click',()=>{
  prompt2('Карта для '+curCur,'Номер карты',(state.me&&state.me.cards&&state.me.cards[curCur])||'',async v=>{
    const d=v.replace(/\D/g,'');if(d.length<12)return toast('Некорректный номер');
    if(API_BASE){try{await api.setCard({currency:curCur,number:d})}catch(e){return toast('Ошибка: '+e.message)}}
    state.me=state.me||{};state.me.cards=state.me.cards||{};state.me.cards[curCur]=d.replace(/(.{4})/g,'$1 ').trim();save();renderWallets();toast('Сохранено');loadMe().then(renderWallets);
  });
});
$('#btn-topup')&&$('#btn-topup').addEventListener('click',()=>{toast('Пополнение — через бота (пишите в чат)')});
$('#btn-withdraw')&&$('#btn-withdraw').addEventListener('click',()=>{
  if(!API_BASE)return toast('Нужен бэкенд (offline)');
  const card=(state.me&&state.me.cards&&state.me.cards[curCur]);
  if(!card)return toast('Сначала добавьте карту');
  prompt2('Вывод '+curCur,'Сумма (мин. '+MIN_WITHDRAW+')','',async v=>{
    const n=parseFloat(v.replace(',','.'));if(!n||n<MIN_WITHDRAW)return toast('Мин. '+MIN_WITHDRAW);
    try{await api.withdraw({currency:curCur,amount:n});toast('Заявка создана');loadMe().then(renderWallets)}
    catch(e){toast('Ошибка: '+e.message)}
  });
});

/* ---- Leaders (static + me) ---- */
function renderLeaders(){
  const me=(state.me&&state.me.user)||((tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user)||{first_name:'Вы'});
  const myAmt=(state.me&&state.me.balances&&Number(state.me.balances.RUB))||0;
  const top=[{name:'@playerok_top',amt:142500,ico:'👑'},{name:'@nft_baron',amt:98200,ico:'💫'},{name:'@gift_master',amt:73110,ico:'✨'},{name:'@telegrambro',amt:42020,ico:'🔥'},{name:'@trader_xyz',amt:28900,ico:'⚡'},{name:'@nft_king',amt:18400,ico:'🚀'},{name:'@'+(me.username||'you'),amt:myAmt,ico:'🟢',me:true}].sort((a,b)=>b.amt-a.amt);
  const slots=$$('.podium-slot');[top[1],top[0],top[2]].forEach((u,i)=>{if(!u||!slots[i])return;const n=slots[i].querySelector('.podium-name'),a=slots[i].querySelector('.podium-amt'),av=slots[i].querySelector('.podium-avatar');n&&(n.textContent=u.name);a&&(a.textContent=fmtI(u.amt)+' ₽');av&&(av.textContent=(u.name[1]||'?').toUpperCase())});
  const ll=$('#leaders-list');if(!ll)return;
  ll.innerHTML=top.slice(3).map((u,i)=>`<div class="deal-item" style="${u.me?'border:1.5px solid var(--primary)':''}"><div class="di-ico" style="background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${i+4}</div><div style="flex:1"><div class="di-title">${u.ico} ${esc(u.name)}${u.me?' · вы':''}</div><div class="di-sub">сделок: ${Math.floor(u.amt/300)}</div></div><div class="di-amount">${fmtI(u.amt)} ₽</div></div>`).join('');
}
$$('.ltab').forEach(t=>t.addEventListener('click',()=>{$$('.ltab').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderLeaders()}));

/* ---- Profile ---- */
function renderProfile(){
  renderUser();
  const me=state.me||{};
  $('#pstat-deals')&&($('#pstat-deals').textContent=me.deals_count||0);
  $('#pstat-active')&&($('#pstat-active').textContent=(state.deals||[]).filter(d=>!['done','canceled'].includes(d.status)).length);
  const hz=$('#hide-zero');hz&&(hz.checked=state.hideZero);
  const balances=(me.balances||{});
  const rows=ALL.map(c=>{const a=Number(balances[c.code]||0);if(state.hideZero&&a===0)return '';const isInt=(c.code==='STARS'||c.code==='NOT');return `<div class="bal-row" data-cur="${c.code}"><img class="bal-ico" src="${iconUrl(c.code)}" alt=""><div><div class="bal-name">${c.code}</div><div class="bal-unit">${esc(c.name)}</div></div><div><div class="bal-amt">${isInt?fmtI(a):fmt(a)}</div><div class="bal-amt-sub">${esc(c.unit)}</div></div></div>`}).join('');
  const bal=$('#balances');if(!bal)return;
  bal.innerHTML=rows||'<div class="empty"><div class="empty-emoji">📊</div><div class="empty-text">Нулевые балансы скрыты</div></div>';
}
$('#hide-zero')&&$('#hide-zero').addEventListener('change',e=>{state.hideZero=e.target.checked;save();renderProfile()});

/* ---- Admin ---- */
$('#open-admin')&&$('#open-admin').addEventListener('click',()=>{showScreen('admin');admSwitch('users')});
$$('.atab').forEach(b=>b.addEventListener('click',()=>admSwitch(b.dataset.atab)));
function admSwitch(name){$$('.atab').forEach(t=>t.classList.toggle('active',t.dataset.atab===name));$$('.apane').forEach(p=>p.classList.remove('active'));$('#apane-'+name)&&$('#apane-'+name).classList.add('active');if(name==='users')renderAdminUsers();if(name==='wd')renderAdminWd()}

let admUsersCache=[];
async function renderAdminUsers(){
  if(!API_BASE){$('#admin-users').innerHTML='<div class="empty"><div class="empty-emoji">🔌</div><div class="empty-text">Нужен бэкенд</div></div>';return}
  try{const j=await api.admUsers();admUsersCache=j.users||[];state.users=admUsersCache;save();paintAdminUsers()}
  catch(e){$('#admin-users').innerHTML='<div class="empty"><div class="empty-emoji">⚠️</div><div class="empty-text">Ошибка: '+esc(e.message)+'</div></div>'}
}
function paintAdminUsers(){
  const q=(($('#admin-search')&&$('#admin-search').value)||'').toLowerCase().trim();
  const list=admUsersCache.filter(u=>{if(!q)return true;return String(u.id).includes(q)||(u.username||'').toLowerCase().includes(q)||(u.first_name||'').toLowerCase().includes(q)});
  const ll=$('#admin-users');if(!ll)return;
  if(!list.length){ll.innerHTML='<div class="empty"><div class="empty-emoji">👥</div><div class="empty-text">Пусто</div></div>';return}
  ll.innerHTML=list.map(u=>{const balRub=Number((u.balances||{}).RUB||0);return `<div class="adm-user-row" data-uid="${u.id}"><div class="adm-user-avatar">${((u.first_name||u.username||'?')[0]||'?').toUpperCase()}</div><div class="col"><div class="adm-user-name">${esc(u.first_name||u.username||('id '+u.id))} ${u.is_admin?'<span class="profile-badge" style="vertical-align:1px;font-size:9px">A</span>':''}</div><div class="adm-user-uname">${esc(u.username?'@'+u.username:'id '+u.id)} · сделок ${u.deals_count||0}</div></div><div class="adm-user-bal">${fmt(balRub)} ₽<small>${fmtI(u.stars||0)} ⭐</small></div></div>`}).join('');
  $$('#admin-users .adm-user-row').forEach(r=>r.addEventListener('click',()=>openAdminUser(+r.dataset.uid)));
}
$('#admin-search')&&$('#admin-search').addEventListener('input',paintAdminUsers);

let auCur='RUB',auUser=null;
function openAdminUser(uid){
  const u=admUsersCache.find(x=>x.id===uid);if(!u)return;
  auUser=u;
  $('#au-name').textContent=u.first_name||u.username||('id '+u.id);
  $('#au-uname').textContent=u.username?'@'+u.username:'id '+u.id;
  $('#au-avatar').textContent=((u.first_name||u.username||'?')[0]||'?').toUpperCase();
  $('#au-badge').hidden=!u.is_admin;
  const sel=$('#au-cur');sel.innerHTML=ALL.map(c=>`<option value="${c.code}">${c.code}</option>`).join('')+'<option value="STARS_TG">STARS★</option>';
  sel.value=auCur;
  paintAuBalances();
  showScreen('admin-user');
}
function paintAuBalances(){
  if(!auUser)return;
  const bals=auUser.balances||{};
  const rows=Object.keys(bals).filter(k=>Number(bals[k])>0).map(k=>`<div class="bal-row"><img class="bal-ico" src="${iconUrl(k)}" alt=""><div><div class="bal-name">${esc(k)}</div></div><div><div class="bal-amt">${fmt(bals[k])}</div></div></div>`).join('');
  const sr=Number(auUser.stars||0);
  const all=(sr>0?`<div class="bal-row"><img class="bal-ico" src="${iconUrl('STARS')}" alt=""><div><div class="bal-name">STARS</div></div><div><div class="bal-amt">${fmtI(sr)}</div></div></div>`:'')+rows;
  $('#au-balances').innerHTML=all||'<div class="empty"><div class="empty-emoji">📊</div><div class="empty-text">Балансы пусты</div></div>';
}
async function admPay(op){
  if(!auUser)return;
  const cur=$('#au-cur').value;
  const amt=parseFloat(($('#au-amount').value||'0').replace(',','.'));
  if(!amt||amt<=0)return toast('Укажите сумму');
  try{
    if(cur==='STARS_TG'){const j=await api.admStars({user_id:auUser.id,op,amount:amt});auUser.stars=j.stars}
    else {const j=await api.admBalance({user_id:auUser.id,currency:cur,op,amount:amt});auUser.balances=auUser.balances||{};auUser.balances[cur]=j.balance}
    toast('OK');$('#au-amount').value='';paintAuBalances();renderAdminUsers();
  }catch(e){toast('Ошибка: '+e.message)}
}
$('#au-add')&&$('#au-add').addEventListener('click',()=>admPay('add'));
$('#au-sub')&&$('#au-sub').addEventListener('click',()=>admPay('sub'));
$('#au-set')&&$('#au-set').addEventListener('click',()=>admPay('set'));

async function renderAdminWd(){
  if(!API_BASE){$('#admin-wd').innerHTML='<div class="empty"><div class="empty-text">Нужен бэкенд</div></div>';return}
  try{const j=await api.admWd();const arr=j.withdrawals||[];const pend=arr.filter(w=>w.status==='pending');$('#wd-count')&&($('#wd-count').textContent=pend.length);const ll=$('#admin-wd');if(!ll)return;if(!arr.length){ll.innerHTML='<div class="empty"><div class="empty-emoji">✨</div><div class="empty-text">Заявок нет</div></div>';return}
  ll.innerHTML=arr.map(w=>`<div class="deal-item"><img class="di-ico" src="${iconUrl(w.currency)}" alt=""><div style="flex:1"><div class="di-title">${esc(w.username?'@'+w.username:'id '+w.user_id)}</div><div class="di-sub">${esc(w.id)} · ${new Date(w.created_at).toLocaleDateString('ru-RU')}</div></div><div style="text-align:right"><div class="di-amount">${fmt(w.amount)} ${esc(w.currency)}</div><div class="di-status s-${esc(w.status)}">${esc(w.status)}</div>${w.status==='pending'?`<div style="margin-top:6px;display:flex;gap:4px;justify-content:flex-end"><button class="link wd-rej" data-id="${esc(w.id)}" style="color:var(--danger)">✕</button><button class="link wd-ok" data-id="${esc(w.id)}" style="color:var(--ok)">✓</button></div>`:''}</div></div>`).join('');
  $$('#admin-wd .wd-ok').forEach(b=>b.addEventListener('click',async()=>{try{await api.admWdAct(b.dataset.id,'approve');toast('Подтверждено');renderAdminWd();renderAdminUsers()}catch(e){toast('Ошибка: '+e.message)}}));
  $$('#admin-wd .wd-rej').forEach(b=>b.addEventListener('click',async()=>{try{await api.admWdAct(b.dataset.id,'reject');toast('Отклонено');renderAdminWd();renderAdminUsers()}catch(e){toast('Ошибка: '+e.message)}}));
  }catch(e){$('#admin-wd').innerHTML='<div class="empty"><div class="empty-text">'+esc(e.message)+'</div></div>'}
}

/* ---- Lang ---- */
$$('.lang-btn').forEach(b=>{b.classList.toggle('active',b.dataset.lang===state.lang);b.addEventListener('click',()=>{state.lang=b.dataset.lang;save();$$('.lang-btn').forEach(x=>x.classList.toggle('active',x.dataset.lang===state.lang));toast('Язык: '+b.dataset.lang.toUpperCase())})});

/* ---- Modals ---- */
function ask(t,b,ok){const mb=$('#modal-back');if(!mb)return;$('#modal-title').textContent=t;$('#modal-body').textContent=b;mb.classList.add('show');$('#modal-ok').onclick=()=>{mb.classList.remove('show');ok&&ok()};$('#modal-cancel').onclick=()=>mb.classList.remove('show')}
function prompt2(t,p,v,ok){const mb=$('#modal-back');if(!mb)return;$('#modal-title').textContent=t;$('#modal-body').innerHTML=`<input id="_pm" class="field" placeholder="${esc(p)}" value="${esc(v||'')}" style="width:100%">`;mb.classList.add('show');setTimeout(()=>{const e=$('#_pm');if(e)e.focus()},50);$('#modal-ok').onclick=()=>{const e=$('#_pm');const val=e?e.value.trim():'';mb.classList.remove('show');if(val)ok&&ok(val)};$('#modal-cancel').onclick=()=>mb.classList.remove('show')}
const mback=$('#modal-back');mback&&mback.addEventListener('click',e=>{if(e.target===mback)mback.classList.remove('show')});

/* ---- Deep link ---- */
function handleDeepLink(){let id='';const qs=new URLSearchParams(location.search);id=qs.get('deal')||'';if(!id&&tg&&tg.initDataUnsafe&&tg.initDataUnsafe.start_param){const sp=String(tg.initDataUnsafe.start_param);if(sp.startsWith('deal_'))id=sp.slice(5)}if(id){setTimeout(()=>{const d=state.deals.find(x=>x.id===id);if(d){switchTab('deals');openDeal(d.id)}else{switchTab('deals');toast('Сделка #'+id+' не найдена')}},400)}}

/* ---- Init ---- */
applyTheme();renderUser();renderDeals();renderWallets();renderProfile();
(async()=>{await loadMe();renderUser();renderDeals();renderWallets();renderProfile();handleDeepLink();setInterval(()=>loadMe().then(()=>{renderUser();renderProfile();renderWallets()}),20000)})();
