/* ===== Playerok Mini App ===== */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try { tg && tg.ready(); tg && tg.expand(); } catch(e){}

/* ---- Конфиг (из script2.py) ---- */
const FEE = 1;
const MIN_WITHDRAW = 500;
const MIN_DEALS = 3;
const STAR_TO_RUB = 1.3;
const SUPPORT = '@PlayerokGiftsRelayer';
const BOT = 'PlayerokSDelka_bot';

const FIAT = [
  { code:'RUB', name:'Российский рубль',  unit:'Руб',         flag:'ru' },
  { code:'KZT', name:'Казахстанский тенге', unit:'Тенге',     flag:'kz' },
  { code:'BYN', name:'Белорусский рубль', unit:'Бел. руб',   flag:'by' },
  { code:'UZS', name:'Узбекский сум',     unit:'Сум',         flag:'uz' },
  { code:'UAH', name:'Украинская гривна', unit:'Грн',       flag:'ua' },
  { code:'AMD', name:'Армянский драм',     unit:'Драм',       flag:'am' },
  { code:'KGS', name:'Киргизский сом',    unit:'Сом',         flag:'kg' },
  { code:'AZN', name:'Азербайджанский манат', unit:'Манат', flag:'az' },
  { code:'EUR', name:'Евро',                  unit:'Евро',        flag:'european_union' },
  { code:'GEL', name:'Грузинский лари',    unit:'Лари',       flag:'ge' },
  { code:'MDL', name:'Молдавский лей',     unit:'Лей',         flag:'md' },
  { code:'TJS', name:'Таджикский сомони',  unit:'Сомони',     flag:'tj' },
  { code:'TMT', name:'Туркменский манат',   unit:'Манат (ТМ)',flag:'tm' },
  { code:'USD', name:'Доллар США',          unit:'Долл. США',  flag:'us' },
];
const CRYPTO = [
  { code:'TON',   name:'Toncoin',          unit:'TON',   cmc:11419 },
  { code:'STARS', name:'Telegram Stars',   unit:'Звёзд',cmc:28057 },
  { code:'USDT',  name:'Tether',           unit:'USDT',  cmc:825 },
  { code:'BTC',   name:'Bitcoin',          unit:'BTC',   cmc:1 },
  { code:'ETH',   name:'Ethereum',         unit:'ETH',   cmc:1027 },
  { code:'BNB',   name:'BNB',              unit:'BNB',   cmc:1839 },
  { code:'SOL',   name:'Solana',           unit:'SOL',   cmc:5426 },
  { code:'TRX',   name:'Tron',             unit:'TRX',   cmc:1958 },
  { code:'DOGE',  name:'Dogecoin',         unit:'DOGE',  cmc:74 },
  { code:'NOT',   name:'Notcoin',          unit:'NOT',   cmc:28850 },
];
const ALL = [...CRYPTO, ...FIAT];
const BY_CODE = Object.fromEntries(ALL.map(c => [c.code, c]));
function iconUrl(code){
  const c = BY_CODE[code];
  if (!c) return '';
  return c.cmc ? `https://s2.coinmarketcap.com/static/img/coins/128x128/${c.cmc}.png` : `https://hatscripts.github.io/circle-flags/flags/${c.flag}.svg`;
}
function unitOf(code){ return (BY_CODE[code]||{}).unit || code; }

/* ---- State ---- */
const LS = 'playerok_state_v4';
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

/* ---- Тема ---- */
function applyTheme(){document.body.dataset.theme=state.theme;try{tg&&tg.setHeaderColor&&tg.setHeaderColor(state.theme==='dark'?'#0a0e17':'#f4f6fb')}catch(e){}}
function toggleTheme(){state.theme=state.theme==='dark'?'light':'dark';save();applyTheme()}
$('#theme-toggle').addEventListener('click',toggleTheme);
$('#theme-toggle-2').addEventListener('click',toggleTheme);

