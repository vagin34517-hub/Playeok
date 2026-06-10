/* ===================== Playerok Mini App ===================== */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try { tg && tg.ready(); tg && tg.expand(); } catch(e){}

/* ---------- State ---------- */
const LS_KEY = 'playerok_state_v1';
const defaultState = () => ({
  theme: 'light',
  deals: [],                // {id, desc, price, currency, buyer, status, createdAt}
  wallets: { RUB:0, USD:0, EUR:0, UAH:0, KZT:0 },
  cards:   { RUB:'', USD:'', EUR:'', UAH:'', KZT:'' },
  balances:{ TON:0, USDT:0, STARS:0, USD:0 },
  ops: [],                  // wallet operations
  hideZero: false,
  language: 'ru',
});
let state = (() => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch { return defaultState(); }
})();
const save = () => localStorage.setItem(LS_KEY, JSON.stringify(state));

/* ---------- Helpers ---------- */
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const fmt = (n, dp=2) => Number(n||0).toLocaleString('ru-RU', { minimumFractionDigits:dp, maximumFractionDigits:dp });
const fmtInt = n => Number(n||0).toLocaleString('ru-RU');
const nowISO = () => new Date().toISOString();
const genId = () => 'PLR-' + Math.random().toString(36).slice(2,7).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove('show'), 1800);
  try { tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred('light'); } catch{}
}

