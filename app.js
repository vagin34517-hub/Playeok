/* ===== Playerok Mini App v5 ===== */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try { tg && tg.ready(); tg && tg.expand(); } catch(e){}

const FEE = 1, MIN_WITHDRAW = 500, MIN_DEALS = 3;
const SUPPORT = '@PlayerokGiftsRelayer';
const CMC = 'https://s2.coinmarketcap.com/static/img/coins/128x128/';
const FLG = 'https://hatscripts.github.io/circle-flags/flags/';

/* Base URL of THIS mini app (so shared links open this same page) */
const APP_URL = (location.origin + location.pathname).replace(/\/+$/, '/');

const FIAT = [
  { code:'RUB', name:'Рос. рубль',  unit:'Руб',          flag:'ru' },
  { code:'KZT', name:'Тенге',           unit:'Тенге',        flag:'kz' },
  { code:'BYN', name:'Бел. рубль',  unit:'Бел.руб',     flag:'by' },
  { code:'UZS', name:'Сум',             unit:'Сум',          flag:'uz' },
  { code:'UAH', name:'Гривна',          unit:'Грн',          flag:'ua' },
  { code:'AMD', name:'Драм',            unit:'Драм',         flag:'am' },
  { code:'KGS', name:'Сом',             unit:'Сом',          flag:'kg' },
  { code:'AZN', name:'Манат AZ',        unit:'Манат',        flag:'az' },
  { code:'EUR', name:'Евро',            unit:'Евро',         flag:'european_union' },
  { code:'GEL', name:'Лари',            unit:'Лари',         flag:'ge' },
  { code:'MDL', name:'Лей',             unit:'Лей',          flag:'md' },
  { code:'TJS', name:'Сомони',          unit:'Сомони',       flag:'tj' },
  { code:'TMT', name:'Манат TM',        unit:'Манат',        flag:'tm' },
  { code:'USD', name:'Доллар',          unit:'USD',          flag:'us' },
];
const CRYPTO = [
  { code:'TON',   name:'Toncoin',   unit:'TON',   cmc:11419 },
  { code:'STARS', name:'TG Stars',  unit:'Звёзд', cmc:28057 },
  { code:'USDT',  name:'Tether',    unit:'USDT',  cmc:825 },
  { code:'BTC',   name:'Bitcoin',   unit:'BTC',   cmc:1 },
  { code:'ETH',   name:'Ethereum',  unit:'ETH',   cmc:1027 },
  { code:'BNB',   name:'BNB',       unit:'BNB',   cmc:1839 },
  { code:'SOL',   name:'Solana',    unit:'SOL',   cmc:5426 },
  { code:'TRX',   name:'Tron',      unit:'TRX',   cmc:1958 },
  { code:'DOGE',  name:'Dogecoin',  unit:'DOGE',  cmc:74 },
  { code:'NOT',   name:'Notcoin',   unit:'NOT',   cmc:28850 },
];
const ALL = [...CRYPTO, ...FIAT];
const BY_CODE = Object.fromEntries(ALL.map(c => [c.code, c]));
function iconUrl(code){
  const c = BY_CODE[code]; if (!c) return '';
  return c.cmc ? CMC + c.cmc + '.png' : FLG + c.flag + '.svg';
}
function unitOf(code){ return (BY_CODE[code]||{}).unit || code; }
function methodOf(code){
  if (code === 'TON') return 'ton';
  if (code === 'STARS') return 'stars';
  if (BY_CODE[code] && BY_CODE[code].cmc) return 'crypto';
  return 'card';
}
function methodLabel(m){ return ({ton:'TON-кошелёк',card:'Карта / СБП',stars:'Звёзды Telegram',crypto:'Криптокошелёк'})[m]||'—'; }