/* ---- Навигация ---- */
function showScreen(name){$$('.screen').forEach(s=>s.classList.remove('active'));$('#screen-'+name).classList.add('active');window.scrollTo({top:0})}
function switchTab(name){$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));showScreen(name);if(name==='wallets')renderWallets();if(name==='leaders')renderLeaders();if(name==='profile')renderProfile();if(name==='deals')renderDeals()}
$$('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.back)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>{const g=b.dataset.go;if(g==='support')openLink('https://t.me/'+SUPPORT.replace('@',''));else if(g==='referral')shareRef();else if(g==='rules')showScreen('rules');else if(g==='languages')showScreen('lang');else if(g==='transactions')switchTab('wallets')}));

/* ---- Пользователь ---- */
(function user(){const u=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user)||{};const name=[u.first_name,u.last_name].filter(Boolean).join(' ')||'Гость';$('#profile-name').textContent=name;$('#profile-uname').textContent=u.username?'@'+u.username:'@guest';$('#profile-avatar').textContent=(name[0]||'N').toUpperCase()})();

/* ---- Сделки ---- */
const ST={created:'Создана',waiting:'Ожидает',paid:'Оплачена',escrow:'Эскроу',done:'Завершена',canceled:'Отменена'};
const STEP={created:1,waiting:2,paid:3,escrow:4,done:5,canceled:1};
function renderDeals(){
  const active=state.deals.filter(d=>!['done','canceled'].includes(d.status));
  const history=state.deals.filter(d=>['done','canceled'].includes(d.status));
  $('#active-count').textContent=active.length+' сделок';
  $('#history-count').textContent=history.length+' сделок';
  const list=$('#deals-list');
  if(!state.deals.length){list.innerHTML='<div class="empty"><div class="empty-emoji">📭</div><div class="empty-text">Нет активных сделок</div><div class="empty-sub">Создайте первую</div></div>';return}
  list.innerHTML=state.deals.slice().reverse().slice(0,12).map(d=>`<div class="deal-item" data-deal="${d.id}"><img class="di-ico" src="${iconUrl(d.currency)}" alt=""><div style="flex:1;min-width:0"><div class="di-title">${esc(d.desc||d.id)}</div><div class="di-sub">${esc(d.id)} · ${new Date(d.createdAt).toLocaleDateString('ru-RU')}</div></div><div style="text-align:right"><div class="di-amount">${fmt(d.price)} ${d.currency}</div><div class="di-status s-${d.status}">${ST[d.status]||d.status}</div></div></div>`).join('');
  $$('#deals-list .deal-item').forEach(el=>el.addEventListener('click',()=>openDeal(el.dataset.deal)));
}