/* ---------- Навигация ---------- */
let currentTab = 'deals';
function showScreen(name){
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  window.scrollTo({top:0});
}
function switchTab(name){
  currentTab = name;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  showScreen(name);
  if (name === 'deals') renderDeals();
  if (name === 'wallets') renderWallets();
  if (name === 'leaders') renderLeaders();
  if (name === 'profile') renderProfile();
}
$$('.nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
$$('[data-back]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.back)));

/* ---------- Тема ---------- */
function applyTheme(){
  document.body.dataset.theme = state.theme;
  $('#theme-toggle').textContent = state.theme === 'dark' ? '☀️' : '🌙';
  try { tg && tg.setHeaderColor && tg.setHeaderColor(state.theme === 'dark' ? '#0c1018' : '#f4f6fb'); } catch{}
}
$('#theme-toggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  save(); applyTheme();
});

/* ---------- Telegram user ---------- */
function applyUser(){
  const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  if (u){
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Гость';
    const uname = u.username ? '@'+u.username : 'id'+u.id;
    $('#profile-name').textContent = name;
    $('#profile-uname').textContent = uname;
    $('#profile-avatar').textContent = (name[0]||'P').toUpperCase();
  }
}

/* ===================== СДЕЛКИ ===================== */
const STATUS_LABEL = {
  created: 'Создана',
  buyer:   'Ожидает покупателя',
  paid:    'Оплачена',
  escrow:  'В эскроу',
  done:    'Получена',
  canceled:'Отменена',
};
const STATUS_STEP = { created:1, buyer:2, paid:3, escrow:4, done:5, canceled:0 };

function renderDeals(){
  const active = state.deals.filter(d => !['done','canceled'].includes(d.status));
  const history = state.deals.filter(d => ['done','canceled'].includes(d.status));
  $('#active-count').textContent = active.length + ' сделок';
  $('#history-count').textContent = history.length + ' сделок';

  const list = $('#deals-list');
  if (!state.deals.length){
    list.innerHTML = `<div class="empty"><div class="empty-emoji">📭</div><div class="empty-text">Нет активных сделок</div><div class="empty-sub">Создайте первую сделку, чтобы начать</div></div>`;
    return;
  }
  const items = state.deals.slice().reverse().slice(0, 10).map(d => `
    <div class="deal-item" data-deal="${d.id}">
      <div class="deal-item-main">
        <div class="di-title">${escapeHtml(d.desc || d.id)}</div>
        <div class="di-sub">${escapeHtml(d.buyer || '—')} · ${new Date(d.createdAt).toLocaleDateString('ru-RU')}</div>
      </div>
      <div class="deal-item-right">
        <div class="di-amount">${fmt(d.price)} ${d.currency}</div>
        <div class="di-status s-${d.status}">${STATUS_LABEL[d.status]||d.status}</div>
      </div>
    </div>`).join('');
  list.innerHTML = items;
  $$('#deals-list .deal-item').forEach(el => el.addEventListener('click', () => openDeal(el.dataset.deal)));
}

$('#btn-create-deal').addEventListener('click', () => openCreate());
$$('.tile').forEach(t => t.addEventListener('click', () => {
  toast(t.dataset.filter === 'active' ? 'Активные сделки' : 'История сделок');
}));

/* ---------- Создание ---------- */
let draft = { desc:'', price:0, currency:'TON', buyer:'' };
function openCreate(){
  draft = { desc:'', price:0, currency:'TON', buyer:'' };
  $('#f-desc').value=''; $('#f-price').value=''; $('#f-buyer').value=''; $('#f-currency').value='TON';
  gotoStep(1);
  showScreen('create');
  showSafetyOnce();
}
function gotoStep(n){
  $$('#screen-create .step').forEach(s => {
    const step = +s.dataset.step;
    s.classList.toggle('active', step === n);
    s.classList.toggle('done', step < n);
  });
  $$('#screen-create .step-pane').forEach(p => p.classList.remove('active'));
  $('#pane-' + n).classList.add('active');
}
$$('[data-next]').forEach(b => b.addEventListener('click', () => {
  const next = +b.dataset.next;
  if (next === 2){
    const v = $('#f-desc').value.trim();
    if (v.length < 3) return toast('Опишите товар');
    draft.desc = v;
  }
  if (next === 3){
    const p = parseFloat($('#f-price').value);
    if (!p || p<=0) return toast('Укажите цену');
    draft.price = p; draft.currency = $('#f-currency').value;
  }
  gotoStep(next);
}));
$$('[data-prev]').forEach(b => b.addEventListener('click', () => gotoStep(+b.dataset.prev)));

$('#btn-finalize').addEventListener('click', () => {
  const b = $('#f-buyer').value.trim();
  if (!b) return toast('Укажите покупателя');
  draft.buyer = b.startsWith('@') ? b : '@' + b.replace(/^https?:\/\/t\.me\//,'');
  const deal = {
    id: genId(),
    desc: draft.desc,
    price: draft.price,
    currency: draft.currency,
    buyer: draft.buyer,
    status: 'created',
    createdAt: nowISO(),
  };
  state.deals.push(deal);
  save();
  $('#success-id').textContent = 'ID: ' + deal.id;
  gotoStep(4);
  try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('success'); } catch{}
});

$('#btn-share').addEventListener('click', () => {
  const id = $('#success-id').textContent.replace('ID: ','');
  shareDeal(id);
});

/* ---------- Открыть сделку ---------- */
function openDeal(id){
  const d = state.deals.find(x => x.id === id);
  if (!d) return;
  $('#deal-id').textContent = 'ID: ' + d.id;
  $('#deal-amount').textContent = fmt(d.price) + ' ' + d.currency;
  $('#deal-status-badge').textContent = STATUS_LABEL[d.status]||d.status;
  $('#deal-desc').textContent = d.desc;
  $('#deal-buyer').textContent = d.buyer || '—';
  $('#deal-created').textContent = new Date(d.createdAt).toLocaleString('ru-RU');

  const step = STATUS_STEP[d.status] || 1;
  $$('#deal-stepper .step').forEach(s => {
    const n = +s.dataset.st;
    s.classList.toggle('active', n === step);
    s.classList.toggle('done', n < step);
  });
  showScreen('deal');
  $('#btn-share-deal').onclick = () => shareDeal(d.id);
  $('#btn-cancel-deal').onclick = () => {
    if (['done','canceled'].includes(d.status)) return toast('Сделка завершена');
    askModal('Отменить сделку?', 'Средства вернутся в течение 24 ч', () => {
      d.status = 'canceled'; save(); openDeal(d.id); toast('Сделка отменена');
    });
  };
}

function shareDeal(id){
  const text = 'Моя эскроу-сделка на Playerok · ID: ' + id;
  const url = 'https://t.me/share/url?url=' + encodeURIComponent('https://playerok.app/deal/' + id) + '&text=' + encodeURIComponent(text);
  try {
    if (tg && tg.openTelegramLink) { tg.openTelegramLink(url); return; }
    if (tg && tg.openLink) { tg.openLink(url); return; }
  } catch(e){}
  try { navigator.clipboard.writeText(text); toast('Ссылка скопирована'); return; } catch(e){}
  toast('Deal ID: ' + id);
}

/* ===================== КОШЕЛЬКИ ===================== */
let currentCur = 'RUB';
function renderWallets(){
  $$('#currency-tabs .ctab').forEach(t => t.classList.toggle('active', t.dataset.cur === currentCur));
  $('#wallet-amount').textContent = fmt(state.wallets[currentCur]);
  $('#wallet-cur').textContent = currentCur;
  $('#card-cur').textContent = currentCur;
  $('#card-number').textContent = state.cards[currentCur] || 'Не указана';

  const ops = state.ops.filter(o => o.cur === currentCur).slice(-10).reverse();
  const list = $('#wallet-ops');
  if (!ops.length){
    list.innerHTML = `<div class="empty"><div class="empty-emoji">💳</div><div class="empty-text">Операций пока нет</div></div>`;
  } else {
    list.innerHTML = ops.map(o => `
      <div class="deal-item">
        <div class="deal-item-main">
          <div class="di-title">${o.type === 'topup' ? 'Пополнение' : 'Вывод'}</div>
          <div class="di-sub">${new Date(o.at).toLocaleString('ru-RU')}</div>
        </div>
        <div class="deal-item-right">
          <div class="di-amount" style="color:${o.type==='topup'?'var(--ok)':'var(--danger)'}">${o.type==='topup'?'+':'−'}${fmt(o.amount)} ${o.cur}</div>
        </div>
      </div>`).join('');
  }
}
$$('#currency-tabs .ctab').forEach(t => t.addEventListener('click', () => {
  currentCur = t.dataset.cur; renderWallets();
}));
$('#btn-edit-card').addEventListener('click', () => {
  promptModal('Карта для ' + currentCur, 'Номер карты (16 цифр)', state.cards[currentCur]||'', v => {
    const digits = v.replace(/\D/g,'');
    if (digits.length < 12) return toast('Некорректный номер');
    state.cards[currentCur] = digits.replace(/(.{4})/g,'$1 ').trim();
    save(); renderWallets(); toast('Карта сохранена');
  });
});
$('#btn-topup').addEventListener('click', () => {
  promptModal('Пополнение ' + currentCur, 'Сумма', '', v => {
    const n = parseFloat(v.replace(',','.'));
    if (!n || n<=0) return toast('Неверная сумма');
    state.wallets[currentCur] = (state.wallets[currentCur]||0) + n;
    state.ops.push({ type:'topup', cur:currentCur, amount:n, at: nowISO() });
    save(); renderWallets(); toast('Счёт пополнен');
  });
});
$('#btn-withdraw').addEventListener('click', () => {
  if (!state.cards[currentCur]) return toast('Сначала добавьте карту');
  promptModal('Вывод ' + currentCur, 'Сумма', '', v => {
    const n = parseFloat(v.replace(',','.'));
    if (!n || n<=0) return toast('Неверная сумма');
    if ((state.wallets[currentCur]||0) < n) return toast('Недостаточно средств');
    state.wallets[currentCur] -= n;
    state.ops.push({ type:'withdraw', cur:currentCur, amount:n, at: nowISO() });
    save(); renderWallets(); toast('Вывод создан');
  });
});

/* ===================== ЛИДЕРЫ ===================== */
function renderLeaders(){
  // Демо-лидеры + вы (по сделкам)
  const myTotal = state.deals.filter(d => d.status==='done')
    .filter(d => d.currency==='TON')
    .reduce((s,d)=>s+d.price,0);
  const me = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || { first_name:'Вы' };
  const myName = me.first_name || 'Вы';
  const demo = [
    { name:'@playerok_top1', amt: 12450, ico:'👑' },
    { name:'@nft_baron',     amt: 9820,  ico:'💫' },
    { name:'@gift_master',   amt: 7311,  ico:'✨' },
    { name:'@telegrambro',   amt: 4202,  ico:'🔥' },
    { name:'@trader_xyz',    amt: 2890,  ico:'⚡' },
    { name:myName,           amt: myTotal,ico:'🟢', me:true },
  ].sort((a,b)=>b.amt-a.amt);

  const pSlots = $$('.podium-slot');
  [demo[1], demo[0], demo[2]].forEach((u,i)=>{
    if (!u) return;
    pSlots[i].querySelector('.podium-name').textContent = u.name;
    pSlots[i].querySelector('.podium-amt').textContent = fmtInt(u.amt) + ' TON';
  });

  const list = $('#leaders-list');
  list.innerHTML = demo.slice(3).map((u,i)=>`
    <div class="deal-item" style="${u.me?'border-color:var(--primary)':''}">
      <div class="deal-item-main">
        <div class="di-title">${i+4}. ${u.ico} ${escapeHtml(u.name)}${u.me?' · вы':''}</div>
        <div class="di-sub">всего сделок: ${Math.floor(u.amt/300)}</div>
      </div>
      <div class="deal-item-right">
        <div class="di-amount">${fmtInt(u.amt)} TON</div>
      </div>
    </div>`).join('');
}
$$('.ltab').forEach(t => t.addEventListener('click', () => {
  $$('.ltab').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  renderLeaders();
}));

/* ===================== ПРОФИЛЬ ===================== */
function renderProfile(){
  $('#hide-zero').checked = state.hideZero;
  $$('#balances .bal-row').forEach(row => {
    const cur = row.dataset.cur;
    const amt = state.balances[cur] || 0;
    row.querySelector('.bal-amt').textContent = cur === 'STARS' ? fmtInt(amt) : fmt(amt);
    row.style.display = (state.hideZero && amt === 0) ? 'none' : '';
  });
}
$('#hide-zero').addEventListener('change', e => { state.hideZero = e.target.checked; save(); renderProfile(); });
$$('[data-go]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.go === 'transactions') toast('Все транзакции в кошельках');
  if (b.dataset.go === 'languages')   toast('Язык: Русский');
}));

