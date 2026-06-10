// PLAYEROK — Mini App. Синхронизировано с ботом (script2.py)
const tg = window.Telegram?.WebApp;
try{ tg?.ready(); tg?.expand(); }catch(e){}

const FEE_PERCENT = 1;
const MIN_WITHDRAWAL_RUB = 500;
const MIN_DEALS = 3;
const STAR_TO_RUB = 1.3;
const SUPPORT_HANDLE = "@PlayerokGiftsRelayer";
const BOT_USERNAME = "PlayerokSDelka_bot";

const FIAT = [
  {code:"RUB", unit:"Руб",         name:"Российский рубль",   icon:"f-RUB"},
  {code:"KZT", unit:"Тенге",       name:"Казахстанский тенге",icon:"f-KZT"},
  {code:"BYN", unit:"Бел. руб",    name:"Белорусский рубль",  icon:"f-BYN"},
  {code:"UZS", unit:"Сум",         name:"Узбекский сум",      icon:"f-UZS"},
  {code:"UAH", unit:"Грн",         name:"Украинская гривна",  icon:"f-UAH"},
  {code:"AMD", unit:"Драм",        name:"Армянский драм",     icon:"f-AMD"},
  {code:"KGS", unit:"Сом",         name:"Киргизский сом",     icon:"f-KGS"},
  {code:"AZN", unit:"Манат",       name:"Азерб. манат",       icon:"f-AZN"},
  {code:"EUR", unit:"Евро",        name:"Евро",               icon:"f-EUR"},
  {code:"GEL", unit:"Лари",        name:"Грузинский лари",    icon:"f-GEL"},
  {code:"MDL", unit:"Лей",         name:"Молдавский лей",     icon:"f-MDL"},
  {code:"TJS", unit:"Сомони",      name:"Тадж. сомони",       icon:"f-TJS"},
  {code:"TMT", unit:"Манат (ТМ)",  name:"Туркм. манат",       icon:"f-TMT"},
  {code:"USD", unit:"Долл. США",   name:"Доллар США",         icon:"f-USD"},
];
const CRYPTO = [
  {code:"TON",   unit:"TON",    name:"Toncoin",         icon:"c-TON"},
  {code:"STARS", unit:"Звёзд",  name:"Звёзды Telegram", icon:"c-STARS"},
];
const CRYPTO_EXTRA = [
  {code:"USDT", unit:"USDT", name:"Tether USDT", icon:"c-USDT"},
  {code:"BTC",  unit:"BTC",  name:"Bitcoin",     icon:"c-BTC"},
  {code:"ETH",  unit:"ETH",  name:"Ethereum",    icon:"c-ETH"},
  {code:"SOL",  unit:"SOL",  name:"Solana",      icon:"c-SOL"},
  {code:"BNB",  unit:"BNB",  name:"BNB",         icon:"c-BNB"},
  {code:"NOT",  unit:"NOT",  name:"Notcoin",     icon:"c-NOT"},
  {code:"DOGE", unit:"DOGE", name:"Dogecoin",    icon:"c-DOGE"},
  {code:"TRX",  unit:"TRX",  name:"TRON",        icon:"c-TRX"},
];
const ALL = [...CRYPTO, ...CRYPTO_EXTRA, ...FIAT];
const byCode = c => ALL.find(x=>x.code===c);
const isCrypto = c => ["BTC","ETH","TON","SOL","BNB"].includes(c);

const LS = "playerok_state_v3";
function defaults(){
  const balances = {}; ALL.forEach(c=>balances[c.code]=0);
  return {theme:"light",lang:"ru",hideZero:true,user:{name:"Гость",uname:"guest",id:0},activeCur:"RUB",cards:{},wallets:{TON:""},balances,dealsCount:0,deals:[],ops:[],draft:{step:1,method:null,currency:"TON",price:"",desc:""}};
}
let S; try{ S = JSON.parse(localStorage.getItem(LS)) || defaults(); }catch(e){ S = defaults(); }
for(const c of ALL) if(S.balances[c.code]==null) S.balances[c.code]=0;
if(!S.draft) S.draft = defaults().draft;
const save = ()=>localStorage.setItem(LS, JSON.stringify(S));