/* ---- State ---- */
const LS = 'playerok_state_v5';
const dflt = () => ({
  theme:'light', deals:[], ops:[],
  wallets: Object.fromEntries(FIAT.map(f=>[f.code, 0])),
  cards:   Object.fromEntries(FIAT.map(f=>[f.code, ''])),
  balances:Object.fromEntries(ALL.map(c=>[c.code, 0])),
  hideZero:false, lang:'ru',
});
let state = (() => { try { return { ...dflt(), ...JSON.parse(localStorage.getItem(LS)||'{}') }; } catch { return dflt(); } })();
state.wallets  = { ...Object.fromEntries(FIAT.map(f=>[f.code,0])), ...(state.wallets||{}) };
state.cards    = { ...Object.fromEntries(FIAT.map(f=>[f.code,''])), ...(state.cards||{}) };
state.balances = { ...Object.fromEntries(ALL.map(c=>[c.code,0])),  ...(state.balances||{}) };
const save = () => localStorage.setItem(LS, JSON.stringify(state));

/* ---- Helpers ---- */
const $ = (s,el=document)=>el.querySelector(s);
const $$= (s,el=document)=>Array.from(el.querySelectorAll(s));
const fmt = (n,dp=2)=>Number(n||0).toLocaleString('ru-RU',{minimumFractionDigits:dp,maximumFractionDigits:dp});
const fmtI= n=>Number(n||0).toLocaleString('ru-RU');
const nowISO=()=>new Date().toISOString();
const genId=()=>'PLR-'+Math.random().toString(36).slice(2,7).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase();
const esc = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),1800);try{tg&&tg.HapticFeedback&&tg.HapticFeedback.impactOccurred('light')}catch(e){}}
function openLink(u){try{if(tg&&tg.openTelegramLink&&u.includes('t.me'))return tg.openTelegramLink(u);if(tg&&tg.openLink)return tg.openLink(u)}catch(e){}window.open(u,'_blank')}
window.openLink = openLink;
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){try{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');document.body.removeChild(ta);return ok}catch(_){return false}}}

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

/* ---- User ---- */
(function(){const u=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user)||{};const name=[u.first_name,u.last_name].filter(Boolean).join(' ')||'Гость';const pn=$('#profile-name'),pu=$('#profile-uname'),pa=$('#profile-avatar');pn&&(pn.textContent=name);pu&&(pu.textContent=u.username?'@'+u.username:'@guest');pa&&(pa.textContent=(name[0]||'N').toUpperCase())})();

/* ---- Deals list ---- */
const ST={created:'Создана',waiting:'Ожидает',paid:'Оплачена',escrow:'Эскроу',done:'Завершена',canceled:'Отменена'};
const STEP={created:1,waiting:2,paid:3,escrow:4,done:5,canceled:1};
function renderDeals(){
  const active=state.deals.filter(d=>!['done','canceled'].includes(d.status));
  const history=state.deals.filter(d=>['done','canceled'].includes(d.status));
  const ac=$('#active-count'),hc=$('#history-count');
  ac&&(ac.textContent=active.length+' сделок');
  hc&&(hc.textContent=history.length+' сделок');
  const list=$('#deals-list'); if(!list)return;
  if(!state.deals.length){list.innerHTML='<div class="empty"><div class="empty-emoji">📭</div><div class="empty-text">Нет активных сделок</div><div class="empty-sub">Создайте первую — нажмите кнопку сверху</div></div>';return}
  list.innerHTML=state.deals.slice().reverse().slice(0,20).map(d=>`<div class="deal-item" data-deal="${d.id}"><img class="di-ico" src="${iconUrl(d.currency)}" alt=""><div style="flex:1;min-width:0"><div class="di-title">${esc(d.desc||d.id)}</div><div class="di-sub">${esc(d.id)} · ${new Date(d.createdAt).toLocaleDateString('ru-RU')}</div></div><div style="text-align:right"><div class="di-amount">${fmt(d.price)} ${d.currency}</div><div class="di-status s-${d.status}">${ST[d.status]||d.status}</div></div></div>`).join('');
  $$('#deals-list .deal-item').forEach(el=>el.addEventListener('click',()=>openDeal(el.dataset.deal)));
}

/* ---- Create deal ---- */
let draft={currency:null,method:null,price:0,desc:''};
const btnCreate=$('#btn-create-deal');
btnCreate&&btnCreate.addEventListener('click',()=>{draft={currency:null,method:null,price:0,desc:''};const fp=$('#f-price'),fd=$('#f-desc');fp&&(fp.value='');fd&&(fd.value='');renderCurrencyPicker();gotoStep(1);showScreen('create')});

function gotoStep(n){$$('#screen-create .step').forEach(s=>{const v=+s.dataset.step;s.classList.toggle('active',v===n);s.classList.toggle('done',v<n)});$$('#screen-create .step-pane').forEach(p=>p.classList.remove('active'));const pane=$('#pane-'+n);if(pane)pane.classList.add('active')}

function renderCurrencyPicker(){
  const renderGrid = (arr, isCrypto) => arr.map(c=>`<button class="cur-card ${isCrypto?'crypto':''}" data-cur="${c.code}"><img src="${iconUrl(c.code)}" alt="" loading="lazy"><div class="cur-card-name">${c.code}</div><div class="cur-card-unit">${esc(c.unit)}</div></button>`).join('');
  const gc=$('#grid-crypto'), gf=$('#grid-fiat');
  gc&&(gc.innerHTML=renderGrid(CRYPTO,true));
  gf&&(gf.innerHTML=renderGrid(FIAT,false));
  $$('#screen-create .cur-card').forEach(b=>b.addEventListener('click',()=>{
    draft.currency=b.dataset.cur;
    draft.method=methodOf(draft.currency);
    const ul=$('#f-unit-label');ul&&(ul.textContent=unitOf(draft.currency));
    gotoStep(2);
  }));
}

$$('[data-back-step]').forEach(b=>b.addEventListener('click',()=>gotoStep(+b.dataset.backStep)));
const fp=$('#f-price');
fp&&fp.addEventListener('input',()=>{const p=parseFloat(fp.value.replace(',','.'))||0;const fee=p*FEE/100;const ef=$('#f-fee'),en=$('#f-net');ef&&(ef.textContent=fmt(fee));en&&(en.textContent=fmt(p-fee))});
$$('[data-next]').forEach(b=>b.addEventListener('click',()=>{const n=+b.dataset.next;if(n===3){const p=parseFloat(($('#f-price').value||'').replace(',','.'));if(!p||p<=0)return toast('Укажите сумму');draft.price=p}gotoStep(n)}));

const btnFin=$('#btn-finalize');
btnFin&&btnFin.addEventListener('click',()=>{
  const v=($('#f-desc').value||'').trim();
  if(v.length<3)return toast('Опишите товар (мин. 3 символа)');
  draft.desc=v;
  const d={id:genId(),desc:draft.desc,price:draft.price,currency:draft.currency,method:draft.method,status:'created',createdAt:nowISO()};
  d.link = APP_URL + '?deal=' + d.id;
  state.deals.push(d); save();
  const dl=$('#deal-link'); dl&&(dl.textContent=d.link);
  gotoStep(4);
  try{tg&&tg.HapticFeedback&&tg.HapticFeedback.notificationOccurred('success')}catch(e){}
  renderDeals();
});

const btnShare=$('#btn-share');
btnShare&&btnShare.addEventListener('click',()=>{const d=state.deals[state.deals.length-1]; if(d)shareDeal(d)});

function shareDeal(d){
  const text = '💎 Playerok · Сделка #' + d.id
             + '\n💰 ' + fmt(d.price) + ' ' + d.currency
             + '\n\nОткрыть в мини-аппе:';
  const u = 'https://t.me/share/url?url=' + encodeURIComponent(d.link) + '&text=' + encodeURIComponent(text);
  openLink(u);
}
function shareRef(){
  const me=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user)||{};
  const ref=me.id||'me';
  const link = APP_URL + '?ref=' + ref;
  const text = '✨ Playerok — безопасные сделки и NFT-подарки в Telegram!';
  openLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text));
}