/* ---- Создание ---- */
let draft={method:null,currency:'TON',price:0,desc:''};
$('#btn-create-deal').addEventListener('click',()=>{draft={method:null,currency:'TON',price:0,desc:''};$('#f-price').value='';$('#f-desc').value='';gotoStep(1);showScreen('create')});
function gotoStep(n){$$('#screen-create .step').forEach(s=>{const v=+s.dataset.step;s.classList.toggle('active',v===n);s.classList.toggle('done',v<n)});$$('#screen-create .step-pane').forEach(p=>p.classList.remove('active'));const id=(n===1.5)?'pane-currency':'pane-'+n;$('#'+id).classList.add('active')}
$$('.method-btn').forEach(b=>b.addEventListener('click',()=>{const m=b.dataset.method;draft.method=m;if(m==='ton'){draft.currency='TON';$('#f-unit-label').textContent='TON';gotoStep(2)}else if(m==='stars'){draft.currency='STARS';$('#f-unit-label').textContent='Звёзд';gotoStep(2)}else{renderCurrencyGrid();gotoStep(1.5)}}));
function renderCurrencyGrid(){$('#currency-grid').innerHTML=FIAT.map(f=>`<button class="cur-card" data-cur="${f.code}"><img src="${iconUrl(f.code)}" alt=""><div><div class="cur-card-name">${f.code}</div><div class="cur-card-unit">${f.unit}</div></div></button>`).join('');$$('#currency-grid .cur-card').forEach(b=>b.addEventListener('click',()=>{draft.currency=b.dataset.cur;$('#f-unit-label').textContent=b.dataset.cur;gotoStep(2)}))}
$$('[data-back-step]').forEach(b=>b.addEventListener('click',()=>{const n=+b.dataset.backStep;gotoStep(n===1&&draft.method==='card'?1.5:n)}));
$('#f-price').addEventListener('input',()=>{const p=parseFloat($('#f-price').value.replace(',','.'))||0;const fee=p*FEE/100;$('#f-fee').textContent=fmt(fee);$('#f-net').textContent=fmt(p-fee)});
$$('[data-next]').forEach(b=>b.addEventListener('click',()=>{const n=+b.dataset.next;if(n===3){const p=parseFloat($('#f-price').value.replace(',','.'));if(!p||p<=0)return toast('Укажите сумму');draft.price=p}gotoStep(n)}));
$('#btn-finalize').addEventListener('click',()=>{const v=$('#f-desc').value.trim();if(v.length<3)return toast('Опишите товар');draft.desc=v;const d={id:genId(),desc:draft.desc,price:draft.price,currency:draft.currency,method:draft.method,status:'created',createdAt:nowISO()};state.deals.push(d);save();const link=`https://t.me/${BOT}?start=deal_${d.id}`;$('#deal-link').textContent=link;d.link=link;save();gotoStep(4);try{tg&&tg.HapticFeedback&&tg.HapticFeedback.notificationOccurred('success')}catch(e){}});
$('#btn-share').addEventListener('click',()=>{const d=state.deals[state.deals.length-1];if(d)shareDeal(d)});
function openLink(u){try{if(tg&&tg.openTelegramLink&&u.includes('t.me'))return tg.openTelegramLink(u);if(tg&&tg.openLink)return tg.openLink(u)}catch(e){}window.open(u,'_blank')}
function shareDeal(d){const u=`https://t.me/share/url?url=${encodeURIComponent(d.link||('https://t.me/'+BOT))}&text=${encodeURIComponent('Моя сделка Playerok · '+fmt(d.price)+' '+d.currency)}`;openLink(u)}
function shareRef(){const me=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user)||{};const ref=me.id||'me';openLink(`https://t.me/share/url?url=${encodeURIComponent('https://t.me/'+BOT+'?start=ref_'+ref)}&text=${encodeURIComponent('Пользуйся Playerok — безопасные сделки!')}`)}

/* ---- Открыть сделку ---- */
function openDeal(id){const d=state.deals.find(x=>x.id===id);if(!d)return;$('#deal-id').textContent='ID: '+d.id;$('#deal-amount').textContent=fmt(d.price)+' '+d.currency;$('#deal-status-badge').textContent=ST[d.status]||d.status;$('#deal-desc').textContent=d.desc;$('#deal-method').textContent=({ton:'TON-кошелёк',card:'Карта / СБП',stars:'Звёзды Telegram'}[d.method]||'—');$('#deal-created').textContent=new Date(d.createdAt).toLocaleString('ru-RU');const step=STEP[d.status]||1;$$('#screen-deal .step').forEach(s=>{const n=+s.dataset.st;s.classList.toggle('active',n===step);s.classList.toggle('done',n<step)});showScreen('deal');$('#btn-share-deal').onclick=()=>shareDeal(d);$('#btn-cancel-deal').onclick=()=>{if(['done','canceled'].includes(d.status))return toast('Сделка завершена');ask('Отменить сделку?','Средства вернутся в 24ч',()=>{d.status='canceled';save();openDeal(id);toast('Отменено')})}}