try{ const u = tg?.initDataUnsafe?.user; if(u){ S.user.id=u.id; S.user.name=[u.first_name,u.last_name].filter(Boolean).join(" ")||"Гость"; S.user.uname=u.username||("id"+u.id); } }catch(e){}

const $ = s=>document.querySelector(s);
const $$ = s=>document.querySelectorAll(s);
const fmt = (n,d=2)=>{ if(typeof n!=="number") n=parseFloat(n)||0; return n.toLocaleString("ru-RU",{minimumFractionDigits:d,maximumFractionDigits:d}); };
const short = s => s ? (s.length>14 ? s.slice(0,6)+"…"+s.slice(-4) : s) : "";
const rid = ()=>"PLR-"+Math.random().toString(36).slice(2,7).toUpperCase();
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(window._tt); window._tt=setTimeout(()=>t.classList.remove("show"),1800); }
function haptic(t){ try{ tg?.HapticFeedback?.impactOccurred(t||"light"); }catch(e){} }
function modal(opts){
  const {title,body,okText="OK",cancelText="Отмена",hideCancel=false} = opts||{};
  return new Promise(res=>{
    $("#modal-title").textContent=title;
    if(typeof body==="string") $("#modal-body").innerHTML=body; else { $("#modal-body").innerHTML=""; $("#modal-body").append(body); }
    $("#modal-ok").textContent=okText; $("#modal-cancel").textContent=cancelText;
    $("#modal-cancel").style.display=hideCancel?"none":"";
    $("#modal-back").classList.add("show");
    const ok=()=>{cleanup();res(true)}, cn=()=>{cleanup();res(false)};
    function cleanup(){ $("#modal-back").classList.remove("show"); $("#modal-ok").removeEventListener("click",ok); $("#modal-cancel").removeEventListener("click",cn); }
    $("#modal-ok").addEventListener("click",ok,{once:true});
    $("#modal-cancel").addEventListener("click",cn,{once:true});
  });
}
async function prompt2(title,placeholder,initial){
  placeholder=placeholder||""; initial=initial||"";
  const wrap=document.createElement("div");
  const input=document.createElement("input");
  input.id="_pp"; input.placeholder=placeholder; input.value=initial; input.className="field"; input.style.marginTop="8px";
  wrap.appendChild(input);
  const ok=await modal({title,body:wrap,okText:"Сохранить"});
  if(!ok) return null;
  return document.getElementById("_pp")?.value?.trim()||"";
}
function shareLink(url,text){
  const u="https://t.me/share/url?url="+encodeURIComponent(url)+"&text="+encodeURIComponent(text);
  if(tg?.openTelegramLink) tg.openTelegramLink(u); else window.open(u,"_blank");
}