/* deal-link click → copy */
document.addEventListener('click',async ev=>{
  if(ev.target&&ev.target.id==='deal-link'){
    const t=(ev.target.textContent||'').trim();
    if(!t||t==='—')return;
    const ok=await copyText(t);
    toast(ok?'Ссылка скопирована':'Не удалось скопировать');
  }
});

/* ---- Deal detail ---- */
function openDeal(id){
  const d=state.deals.find(x=>x.id===id); if(!d)return;
  const set=(sel,v)=>{const el=$(sel);if(el)el.textContent=v};
  set('#deal-id', d.id);
  set('#deal-amount', fmt(d.price)+' '+d.currency);
  set('#deal-status-badge', ST[d.status]||d.status);
  set('#deal-desc', d.desc);
  set('#deal-method', methodLabel(d.method));
  set('#deal-created', new Date(d.createdAt).toLocaleString('ru-RU'));
  const step=STEP[d.status]||1;
  $$('#screen-deal .step').forEach(s=>{const n=+s.dataset.st;s.classList.toggle('active',n===step);s.classList.toggle('done',n<step)});
  showScreen('deal');
  const sb=$('#btn-share-deal'); if(sb)sb.onclick=()=>shareDeal(d);
  const cb=$('#btn-cancel-deal'); if(cb)cb.onclick=()=>{
    if(['done','canceled'].includes(d.status))return toast('Сделка завершена');
    ask('Отменить сделку?','Средства вернутся в течение 24 ч',()=>{d.status='canceled';save();openDeal(id);renderDeals();toast('Отменено')});
  };
  const adv=$('#btn-advance-deal'); if(adv)adv.onclick=()=>{
    const order=['created','waiting','paid','escrow','done'];
    const i=order.indexOf(d.status);
    if(i<0||i>=order.length-1)return toast('Статус финальный');
    d.status=order[i+1]; save(); openDeal(id); renderDeals(); toast('Статус: '+(ST[d.status]||d.status));
  };
}