/* ---- Кошельки ---- */
let curCur='RUB';
function renderTabs(){$('#currency-tabs').innerHTML=FIAT.map(f=>`<button class="ctab ${f.code===curCur?'active':''}" data-cur="${f.code}"><img src="${iconUrl(f.code)}" alt=""><span>${f.code}</span></button>`).join('');$$('#currency-tabs .ctab').forEach(t=>t.addEventListener('click',()=>{curCur=t.dataset.cur;renderWallets()}))}
function renderWallets(){renderTabs();const f=BY_CODE[curCur];$('#wallet-amount').textContent=fmt(state.wallets[curCur]);$('#wallet-cur').textContent=curCur;$('#wallet-unit').textContent=f.unit;$('#card-cur').textContent=curCur;$('#card-number').textContent=state.cards[curCur]||'Не указаны';$('#wallet-card-bg').src=iconUrl(curCur);const ops=state.ops.filter(o=>o.cur===curCur).slice(-10).reverse();const list=$('#wallet-ops');if(!ops.length){list.innerHTML='<div class="empty"><div class="empty-emoji">💳</div><div class="empty-text">Операций пока нет</div></div>';return}list.innerHTML=ops.map(o=>`<div class="deal-item"><img class="di-ico" src="${iconUrl(o.cur)}" alt=""><div style="flex:1"><div class="di-title">${o.type==='topup'?'Пополнение':'Вывод'}</div><div class="di-sub">${new Date(o.at).toLocaleString('ru-RU')}</div></div><div class="di-amount" style="color:${o.type==='topup'?'var(--ok)':'var(--danger)'}">${o.type==='topup'?'+':'−'}${fmt(o.amount)} ${o.cur}</div></div>`).join('')}
$('#btn-edit-card').addEventListener('click',()=>{prompt2('Карта для '+curCur,'Номер карты',state.cards[curCur]||'',v=>{const d=v.replace(/\D/g,'');if(d.length<12)return toast('Некорректный номер');state.cards[curCur]=d.replace(/(.{4})/g,'$1 ').trim();save();renderWallets();toast('Сохранено')})});
$('#btn-topup').addEventListener('click',()=>{prompt2('Пополнение '+curCur,'Сумма','',v=>{const n=parseFloat(v.replace(',','.'));if(!n||n<=0)return toast('Неверная сумма');state.wallets[curCur]+=n;state.ops.push({type:'topup',cur:curCur,amount:n,at:nowISO()});save();renderWallets();toast('Счёт пополнен')})});
$('#btn-withdraw').addEventListener('click',()=>{if(!state.cards[curCur])return toast('Сначала добавьте карту');const done=state.deals.filter(d=>d.status==='done').length;if(done<MIN_DEALS)return toast('Нужно '+MIN_DEALS+' завершённых сделок');prompt2('Вывод '+curCur,'Сумма (мин. '+MIN_WITHDRAW+')','',v=>{const n=parseFloat(v.replace(',','.'));if(!n||n<MIN_WITHDRAW)return toast('Мин. '+MIN_WITHDRAW);if((state.wallets[curCur]||0)<n)return toast('Недостаточно');state.wallets[curCur]-=n;state.ops.push({type:'withdraw',cur:curCur,amount:n,at:nowISO()});save();renderWallets();toast('Вывод создан')})});

/* ---- Лидеры ---- */
function renderLeaders(){const me=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user)||{first_name:'Вы'};const myAmt=state.deals.filter(d=>d.status==='done').reduce((s,d)=>s+d.price,0);const top=[{name:'@playerok_top',amt:14250,ico:'👑'},{name:'@nft_baron',amt:9820,ico:'💫'},{name:'@gift_master',amt:7311,ico:'✨'},{name:'@telegrambro',amt:4202,ico:'🔥'},{name:'@trader_xyz',amt:2890,ico:'⚡'},{name:'@'+(me.username||'you'),amt:myAmt,ico:'🟢',me:true}].sort((a,b)=>b.amt-a.amt);const slots=$$('.podium-slot');[top[1],top[0],top[2]].forEach((u,i)=>{if(!u||!slots[i])return;slots[i].querySelector('.podium-name').textContent=u.name;slots[i].querySelector('.podium-amt').textContent=fmtI(u.amt)+' ₽';slots[i].querySelector('.podium-avatar').textContent=(u.name[1]||'?').toUpperCase()});$('#leaders-list').innerHTML=top.slice(3).map((u,i)=>`<div class="deal-item" style="${u.me?'border:1.5px solid var(--primary)':''}"><div style="flex:1"><div class="di-title">${i+4}. ${u.ico} ${esc(u.name)}${u.me?' · вы':''}</div><div class="di-sub">сделок: ${Math.floor(u.amt/300)}</div></div><div class="di-amount">${fmtI(u.amt)} ₽</div></div>`).join('')}
$$('.ltab').forEach(t=>t.addEventListener('click',()=>{$$('.ltab').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderLeaders()}));