/* Долгое нажатие на TON — начислить (демо) */
$$('#balances .bal-row').forEach(row => {
  let t;
  row.addEventListener('touchstart', () => t = setTimeout(()=>{
    promptModal('Начислить ' + row.dataset.cur + ' (демо)', 'Сумма', '', v => {
      const n = parseFloat(v.replace(',','.'));
      if (!n) return;
      state.balances[row.dataset.cur] = (state.balances[row.dataset.cur]||0) + n;
      save(); renderProfile(); toast('Баланс обновлён');
    });
  }, 700));
  row.addEventListener('touchend', () => clearTimeout(t));
  row.addEventListener('touchcancel', () => clearTimeout(t));
});

/* ===================== БЕЗОПАСНОСТЬ ===================== */
let safetyShown = false;
function showSafetyOnce(){
  if (safetyShown) return;
  safetyShown = true;
  showScreen('safety');
  let s = 4;
  const btn = $('#btn-safety-confirm');
  const txt = $('#safety-text');
  btn.disabled = true;
  txt.textContent = 'Прочитайте — ' + s + 'с';
  const tick = setInterval(() => {
    s--;
    if (s > 0){
      txt.textContent = 'Прочитайте — ' + s + 'с';
    } else {
      clearInterval(tick);
      btn.disabled = false;
      txt.textContent = 'Я понял, продолжить';
    }
  }, 1000);
  btn.onclick = () => showScreen('create');
}

/* ===================== МОДАЛКИ ===================== */
function askModal(title, body, onOk){
  $('#modal-title').textContent = title;
  $('#modal-body').textContent = body;
  $('#modal-back').classList.add('show');
  $('#modal-ok').onclick = () => { $('#modal-back').classList.remove('show'); onOk && onOk(); };
  $('#modal-cancel').onclick = () => $('#modal-back').classList.remove('show');
}
function promptModal(title, placeholder, value, onOk){
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = `<input id="_pm_inp" class="field" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value||'')}">`;
  $('#modal-back').classList.add('show');
  setTimeout(()=>$('#_pm_inp').focus(), 50);
  $('#modal-ok').onclick = () => {
    const v = $('#_pm_inp').value.trim();
    $('#modal-back').classList.remove('show');
    if (v) onOk && onOk(v);
  };
  $('#modal-cancel').onclick = () => $('#modal-back').classList.remove('show');
}
$('#modal-back').addEventListener('click', e => { if (e.target === $('#modal-back')) $('#modal-back').classList.remove('show'); });

/* ===================== UTIL ===================== */
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ===================== INIT ===================== */
applyTheme();
applyUser();
renderDeals();
renderWallets();
renderProfile();