function go(tab){
  $$(".screen").forEach(s=>s.classList.remove("active"));
  const m = {deals:"#screen-deals",wallets:"#screen-wallets",leaders:"#screen-leaders",profile:"#screen-profile",create:"#screen-create",deal:"#screen-deal",safety:"#screen-safety",rules:"#screen-rules",lang:"#screen-lang"};
  const el = document.querySelector(m[tab]||"#screen-deals");
  if(el) el.classList.add("active");
  $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  window.scrollTo(0,0); haptic("light");
}
$$(".nav-btn").forEach(b=>b.addEventListener("click",()=>go(b.dataset.tab)));
$$("[data-back]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.back)));
$$("[data-go]").forEach(b=>b.addEventListener("click",e=>{
  const t=e.currentTarget.dataset.go;
  if(t==="support"){ const url="https://t.me/PlayerokGiftsRelayer"; if(tg?.openTelegramLink) tg.openTelegramLink(url); else window.open(url,"_blank"); return; }
  if(t==="referral"){ shareRef(); return; }
  if(t==="transactions"){ go("wallets"); return; }
  if(t==="languages"){ go("lang"); return; }
  if(t==="rules"){ go("rules"); return; }
}));
$$("[data-filter]").forEach(b=>b.addEventListener("click",()=>renderDeals(b.dataset.filter)));

function applyTheme(){
  document.body.dataset.theme=S.theme;
  const ic = S.theme==="dark"?"#i-sun":"#i-moon";
  $$(".theme-toggle svg use").forEach(u=>u.setAttribute("href",ic));
  try{ tg?.setHeaderColor && tg.setHeaderColor(S.theme==="dark"?"#0a0e17":"#f4f6fb"); }catch(e){}
}
function toggleTheme(){ S.theme = S.theme==="dark"?"light":"dark"; save(); applyTheme(); haptic("light"); }
$("#theme-toggle")?.addEventListener("click",toggleTheme);
$("#theme-toggle-2")?.addEventListener("click",toggleTheme);
$$(".lang-btn").forEach(b=>b.addEventListener("click",()=>{ S.lang=b.dataset.lang; save(); renderLang(); toast("Язык изменён"); haptic("medium"); }));
function renderLang(){ $$(".lang-btn").forEach(b=>b.classList.toggle("active",b.dataset.lang===S.lang)); }

function renderProfile(){
  $("#profile-name").textContent=S.user.name;
  $("#profile-uname").textContent="@"+S.user.uname;
  $("#profile-avatar").textContent=(S.user.name[0]||"P").toUpperCase();
  $("#pstat-deals").textContent=S.dealsCount;
  $("#pstat-active").textContent=S.deals.filter(d=>!["done","canceled"].includes(d.status)).length;
}
function renderBalances(){
  const order=[...CRYPTO,...CRYPTO_EXTRA,...FIAT];
  const wrap=$("#balances"); wrap.innerHTML="";
  for(const c of order){
    const amt=S.balances[c.code]||0;
    if(S.hideZero && amt===0) continue;
    const row=document.createElement("div"); row.className="bal-row";
    const d=isCrypto(c.code)?4:2;
    row.innerHTML='<svg class="bal-ico"><use href="#'+c.icon+'"/></svg>'+
      '<div><div class="bal-name">'+c.name+'</div><div class="bal-unit">'+c.unit+'</div></div>'+
      '<div><div class="bal-amt">'+fmt(amt,d)+'</div><div class="bal-amt-sub">'+c.code+'</div></div>';
    wrap.appendChild(row);
  }
  if(!wrap.children.length) wrap.innerHTML='<div class="empty"><div class="empty-emoji">💰</div><div class="empty-text">Нет средств</div><div class="empty-sub">Совершите первую сделку</div></div>';
}
$("#hide-zero")?.addEventListener("change",e=>{ S.hideZero=e.target.checked; save(); renderBalances(); });

function renderCurrencyTabs(){
  const tabs=$("#currency-tabs"); tabs.innerHTML="";
  const list=[{code:"TON",icon:"c-TON"},{code:"STARS",icon:"c-STARS"},...FIAT];
  list.forEach(c=>{
    const b=document.createElement("button"); b.className="ctab"+(c.code===S.activeCur?" active":"");
    b.innerHTML='<svg><use href="#'+c.icon+'"/></svg> '+c.code;
    b.addEventListener("click",()=>{ S.activeCur=c.code; save(); renderWallet(); haptic("light"); });
    tabs.appendChild(b);
  });
}
function renderWallet(){
  renderCurrencyTabs();
  const cur = byCode(S.activeCur)||byCode("RUB");
  const amt = S.balances[cur.code]||0;
  $("#wallet-amount").textContent=fmt(amt,isCrypto(cur.code)?4:2);
  $("#wallet-cur").textContent=cur.code;
  $("#wallet-unit").textContent=cur.unit;
  $("#card-cur").textContent=cur.code;
  if(cur.code==="TON") $("#card-number").textContent = S.wallets.TON?short(S.wallets.TON):"Не указан";
  else if(cur.code==="STARS") $("#card-number").textContent="Автоматически через Telegram";
  else $("#card-number").textContent = S.cards[cur.code]?short(S.cards[cur.code]):"Не указана";
  const wrap=$("#wallet-ops"); wrap.innerHTML="";
  const ops=S.ops.filter(o=>o.currency===cur.code).slice(0,20);
  if(!ops.length){ wrap.innerHTML='<div class="empty"><div class="empty-emoji">💳</div><div class="empty-text">Операций пока нет</div></div>'; return; }
  for(const o of ops){
    const sign=o.type==="in"?"+":"−";
    const cls=o.type==="in"?"s-done":"s-canceled";
    const el=document.createElement("div"); el.className="deal-item";
    el.innerHTML='<div><div class="di-title">'+o.label+'</div><div class="di-sub">'+new Date(o.ts).toLocaleString("ru-RU")+'</div></div>'+
      '<div style="text-align:right"><div class="di-amount">'+sign+fmt(o.amount)+' '+o.currency+'</div><span class="di-status '+cls+'">'+(o.type==="in"?"Пополнение":"Вывод")+'</span></div>';
    wrap.appendChild(el);
  }
}
$("#btn-edit-card")?.addEventListener("click",async()=>{
  const cur=byCode(S.activeCur);
  if(cur.code==="TON"){ const v=await prompt2("TON-кошелёк","UQ...",S.wallets.TON||""); if(v!==null){ S.wallets.TON=v; save(); renderWallet(); toast("Кошелёк сохранён"); } }
  else if(cur.code==="STARS") toast("Звёзды приходят автоматически");
  else { const v=await prompt2("Карта/СБП для "+cur.code,"Номер карты или телефон",S.cards[cur.code]||""); if(v!==null){ S.cards[cur.code]=v; save(); renderWallet(); toast("Сохранено"); } }
});
$("#btn-topup")?.addEventListener("click",async()=>{
  const cur=byCode(S.activeCur);
  const v=await prompt2("Пополнение "+cur.code,"Сумма"); const num=parseFloat((v||"").replace(",",".")); if(!num||num<=0) return;
  S.balances[cur.code]=(S.balances[cur.code]||0)+num;
  S.ops.unshift({type:"in",currency:cur.code,amount:num,label:"Пополнение "+cur.code,ts:Date.now()});
  save(); renderWallet(); renderBalances(); toast("Баланс пополнен"); haptic("medium");
});
$("#btn-withdraw")?.addEventListener("click",async()=>{
  const cur=byCode(S.activeCur);
  if(S.dealsCount<MIN_DEALS){ await modal({title:"Вывод недоступен",body:"Для вывода нужно не менее <b>"+MIN_DEALS+"</b> успешных сделок.<br>Сейчас у вас — "+S.dealsCount+".",hideCancel:true}); return; }
  if(cur.code==="RUB" && (S.balances.RUB||0)<MIN_WITHDRAWAL_RUB){ await modal({title:"Мин. сумма",body:"Минимальный вывод — <b>"+MIN_WITHDRAWAL_RUB+" RUB</b>.",hideCancel:true}); return; }
  const v=await prompt2("Вывод "+cur.code,"Сумма"); const num=parseFloat((v||"").replace(",",".")); if(!num||num<=0) return;
  if(num>(S.balances[cur.code]||0)){ toast("Недостаточно средств"); return; }
  S.balances[cur.code]-=num;
  S.ops.unshift({type:"out",currency:cur.code,amount:num,label:"Вывод "+cur.code,ts:Date.now()});
  save(); renderWallet(); renderBalances(); toast("Заявка на вывод принята"); haptic("medium");
});

function statusLabel(s){ return ({created:"Создана",paid:"Оплачена",escrow:"Эскроу",done:"Завершена",canceled:"Отменена"})[s]||s; }
function methodLabel(m){ return ({ton:"TON-кошелёк",card:"Карта / СБП",stars:"Звёзды Telegram"})[m]||m; }
function renderDeals(filter){
  filter=filter||"active";
  const wrap=$("#deals-list");
  const list = S.deals.filter(d => filter==="history"?["done","canceled"].includes(d.status):!["done","canceled"].includes(d.status));
  $("#active-count").textContent = S.deals.filter(d=>!["done","canceled"].includes(d.status)).length+" сделок";
  $("#history-count").textContent = S.deals.filter(d=>["done","canceled"].includes(d.status)).length+" сделок";
  if(!list.length){
    const emoji=filter==="history"?"📜":"📭";
    const text=filter==="history"?"История пуста":"Нет активных сделок";
    const sub=filter==="history"?"":"Создайте первую сделку";
    wrap.innerHTML='<div class="empty"><div class="empty-emoji">'+emoji+'</div><div class="empty-text">'+text+'</div><div class="empty-sub">'+sub+'</div></div>';
    return;
  }
  wrap.innerHTML="";
  list.slice(0,25).forEach(d=>{
    const item=document.createElement("div"); item.className="deal-item";
    const desc=(d.desc||"Без описания").slice(0,60);
    item.innerHTML='<div><div class="di-title">'+desc+'</div><div class="di-sub">'+d.id+' · '+new Date(d.created).toLocaleDateString("ru-RU")+'</div></div>'+
      '<div style="text-align:right"><div class="di-amount">'+fmt(d.amount)+' '+d.currency+'</div><span class="di-status s-'+d.status+'">'+statusLabel(d.status)+'</span></div>';
    item.addEventListener("click",()=>openDeal(d.id));
    wrap.appendChild(item);
  });
}

$("#btn-create-deal")?.addEventListener("click",()=>{ S.draft=defaults().draft; save(); go("create"); paintCreate(); });
function setStep(n){
  S.draft.step=n; save();
  $$("#screen-create .step").forEach(s=>{
    const v=s.dataset.step;
    s.classList.toggle("active",v===String(n));
    s.classList.toggle("done",(n!=="currency")&&(+v<+n));
  });
  $$("#screen-create .step-pane").forEach(p=>p.classList.remove("active"));
  if(n==="currency") document.querySelector("#pane-currency").classList.add("active");
  else document.querySelector("#pane-"+n)?.classList.add("active");
}
function paintCreate(){
  const grid=$("#currency-grid"); grid.innerHTML="";
  FIAT.forEach(c=>{
    const b=document.createElement("button"); b.className="cur-card";
    b.innerHTML='<svg><use href="#'+c.icon+'"/></svg><div><div class="cur-card-name">'+c.code+'</div><div class="cur-card-unit">'+c.unit+'</div></div>';
    b.addEventListener("click",()=>{ S.draft.currency=c.code; save(); $("#f-unit-label").textContent=c.code; setStep(2); haptic("light"); });
    grid.appendChild(b);
  });
  setStep(1);
  $("#f-price").value=""; $("#f-desc").value=""; updateFee();
}
$$(".method-btn").forEach(b=>b.addEventListener("click",()=>{
  const m=b.dataset.method; S.draft.method=m;
  if(m==="ton"){ S.draft.currency="TON"; $("#f-unit-label").textContent="TON"; setStep(2); }
  else if(m==="stars"){ S.draft.currency="STARS"; $("#f-unit-label").textContent="Звёзд"; setStep(2); }
  else setStep("currency");
  save(); updateFee(); haptic("medium");
}));
$$("[data-back-step]").forEach(b=>b.addEventListener("click",()=>setStep(+b.dataset.backStep)));
$$("[data-next]").forEach(b=>b.addEventListener("click",()=>{
  const n=+b.dataset.next;
  if(n===3){ const p=parseFloat(($("#f-price").value||"").replace(",",".")); if(!p||p<=0){ toast("Введите сумму"); return; } S.draft.price=p; save(); }
  setStep(n);
}));
function updateFee(){
  const p=parseFloat(($("#f-price").value||"0").replace(",","."))||0;
  const fee=p*FEE_PERCENT/100, net=p-fee;
  const d=isCrypto(S.draft.currency)?4:2;
  $("#f-fee").textContent=fmt(fee,d);
  $("#f-net").textContent=fmt(net,d);
}
$("#f-price")?.addEventListener("input",updateFee);

$("#btn-finalize")?.addEventListener("click",()=>{
  const price=parseFloat(($("#f-price").value||"").replace(",","."));
  const desc=$("#f-desc").value.trim();
  if(!price||price<=0){ toast("Введите сумму"); setStep(2); return; }
  const id=rid();
  const d={id,method:S.draft.method,currency:S.draft.currency,amount:price,desc,status:"created",created:Date.now(),buyer:""};
  S.deals.unshift(d); S.dealsCount=(S.dealsCount||0)+1; save();
  const link="https://t.me/"+BOT_USERNAME+"?start="+id;
  $("#deal-link").textContent=link;
  setStep(4); toast("Сделка создана"); haptic("medium");
  renderDeals("active"); renderProfile();
});
$("#btn-share")?.addEventListener("click",()=>{
  const d=S.deals[0]; if(!d) return;
  const link="https://t.me/"+BOT_USERNAME+"?start="+d.id;
  const text="🤝 Playerok гарант-сделка\n"+(d.desc||"")+"\nСумма: "+fmt(d.amount)+" "+d.currency;
  shareLink(link,text);
});

function openDeal(id){
  const d=S.deals.find(x=>x.id===id); if(!d) return;
  window._currentDeal=id;
  $("#deal-id").textContent="ID: "+id;
  $("#deal-amount").textContent=fmt(d.amount)+" "+d.currency;
  $("#deal-status-badge").textContent=statusLabel(d.status);
  $("#deal-desc").textContent=d.desc||"—";
  $("#deal-method").textContent=methodLabel(d.method);
  $("#deal-fee").textContent=FEE_PERCENT+"% · "+fmt(d.amount*FEE_PERCENT/100)+" "+d.currency;
  $("#deal-created").textContent=new Date(d.created).toLocaleString("ru-RU");
  const stMap={created:1,paid:3,escrow:4,done:5,canceled:1};
  const cur=stMap[d.status]||1;
  $$("#deal-stepper .step").forEach(s=>{ const v=+s.dataset.st; s.classList.toggle("active",v===cur); s.classList.toggle("done",v<cur); });
  go("deal");
}
$("#btn-share-deal")?.addEventListener("click",()=>{
  const id=window._currentDeal; if(!id) return;
  const d=S.deals.find(x=>x.id===id); if(!d) return;
  const link="https://t.me/"+BOT_USERNAME+"?start="+id;
  const text="🔒 Playerok · "+(d.desc||"Сделка")+"\nСумма: "+fmt(d.amount)+" "+d.currency;
  shareLink(link,text);
});
$("#btn-cancel-deal")?.addEventListener("click",async()=>{
  const id=window._currentDeal; const d=S.deals.find(x=>x.id===id); if(!d) return;
  const ok=await modal({title:"Отменить сделку?",body:"Действие нельзя отменить.",okText:"Отменить"});
  if(!ok) return;
  d.status="canceled"; save(); toast("Сделка отменена"); renderDeals("active"); go("deals");
});

$$(".ltab").forEach(b=>b.addEventListener("click",()=>{ $$(".ltab").forEach(x=>x.classList.remove("active")); b.classList.add("active"); renderLeaders(b.dataset.period); }));
function renderLeaders(period){
  period=period||"day";
  const mul=({day:1,week:5,month:18,all:80}[period])||1;
  const seed=[
    {name:"Алексей К.",u:"alex_k",amt:148*mul,deals:7*mul},
    {name:"Марина С.",u:"marina_s",amt:121*mul,deals:5*mul},
    {name:"Дмитрий Р.",u:"dima_r",amt:96*mul,deals:4*mul},
    {name:"Ирина Л.",u:"ira_l",amt:73*mul,deals:3*mul},
    {name:"Никита П.",u:"nikita_p",amt:58*mul,deals:3*mul},
    {name:"Олег Т.",u:"oleg_t",amt:42*mul,deals:2*mul},
    {name:"Светлана Б.",u:"sveta_b",amt:33*mul,deals:2*mul},
  ];
  if(S.dealsCount>0){
    const myTotal=(S.balances.RUB||0)/1000+(S.balances.TON||0)*0.35+S.dealsCount*8;
    seed.push({name:S.user.name,u:S.user.uname,amt:Math.max(1,Math.round(myTotal)),deals:S.dealsCount,me:true});
    seed.sort((a,b)=>b.amt-a.amt);
  }
  const podium=$("#podium"); podium.innerHTML="";
  const top3=seed.slice(0,3); const order=[top3[1],top3[0],top3[2]].filter(Boolean); const ranks=[2,1,3];
  order.forEach((p,i)=>{
    if(!p) return;
    const slot=document.createElement("div"); slot.className="podium-slot p"+ranks[i];
    const crown=ranks[i]===1?'<div class="crown">👑</div>':"";
    slot.innerHTML=crown+'<div class="podium-rank">'+ranks[i]+'</div><div class="podium-avatar">'+(p.name[0]||"?").toUpperCase()+'</div><div class="podium-name">'+p.name+(p.me?" · вы":"")+'</div><div class="podium-amt">'+fmt(p.amt*1000,0)+' ₽</div>';
    podium.appendChild(slot);
  });
  const list=$("#leaders-list"); list.innerHTML="";
  seed.slice(3,20).forEach((p,i)=>{
    const el=document.createElement("div"); el.className="deal-item";
    el.innerHTML='<div style="display:flex;align-items:center;gap:12px"><div class="podium-avatar" style="width:38px;height:38px;font-size:14px;margin:0;border:none">'+(p.name[0]||"?").toUpperCase()+'</div><div><div class="di-title">'+(i+4)+'. '+p.name+(p.me?" · вы":"")+'</div><div class="di-sub">@'+p.u+' · '+p.deals+' сделок</div></div></div><div class="di-amount">'+fmt(p.amt*1000,0)+' ₽</div>';
    list.appendChild(el);
  });
}

function shareRef(){
  const link="https://t.me/"+BOT_USERNAME+"?start=ref_"+(S.user.id||"0");
  const text="Присоединяйся к Playerok — безопасные сделки 24/7. Комиссия 1%.";
  shareLink(link,text);
}

let _safeTimer=null;
function startSafetyTimer(){
  let n=4; const b=$("#btn-safety-confirm"); const t=$("#safety-text");
  b.disabled=true; t.textContent="Прочитайте — "+n+"с";
  clearInterval(_safeTimer);
  _safeTimer=setInterval(()=>{ n--; if(n<=0){ clearInterval(_safeTimer); b.disabled=false; t.textContent="Я прочитал и принимаю"; } else t.textContent="Прочитайте — "+n+"с"; },1000);
}
$("#btn-safety-confirm")?.addEventListener("click",()=>{ toast("Подтверждено"); go("deals"); });

applyTheme(); renderLang();
renderProfile(); renderBalances(); renderWallet(); renderDeals("active"); renderLeaders("day");
if($("#hide-zero")) $("#hide-zero").checked = !!S.hideZero;
$("#min-withdraw").textContent = MIN_WITHDRAWAL_RUB;

if(!localStorage.getItem("playerok_welcomed")){
  setTimeout(()=>{
    modal({title:"👋 Добро пожаловать в Playerok",
      body:"<b>Playerok</b> — специализированный сервис безопасных внебиржевых сделок.<br><br>✔️ Автоматический алгоритм исполнения<br>⚡ Скорость и автоматизация<br>💳 Удобный вывод средств<br>💰 Комиссия — <b>1%</b><br>🕘 Режим: 24/7<br>🛠️ Поддержка: <b>"+SUPPORT_HANDLE+"</b>",
      okText:"Поехали",hideCancel:true});
    localStorage.setItem("playerok_welcomed","1");
  },350);
}