/* ---- Профиль ---- */
function renderProfile(){const done=state.deals.filter(d=>d.status==='done').length;const act=state.deals.filter(d=>!['done','canceled'].includes(d.status)).length;$('#pstat-deals').textContent=done;$('#pstat-active').textContent=act;$('#hide-zero').checked=state.hideZero;const rows=ALL.map(c=>{const a=state.balances[c.code]||0;if(state.hideZero&&a===0)return '';return `<div class="bal-row" data-cur="${c.code}"><img class="bal-ico" src="${iconUrl(c.code)}" alt=""><div><div class="bal-name">${c.code}</div><div class="bal-unit">${c.unit}</div></div><div><div class="bal-amt">${c.code==='STARS'||c.code==='NOT'?fmtI(a):fmt(a)}</div><div class="bal-amt-sub">${c.unit}</div></div></div>`}).join('');$('#balances').innerHTML=rows||'<div class="empty"><div class="empty-emoji">📊</div><div class="empty-text">Балансы скрыты</div></div>';$$('#balances .bal-row').forEach(row=>{let t;const start=()=>{t=setTimeout(()=>{prompt2('Начислить '+row.dataset.cur,'Сумма','',v=>{const n=parseFloat(v.replace(',','.'));if(!n)return;state.balances[row.dataset.cur]=(state.balances[row.dataset.cur]||0)+n;save();renderProfile();toast('Баланс обновлён')})},700)};const stop=()=>clearTimeout(t);row.addEventListener('touchstart',start);row.addEventListener('touchend',stop);row.addEventListener('touchcancel',stop);row.addEventListener('mousedown',start);row.addEventListener('mouseup',stop);row.addEventListener('mouseleave',stop)})}
$('#hide-zero').addEventListener('change',e=>{state.hideZero=e.target.checked;save();renderProfile()});

/* ---- Язык ---- */
$$('.lang-btn').forEach(b=>{b.classList.toggle('active',b.dataset.lang===state.lang);b.addEventListener('click',()=>{state.lang=b.dataset.lang;save();$$('.lang-btn').forEach(x=>x.classList.toggle('active',x.dataset.lang===state.lang));toast('Язык: '+b.dataset.lang.toUpperCase())})});

/* ---- Безопасность (4с) ---- */
let safetyShown=false;function showSafety(cb){if(safetyShown){cb&&cb();return}safetyShown=true;showScreen('safety');let s=4;const btn=$('#btn-safety-confirm');const t=$('#safety-text');btn.disabled=true;t.textContent='Прочитайте — '+s+'с';const iv=setInterval(()=>{s--;if(s>0){t.textContent='Прочитайте — '+s+'с'}else{clearInterval(iv);btn.disabled=false;t.textContent='Я понял, продолжить'}},1000);btn.onclick=()=>cb&&cb()}

/* ---- Модалки ---- */
function ask(t,b,ok){$('#modal-title').textContent=t;$('#modal-body').textContent=b;$('#modal-back').classList.add('show');$('#modal-ok').onclick=()=>{$('#modal-back').classList.remove('show');ok&&ok()};$('#modal-cancel').onclick=()=>$('#modal-back').classList.remove('show')}
function prompt2(t,p,v,ok){$('#modal-title').textContent=t;$('#modal-body').innerHTML=`<input id="_pm" class="field" placeholder="${esc(p)}" value="${esc(v||'')}">`;$('#modal-back').classList.add('show');setTimeout(()=>$('#_pm').focus(),50);$('#modal-ok').onclick=()=>{const v=$('#_pm').value.trim();$('#modal-back').classList.remove('show');if(v)ok&&ok(v)};$('#modal-cancel').onclick=()=>$('#modal-back').classList.remove('show')}
$('#modal-back').addEventListener('click',e=>{if(e.target===$('#modal-back'))$('#modal-back').classList.remove('show')});

/* ---- INIT ---- */
applyTheme();renderDeals();renderWallets();renderProfile();