/* ---- Wallets ---- */
let curCur='RUB';
function renderTabs(){const tabs=$('#currency-tabs');if(!tabs)return;tabs.innerHTML=FIAT.map(f=>`<button class="ctab ${f.code===curCur?'active':''}" data-cur="${f.code}"><img src="${iconUrl(f.code)}" alt=""><span>${f.code}</span></button>`).join('');$$('#currency-tabs .ctab').forEach(t=>t.addEventListener('click',()=>{curCur=t.dataset.cur;renderWallets()}))}
function renderWallets(){renderTabs();const f=BY_CODE[curCur];if(!f)return;const set=(sel,v)=>{const el=$(sel);if(el)el.textContent=v};set('#wallet-amount',fmt(state.wallets[curCur]||0));set('#wallet-cur',curCur);set('#wallet-unit',f.unit);set('#card-cur',curCur);set('#card-number',state.cards[curCur]||'Не указаны');const bg=$('#wallet-card-bg');if(bg)bg.src=iconUrl(curCur);const ops=state.ops.filter(o=>o.cur===curCur).slice(-10).reverse();const list=$('#wallet-ops');if(!list)return;if(!ops.length){list.innerHTML='<div class="empty"><div class="empty-emoji">💳</div><div class="empty-text">Операций пока нет</div></div>';return}list.innerHTML=ops.map(o=>`<div class="deal-item"><img class="di-ico" src="${iconUrl(o.cur)}" alt=""><div style="flex:1"><div class="di-title">${o.type==='topup'?'Пополнение':'Вывод'}</div><div class="di-sub">${new Date(o.at).toLocaleString('ru-RU')}</div></div><div class="di-amount" style="color:${o.type==='topup'?'var(--ok)':'var(--danger)'}">${o.type==='topup'?'+':'−'}${fmt(o.amount)} ${o.cur}</div></div>`).join('')}

const btnEdit=$('#btn-edit-card');
btnEdit&&btnEdit.addEventListener('click',()=>{prompt2('Карта для '+curCur,'Номер карты',state.cards[curCur]||'',v=>{const d=v.replace(/\D/g,'');if(d.length<12)return toast('Некорректный номер');state.cards[curCur]=d.replace(/(.{4})/g,'$1 ').trim();save();renderWallets();toast('Сохранено')})});
const btnTop=$('#btn-topup');
btnTop&&btnTop.addEventListener('click',()=>{prompt2('Пополнение '+curCur,'Сумма','',v=>{const n=parseFloat(v.replace(',','.'));if(!n||n<=0)return toast('Неверная сумма');state.wallets[curCur]=(state.wallets[curCur]||0)+n;state.ops.push({type:'topup',cur:curCur,amount:n,at:nowISO()});save();renderWallets();toast('Счёт пополнен')})});
const btnWd=$('#btn-withdraw');
btnWd&&btnWd.addEventListener('click',()=>{if(!state.cards[curCur])return toast('Сначала добавьте карту');const done=state.deals.filter(d=>d.status==='done').length;if(done<MIN_DEALS)return toast('Нужно '+MIN_DEALS+' завершённых сделок');prompt2('Вывод '+curCur,'Сумма (мин. '+MIN_WITHDRAW+')','',v=>{const n=parseFloat(v.replace(',','.'));if(!n||n<MIN_WITHDRAW)return toast('Мин. '+MIN_WITHDRAW);if((state.wallets[curCur]||0)<n)return toast('Недостаточно');state.wallets[curCur]-=n;state.ops.push({type:'withdraw',cur:curCur,amount:n,at:nowISO()});save();renderWallets();toast('Вывод создан')})});

/* ---- Leaders ---- */
function renderLeaders(){
  const me=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user)||{first_name:'Вы'};
  const myAmt=state.deals.filter(d=>d.status==='done').reduce((s,d)=>s+(d.currency==='RUB'?d.price:d.price*100),0);
  const top=[{name:'@playerok_top',amt:142500,ico:'👑'},{name:'@nft_baron',amt:98200,ico:'💫'},{name:'@gift_master',amt:73110,ico:'✨'},{name:'@telegrambro',amt:42020,ico:'🔥'},{name:'@trader_xyz',amt:28900,ico:'⚡'},{name:'@nft_king',amt:18400,ico:'🚀'},{name:'@'+(me.username||'you'),amt:myAmt,ico:'🟢',me:true}].sort((a,b)=>b.amt-a.amt);
  const slots=$$('.podium-slot');
  [top[1],top[0],top[2]].forEach((u,i)=>{if(!u||!slots[i])return;const n=slots[i].querySelector('.podium-name'),a=slots[i].querySelector('.podium-amt'),av=slots[i].querySelector('.podium-avatar');n&&(n.textContent=u.name);a&&(a.textContent=fmtI(u.amt)+' ₽');av&&(av.textContent=(u.name[1]||'?').toUpperCase())});
  const ll=$('#leaders-list'); if(!ll)return;
  ll.innerHTML=top.slice(3).map((u,i)=>`<div class="deal-item" style="${u.me?'border:1.5px solid var(--primary)':''}"><div class="di-ico" style="background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${i+4}</div><div style="flex:1"><div class="di-title">${u.ico} ${esc(u.name)}${u.me?' · вы':''}</div><div class="di-sub">сделок: ${Math.floor(u.amt/300)}</div></div><div class="di-amount">${fmtI(u.amt)} ₽</div></div>`).join('');
}
$$('.ltab').forEach(t=>t.addEventListener('click',()=>{$$('.ltab').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderLeaders()}));

/* ---- Profile ---- */
function renderProfile(){
  const done=state.deals.filter(d=>d.status==='done').length;
  const act=state.deals.filter(d=>!['done','canceled'].includes(d.status)).length;
  const set=(sel,v)=>{const el=$(sel);if(el)el.textContent=v};
  set('#pstat-deals',done); set('#pstat-active',act);
  const hz=$('#hide-zero'); if(hz)hz.checked=state.hideZero;
  const rows=ALL.map(c=>{const a=state.balances[c.code]||0;if(state.hideZero&&a===0)return '';const isInt=(c.code==='STARS'||c.code==='NOT');return `<div class="bal-row" data-cur="${c.code}"><img class="bal-ico" src="${iconUrl(c.code)}" alt=""><div><div class="bal-name">${c.code}</div><div class="bal-unit">${esc(c.name)}</div></div><div><div class="bal-amt">${isInt?fmtI(a):fmt(a)}</div><div class="bal-amt-sub">${esc(c.unit)}</div></div></div>`}).join('');
  const bal=$('#balances'); if(!bal)return;
  bal.innerHTML=rows||'<div class="empty"><div class="empty-emoji">📊</div><div class="empty-text">Балансы скрыты</div></div>';
  $$('#balances .bal-row').forEach(row=>{
    let t;
    const open=()=>prompt2('Начислить '+row.dataset.cur,'Сумма (+/−)','',v=>{const n=parseFloat(v.replace(',','.'));if(!n)return;state.balances[row.dataset.cur]=(state.balances[row.dataset.cur]||0)+n;save();renderProfile();toast('Баланс обновлён')});
    const start=()=>{t=setTimeout(open,650)};
    const stop=()=>clearTimeout(t);
    row.addEventListener('touchstart',start,{passive:true});
    row.addEventListener('touchend',stop);
    row.addEventListener('touchcancel',stop);
    row.addEventListener('mousedown',start);
    row.addEventListener('mouseup',stop);
    row.addEventListener('mouseleave',stop);
    row.addEventListener('click',()=>{ if(!('ontouchstart' in window)) open(); });
  });
}
const hz=$('#hide-zero'); hz&&hz.addEventListener('change',e=>{state.hideZero=e.target.checked;save();renderProfile()});

/* ---- Lang ---- */
$$('.lang-btn').forEach(b=>{b.classList.toggle('active',b.dataset.lang===state.lang);b.addEventListener('click',()=>{state.lang=b.dataset.lang;save();$$('.lang-btn').forEach(x=>x.classList.toggle('active',x.dataset.lang===state.lang));toast('Язык: '+b.dataset.lang.toUpperCase())})});

/* ---- Modals ---- */
function ask(t,b,ok){const mb=$('#modal-back');if(!mb)return;$('#modal-title').textContent=t;$('#modal-body').textContent=b;mb.classList.add('show');$('#modal-ok').onclick=()=>{mb.classList.remove('show');ok&&ok()};$('#modal-cancel').onclick=()=>mb.classList.remove('show')}
function prompt2(t,p,v,ok){const mb=$('#modal-back');if(!mb)return;$('#modal-title').textContent=t;$('#modal-body').innerHTML=`<input id="_pm" class="field" placeholder="${esc(p)}" value="${esc(v||'')}" style="width:100%">`;mb.classList.add('show');setTimeout(()=>{const e=$('#_pm');if(e)e.focus()},50);$('#modal-ok').onclick=()=>{const e=$('#_pm');const val=e?e.value.trim():'';mb.classList.remove('show');if(val)ok&&ok(val)};$('#modal-cancel').onclick=()=>mb.classList.remove('show')}
const mback=$('#modal-back'); mback&&mback.addEventListener('click',e=>{if(e.target===mback)mback.classList.remove('show')});

/* ---- Deep-link в мини-аппу ---- */
function handleDeepLink(){
  let dealId='';
  const qs=new URLSearchParams(location.search);
  dealId = qs.get('deal') || '';
  if(!dealId && tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param){
    const sp=String(tg.initDataUnsafe.start_param);
    if(sp.startsWith('deal_')) dealId=sp.slice(5);
  }
  if(dealId){
    const d=state.deals.find(x=>x.id===dealId);
    if(d){ switchTab('deals'); openDeal(d.id); }
    else { switchTab('deals'); toast('Сделка #'+dealId+' не найдена'); }
  }
}

/* ---- Init ---- */
applyTheme(); renderDeals(); renderWallets(); renderProfile(); handleDeepLink();
