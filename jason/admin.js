/* Jason Academy · CRM (admin panel). Layout and look based on LeadCenter.
   Talks to the worker under /admin/* with a staff session (x-session). */
var API = 'https://jason-academy-bot.zevs2018123.workers.dev';
var TOKEN = null; try{ TOKEN = localStorage.getItem('jcrmToken'); }catch(e){}
var ME = null, CFG = null, VIEW = 'funnel';
var $ = function(id){ return document.getElementById(id); };
var main = $('main');
var TAB_NAMES = { funnel:'Воронка', crm:'CRM', tasks:'Задачи', content:'Контент', team:'Команда', settings:'Настройки' };
var RU = {
  exp:{ none:'нет опыта', demo:'только демо', lt1:'< 1 года', gt1:'> 1 года' },
  markets:{ forex:'форекс', gold:'золото', crypto:'крипта', stocks:'акции', none:'ничем' },
  problem:{ knowledge:'знания', losses:'убытки', discipline:'дисциплина', time:'время', capital:'капитал' },
  time:{ lt30:'< 30 мин', h1:'~1 час', h2:'2+ ч' },
  gate:{ none:'не прислал', pending:'на проверке', approved:'подтверждён', rejected:'отклонён' }
};
var STAGE_COL = { 'старт':'c-grey', 'подписался':'c-blue', 'прошёл анкету':'c-blue', 'прислал счёт':'c-yellow', 'счёт подтверждён':'c-green', 'депозит':'c-violet', 'в VIP':'c-violet', 'отказ':'c-red' };
var QUAL_COL = ['c-green', 'c-blue', 'c-yellow', 'c-violet', 'c-red'];

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
function money(n){ return n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US'); }
function num(n){ return n == null ? '—' : Number(n).toLocaleString('ru-RU'); }
function dt(t){ return t ? new Date(t).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'; }
function ago(t){ if(!t) return ''; var m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + ' мин' : m < 1440 ? Math.round(m / 60) + ' ч' : Math.round(m / 1440) + ' дн'; }
function toast(s){ var t = $('toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function(){ t.classList.remove('show'); }, 2200); }
function today(){ return new Date().toISOString().slice(0, 10); }
function api(path, body){
  return fetch(API + '/admin/' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type':'application/json', 'x-session': TOKEN || '' }, body: body ? JSON.stringify(body) : undefined })
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){
      if(r.status === 401 && !/^(login|setup|invite)/.test(path)){ logout(true); throw new Error('auth'); }
      if(!r.ok){ var e = new Error(j.error || ('Ошибка ' + r.status)); e.status = r.status; throw e; }
      return j;
    }); });
}
function fail(e){ if(e && e.message !== 'auth') toast(e.message || 'Ошибка сети'); }
function download(name, rows){
  var csv = rows.map(function(r){ return r.map(function(c){ return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type:'text/csv' })); a.download = name; a.click();
}
function skin(s){ document.documentElement.dataset.skin = s; try{ localStorage.setItem('jcrmSkin', s); }catch(e){} }
try{ var sk = localStorage.getItem('jcrmSkin'); if(sk) document.documentElement.dataset.skin = sk; }catch(e){}

/* ================= auth ================= */
function authBox(title, sub, fields, btn, onsubmit, foot){
  document.body.classList.add('auth');
  main.innerHTML = '<form class="authbox" id="authForm"><div class="brand"><span class="logo">J</span><span><b>Jason · CRM</b><span>воронка · CRM · команда</span></span></div>' +
    '<h1>' + esc(title) + '</h1><p>' + sub + '</p>' + fields + '<button class="btn ok-btn" type="submit">' + esc(btn) + '</button><div class="err" id="authErr"></div>' + (foot || '') + '</form>';
  $('authForm').onsubmit = function(e){
    e.preventDefault(); var f = {}; new FormData(e.target).forEach(function(v, k){ f[k] = String(v).trim(); });
    $('authErr').textContent = '';
    onsubmit(f).catch(function(err){ $('authErr').textContent = err.message || 'Ошибка'; });
  };
}
var F_LOGIN = '<input name="login" placeholder="Логин" autocomplete="username" autofocus><input name="password" type="password" placeholder="Пароль (8+ символов)" autocomplete="current-password">';
function signedIn(j){ TOKEN = j.token; try{ localStorage.setItem('jcrmToken', TOKEN); }catch(e){} history.replaceState(null, '', location.pathname); boot(); }
function showSetup(){
  authBox('Первый вход', 'Создайте главного администратора. Для подтверждения нужен <b>ADMIN_KEY</b> — тот же ключ, что был у старой админки.',
    '<input name="adminKey" type="password" placeholder="ADMIN_KEY"><input name="name" placeholder="Имя (как вас видит команда)">' + F_LOGIN, 'Создать доступ',
    function(f){ return api('setup', f).then(signedIn); });
}
function showLogin(){ authBox('Вход', 'Вход для команды проекта', F_LOGIN, 'Войти', function(f){ return api('login', f).then(signedIn); }); }
function showInvite(token){
  api('invite-info', { token: token }).then(function(j){
    authBox('Здравствуйте, ' + j.name, 'Придумайте логин и пароль — по ним будете входить.', F_LOGIN, 'Создать доступ',
      function(f){ f.token = token; return api('invite-accept', f).then(signedIn); });
  }).catch(function(e){ authBox('Ссылка недействительна', esc(e.message) + '. Попросите новую ссылку у администратора.', '', 'Ко входу', function(){ history.replaceState(null, '', location.pathname); showLogin(); return Promise.resolve(); }); });
}
function logout(silent){
  if(!silent && TOKEN) api('logout', {}).catch(function(){});
  TOKEN = null; ME = null; try{ localStorage.removeItem('jcrmToken'); }catch(e){}
  $('hdr').hidden = true; showLogin();
}

/* ================= shell ================= */
function boot(){
  var inv = /invite=([a-f0-9]+)/.exec(location.hash);
  if(inv){ $('hdr').hidden = true; return showInvite(inv[1]); }
  if(!TOKEN){
    $('hdr').hidden = true;
    return api('auth-state').then(function(j){ j.hasOwner ? showLogin() : showSetup(); }).catch(function(){ main.innerHTML = '<p class="note">Сервер недоступен. Обновите страницу.</p>'; });
  }
  api('me').then(function(j){
    ME = j.me; CFG = j.config;
    document.body.classList.remove('auth');
    $('hdr').hidden = false;
    $('who').textContent = ME.name + (ME.owner ? ' · админ' : '');
    $('tabs').innerHTML = ME.tabs.map(function(t){ return '<button class="tab" data-view="' + t + '">' + TAB_NAMES[t] + '</button>'; }).join('');
    var saved = null; try{ saved = localStorage.getItem('jcrmView'); }catch(e){}
    sw(ME.tabs.indexOf(saved) !== -1 ? saved : ME.tabs[0]);
  }).catch(fail);
}
$('tabs').addEventListener('click', function(e){ var b = e.target.closest('[data-view]'); if(b) sw(b.dataset.view); });
var stopPoll = null;
function sw(v){
  VIEW = v; try{ localStorage.setItem('jcrmView', v); }catch(e){}
  document.querySelectorAll('#tabs .tab').forEach(function(b){ b.classList.toggle('active', b.dataset.view === v); });
  document.body.classList.toggle('crm-wide', v === 'crm' || v === 'tasks');
  if(stopPoll){ stopPoll(); stopPoll = null; }
  ({ funnel:viewFunnel, crm:viewCrm, tasks:viewTasks, content:viewContent, team:viewTeam, settings:viewSettings })[v]();
  $('upd').textContent = 'обновлено ' + new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}

/* ================= funnel ================= */
var FP = { days:7, start:null, end:null };
function viewFunnel(){
  main.innerHTML = '<h2>Воронка <span class="periods" id="fPer">' +
    [[1,'24 часа'],[7,'7 дней'],[30,'30 дней'],[90,'90 дней']].map(function(p){ return '<span class="per" data-d="' + p[0] + '">' + p[1] + '</span>'; }).join('') +
    '<input type="date" id="fFrom"> — <input type="date" id="fTo"> <button class="mnav" id="fGo">OK</button></span></h2>' +
    '<div class="funnel" id="fTiles"></div><div class="convrow" id="fConv"></div>' +
    '<p class="note">Старт — человек нажал «Старт» в боте. Этапы до «Счёт подтверждён» считаются автоматически из бота и приложения. «Депозит» и «Отказ» ставит менеджер в карточке CRM.</p>' +
    '<h2>По каналам</h2><div class="box" style="overflow-x:auto"><table id="fChan"></table></div>' +
    '<h2>По меткам <span class="hint">какая ссылка привела людей</span></h2><div class="box" style="overflow-x:auto"><table id="fSrc"></table>' +
    '<p class="note">Метка — хвост ссылки на бота: t.me/бот?start=<b>ig_reels_7</b>. Начало метки задаёт канал: ig_ — Instagram, th_ — Threads, x_ — X, yt_ — YouTube. Реклама Facebook идёт через лендинг и считается автоматически.</p></div>' +
    '<h2>Расходы на трафик</h2><div class="box"><div class="actions" style="margin:0 0 8px"><input type="date" id="spDate"><select id="spChan">' +
    CFG.channels.filter(function(c){ return c.key !== 'ref' && c.key !== 'direct'; }).map(function(c){ return '<option value="' + c.key + '">' + esc(c.name) + '</option>'; }).join('') +
    '</select><input type="number" id="spAmount" placeholder="сумма, $" style="width:130px"><input type="text" id="spNote" placeholder="комментарий" style="width:220px"><button class="btn ok-btn" id="spAdd">Записать</button></div>' +
    '<div style="overflow-x:auto"><table id="spTable"></table></div><p class="note">Расход за день по каналу. Воронка считает стоимость старта и стоимость подтверждённого счёта.</p></div>';
  $('spDate').value = today();
  $('fPer').addEventListener('click', function(e){ var p = e.target.closest('[data-d]'); if(!p) return; FP = { days:Number(p.dataset.d) }; loadFunnel(); });
  $('fGo').onclick = function(){ if($('fFrom').value && $('fTo').value){ FP = { start:$('fFrom').value, end:$('fTo').value }; loadFunnel(); } };
  $('spAdd').onclick = function(){
    var a = parseFloat($('spAmount').value); if(!(a > 0)) return toast('Введите сумму');
    api('spend', { date:$('spDate').value, channel:$('spChan').value, amount:a, note:$('spNote').value }).then(function(j){ $('spAmount').value = ''; $('spNote').value = ''; drawSpend(j.rows); loadFunnel(); }).catch(fail);
  };
  loadFunnel(); api('spend').then(function(j){ drawSpend(j.rows); }).catch(fail);
}
function delta(c, p){ if(p == null || !p) return c ? '<span class="d up">новое</span>' : '<span class="d">—</span>'; var d = Math.round(100 * (c - p) / p); return '<span class="d ' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '') + d + '% к прошлому</span>'; }
function pct(a, b){ return b ? Math.round(100 * a / b) + '%' : '—'; }
function loadFunnel(){
  document.querySelectorAll('#fPer .per').forEach(function(p){ p.classList.toggle('active', !FP.start && Number(p.dataset.d) === FP.days); });
  var q = FP.start ? 'start=' + FP.start + '&end=' + FP.end : 'days=' + FP.days;
  api('funnel?' + q).then(function(f){
    var t = f.total, pv = f.prev;
    $('fTiles').innerHTML = f.steps.map(function(s, i){
      var prevStep = i ? f.steps[i - 1].n : null;
      return '<div class="fc"><div class="t">' + esc(s.name) + '</div><div class="v">' + num(s.n) + '</div>' + delta(s.n, pv[s.key]) +
        (i ? '<div class="d">' + pct(s.n, prevStep) + ' от прошлого шага</div>' : '<div class="d">' + f.from + ' — ' + f.to + '</div>') + '</div>';
    }).join('');
    $('fConv').innerHTML = [['Старт → анкета', pct(t.onb, t.starts)], ['Анкета → счёт', pct(t.acc, t.onb)], ['Счёт → подтверждён', pct(t.ok, t.acc)], ['Подтверждён → депозит', pct(t.dep, t.ok)],
      ['Депозиты, сумма', money(t.revenue)], ['Расход', money(f.spend)], ['Цена старта', f.spend && t.starts ? money(f.spend / t.starts) : '—'], ['Цена подтверждённого счёта', f.spend && t.ok ? money(f.spend / t.ok) : '—'], ['Отказы', num(t.refused)], ['С квалификацией', num(t.qual)]]
      .map(function(c){ return '<div class="cv"><div class="t">' + c[0] + '</div><div class="v">' + c[1] + '</div></div>'; }).join('');
    var H = '<tr><th>Канал</th><th>Старт</th><th>Подписка</th><th>Анкета</th><th>Счёт</th><th>Подтв.</th><th>Депозит</th><th>Сумма</th><th>Расход</th><th>$ / старт</th><th>$ / подтв.</th></tr>';
    var row = function(c, name){ return '<td>' + name + '</td><td class="mono">' + c.starts + '</td><td class="mono">' + c.sub + '</td><td class="mono">' + c.onb + '</td><td class="mono">' + c.acc + '</td><td class="mono">' + c.ok + '</td><td class="mono">' + c.dep + '</td><td class="mono">' + money(c.revenue) + '</td>'; };
    $('fChan').innerHTML = H + f.channels.map(function(c){ return '<tr>' + row(c, esc(c.name) + (c.paid ? ' <span class="chip c-yellow">платный</span>' : '')) + '<td class="mono">' + (c.spend ? money(c.spend) : '—') + '</td><td class="mono">' + (c.cps != null ? '$' + c.cps : '—') + '</td><td class="mono">' + (c.cpa != null ? money(c.cpa) : '—') + '</td></tr>'; }).join('') +
      '<tr class="sum">' + row(t, 'Итого') + '<td class="mono">' + money(f.spend) + '</td><td></td><td></td></tr>';
    $('fSrc').innerHTML = '<tr><th>Метка</th><th>Канал</th><th>Старт</th><th>Анкета</th><th>Счёт</th><th>Подтв.</th><th>Депозит</th></tr>' +
      (f.bySource.map(function(s){ return '<tr><td class="mono">' + esc(s.source) + '</td><td>' + esc(chanName(s.channel)) + '</td><td class="mono">' + s.starts + '</td><td class="mono">' + s.onb + '</td><td class="mono">' + s.acc + '</td><td class="mono">' + s.ok + '</td><td class="mono">' + s.dep + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="note">Нет данных за период</td></tr>');
  }).catch(fail);
}
function chanName(k){ var c = (CFG.channels || []).filter(function(x){ return x.key === k; })[0]; return c ? c.name : k; }
function drawSpend(rows){
  $('spTable').innerHTML = '<tr><th>Дата</th><th>Канал</th><th>Сумма</th><th>Комментарий</th><th>Кто</th><th></th></tr>' +
    (rows.map(function(r){ return '<tr><td>' + esc(r.date) + '</td><td>' + esc(chanName(r.channel)) + '</td><td class="mono">' + money(r.amount) + '</td><td>' + esc(r.note) + '</td><td>' + esc(r.who) + '</td><td><button class="iconbtn" data-spdel="' + r.id + '">×</button></td></tr>'; }).join('') || '<tr><td colspan="6" class="note">Расходов пока нет</td></tr>');
  $('spTable').onclick = function(e){ var b = e.target.closest('[data-spdel]'); if(b) api('spend', { delete:Number(b.dataset.spdel) }).then(function(j){ drawSpend(j.rows); loadFunnel(); }).catch(fail); };
}

/* ================= CRM ================= */
var LEADS = [], CUR = null, ACT = {}, BOARD = false;
function viewCrm(){
  main.innerHTML = '<h2>Лиды <span id="crmCount" class="hint"></span> <button class="btn ghost" style="margin-left:auto" id="crmCsv">Выгрузить CSV</button></h2>' +
    '<div class="toolbar"><input class="search" id="crmSearch" placeholder="🔍 Имя, ник, id, номер счёта">' +
    '<select id="crmChan"><option value="">Все каналы</option>' + CFG.channels.map(function(c){ return '<option value="' + c.key + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' +
    '<select id="crmStage"><option value="">Все этапы</option>' + CFG.stages.map(function(s){ return '<option>' + esc(s) + '</option>'; }).join('') + '</select>' +
    '<select id="crmSort"><option value="last">Последняя активность</option><option value="first">По дате прихода</option><option value="wait">Кто дольше ждёт</option><option value="task">По сроку задачи</option></select>' +
    '<span class="chiprow" style="width:auto">' + [['wait','Ждут ответа'],['pending','Счёт на проверке'],['task','С задачей'],['over','Просрочено'],['board','Доска этапов']].map(function(f){ return '<span class="fbtn" data-act="' + f[0] + '">' + f[1] + '</span>'; }).join('') + '</span></div>' +
    '<div class="legend" id="qualLegend"></div><div class="board" id="crmBoard" style="display:none"></div>' +
    '<div class="crm" id="crmSplit"><div class="leadlist" id="leadList"></div><div class="cardp" id="leadCard"><p class="note">Выберите лида слева.</p></div></div>';
  ['crmSearch','crmChan','crmStage','crmSort'].forEach(function(id){ $(id).addEventListener(id === 'crmSearch' ? 'input' : 'change', renderCrm); });
  document.querySelector('.toolbar').addEventListener('click', function(e){
    var b = e.target.closest('[data-act]'); if(!b) return;
    if(b.dataset.act === 'board'){ BOARD = !BOARD; } else ACT[b.dataset.act] = !ACT[b.dataset.act];
    renderCrm();
  });
  $('crmCsv').onclick = function(){ download('jason-crm.csv', [['id','name','username','channel','source','stage','amount','gate','broker_id','tier','goal','quals','task','task_due','first_seen','last_seen']].concat(LEADS.map(function(l){ return [l.id, l.name, l.username, l.channel, l.source, l.stage, l.amount, l.gate, l.broker_id, l.tier, l.goal, l.quals.join('; '), l.task, l.task_due, new Date(l.first_seen || 0).toISOString(), new Date(l.last_seen || 0).toISOString()]; }))); };
  $('qualLegend').innerHTML = 'Этапы: ' + CFG.stages.map(function(s){ return '<span class="chip ' + STAGE_COL[s] + '">' + esc(s) + '</span>'; }).join(' ');
  loadCrm();
  var timer = setInterval(function(){ if(!document.hidden) loadCrm(true); }, 15000);
  stopPoll = function(){ clearInterval(timer); };
}
function loadCrm(quiet){
  return api('crm').then(function(j){
    LEADS = j.leads; renderCrm();
    if(CUR && quiet){ var l = LEADS.filter(function(x){ return x.id === CUR; })[0]; if(l && l.unread) openLead(CUR, true); }
  }).catch(fail);
}
function filtered(){
  var q = ($('crmSearch').value || '').toLowerCase(), ch = $('crmChan').value, st = $('crmStage').value, td = today();
  var ls = LEADS.filter(function(l){
    if(q && (l.name + ' ' + l.username + ' ' + l.id + ' ' + (l.broker_id || '') + ' ' + l.source).toLowerCase().indexOf(q) === -1) return false;
    if(ch && l.channel !== ch) return false; if(st && l.stage !== st) return false;
    if(ACT.wait && !l.waiting) return false; if(ACT.pending && l.gate !== 'pending') return false;
    if(ACT.task && !(l.task && !l.task_done)) return false; if(ACT.over && !l.task_overdue) return false;
    return true;
  });
  var s = $('crmSort').value;
  ls.sort(function(a, b){
    if(s === 'first') return (b.first_seen || 0) - (a.first_seen || 0);
    if(s === 'wait') return (b.waiting ? 1 : 0) - (a.waiting ? 1 : 0) || (a.last_at || 0) - (b.last_at || 0);
    if(s === 'task') return (a.task_due || '9999') < (b.task_due || '9999') ? -1 : 1;
    return (b.last_at || 0) - (a.last_at || 0);
  });
  return ls;
}
function renderCrm(){
  if(!$('leadList')) return;
  document.querySelectorAll('[data-act]').forEach(function(b){ b.classList.toggle('active', b.dataset.act === 'board' ? BOARD : !!ACT[b.dataset.act]); });
  var ls = filtered();
  var waiting = LEADS.filter(function(l){ return l.waiting; }).length, pend = LEADS.filter(function(l){ return l.gate === 'pending'; }).length;
  $('crmCount').innerHTML = ls.length + ' из ' + LEADS.length + (waiting ? ' · <span class="chip c-red">ждут ответа: ' + waiting + '</span>' : '') + (pend ? ' <span class="chip c-yellow">счетов на проверке: ' + pend + '</span>' : '');
  $('crmBoard').style.display = BOARD ? 'grid' : 'none'; $('crmSplit').style.display = BOARD ? 'none' : 'grid';
  if(BOARD){
    $('crmBoard').style.gridTemplateColumns = 'repeat(' + CFG.stages.length + ',minmax(150px,1fr))';
    $('crmBoard').innerHTML = CFG.stages.map(function(st){
      var col = ls.filter(function(l){ return l.stage === st; });
      return '<div class="bcol"><h4><span>' + esc(st) + '</span><span>' + col.length + '</span></h4>' + col.slice(0, 200).map(function(l){
        return '<div class="bcard' + (l.waiting ? ' wait' : '') + '" data-lead="' + l.id + '"><div class="bn">' + esc(l.name) + '</div><div class="bs">' + esc(chanName(l.channel)) + (l.amount ? ' · ' + money(l.amount) : '') + (l.task && !l.task_done ? ' · 📌' : '') + '</div></div>';
      }).join('') + '</div>';
    }).join('');
    return;
  }
  $('leadList').innerHTML = ls.slice(0, 500).map(function(l){
    return '<div class="lead' + (l.id === CUR ? ' active' : '') + (l.waiting ? ' wait' : '') + '" data-lead="' + l.id + '"><div class="nm"><span>' + esc(l.name) + (l.username ? ' <span class="hint">@' + esc(l.username) + '</span>' : '') + '</span>' +
      (l.unread ? '<span class="badge">' + l.unread + '</span>' : l.waiting ? '<span class="badge">ждёт ' + ago(l.last_at) + '</span>' : '') + '</div>' +
      '<div class="src"><span class="chip ' + STAGE_COL[l.stage] + '">' + esc(l.stage) + '</span> ' + esc(chanName(l.channel)) + (l.source ? ' · ' + esc(l.source) : '') + '</div>' +
      (l.task && !l.task_done ? '<div class="task">' + (l.task_overdue ? '⚠️ ' : '📌 ') + esc(l.task) + (l.task_due ? ' · ' + esc(l.task_due) : '') + '</div>' : '') +
      (l.last_text ? '<div class="last">' + (l.waiting ? '💬 ' : '↩️ ') + esc(l.last_text) + '</div>' : '') + '</div>';
  }).join('') || '<p class="note" style="padding:12px">Никого не нашлось</p>';
}
main.addEventListener('click', function(e){ var l = e.target.closest('[data-lead]'); if(l && VIEW === 'crm'){ if(BOARD){ BOARD = false; } openLead(Number(l.dataset.lead)); } });
function openLead(id, keepScroll){
  CUR = id; renderCrm();
  var box = $('leadCard'); if(!keepScroll) box.innerHTML = '<p class="note">Загрузка…</p>';
  api('crm-card?id=' + id).then(function(j){ drawCard(j); var l = LEADS.filter(function(x){ return x.id === id; })[0]; if(l){ l.unread = 0; renderCrm(); } }).catch(fail);
}
function drawCard(j){
  var u = j.user, c = j.crm, ob = u.onboard, box = $('leadCard');
  var gate = u.gate || 'none';
  var html = '<div class="between"><div><b style="font-size:16px">' + esc(u.name || '—') + '</b> ' + (u.username ? '<a class="ilink" href="https://t.me/' + esc(u.username) + '" target="_blank">@' + esc(u.username) + '</a>' : '') +
      ' <span class="hint">id ' + u.id + ' · ' + esc((u.lang || '').toUpperCase()) + '</span></div><span class="chip ' + STAGE_COL[j.stage] + '">' + esc(j.stage) + '</span></div>' +
    '<div class="kv"><span><span class="k">Канал</span> ' + esc(chanName(j.channel)) + '</span><span><span class="k">Метка</span> <span class="mono">' + esc(c.src_override || u.src || '—') + '</span> <span class="iconbtn" data-act2="src">✎</span></span>' +
      '<span><span class="k">Пришёл</span> ' + dt(u.first_seen) + '</span><span><span class="k">Был</span> ' + dt(u.last_seen) + '</span><span><span class="k">Открывал академию</span> ' + (u.opens || 0) + '×</span>' +
      (u.ref_by ? '<span><span class="k">Пригласил</span> id ' + u.ref_by + '</span>' : '') + '</div>' +
    /* access: broker account */
    '<div class="sect"><div class="st">Счёт у брокера</div><div class="kv" style="margin:4px 0"><span class="k">Номер</span> <b class="mono">' + esc(u.broker_id || '—') + '</b> <span class="chip ' + ({ pending:'c-yellow', approved:'c-green', rejected:'c-red' }[gate] || 'c-grey') + '">' + RU.gate[gate] + '</span>' + (u.gate_at ? ' <span class="hint">' + dt(u.gate_at) + '</span>' : '') + '</div>' +
      '<div class="actions" style="margin:0">' + (gate !== 'approved' && u.broker_id ? '<button class="btn ok-btn" data-gate="approved">✅ Подтвердить — открыть академию</button>' : '') +
      (gate === 'pending' ? '<button class="btn ghost" data-gate="rejected">❌ Отклонить</button>' : '') +
      (gate === 'approved' ? '<button class="btn rw" data-vip="1">' + (u.vip_at ? '💎 VIP-ссылка выдана — выдать ещё раз' : '💎 Депозит внесён → выдать VIP') + '</button>' : '') +
      (u.vip_joined ? '<span class="chip c-violet">в VIP-канале</span>' : '') + '</div></div>' +
    /* stage */
    '<div class="sect"><div class="st">Этап и депозит</div><div class="actions" style="margin:0">Авто: <span class="chip ' + STAGE_COL[j.auto_stage] + '">' + esc(j.auto_stage) + '</span> Ручной: <select id="cStage"><option value="">авто</option>' +
      CFG.manualStages.map(function(s){ return '<option' + (c.stage === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
      '<input type="number" id="cAmount" placeholder="сумма депозита, $" style="width:170px" value="' + (c.amount || '') + '"><button class="btn ok-btn" id="cStageSave">Сохранить</button></div></div>' +
    /* quals */
    '<div class="quals">' + CFG.quals.map(function(q, i){ return '<span class="ql ' + QUAL_COL[i % QUAL_COL.length] + (c.quals.indexOf(q) !== -1 ? ' on' : '') + '" data-qual="' + esc(q) + '">' + esc(q) + '</span>'; }).join('') + '</div>' +
    /* task */
    '<div class="taskbar"><input type="text" id="cTask" placeholder="Следующее касание: позвонить, напомнить про счёт…" value="' + esc(c.task_done ? '' : c.task_text || '') + '"><input type="date" id="cDue" value="' + esc(c.task_done ? '' : c.task_due || '') + '">' +
      '<button class="btn rw" id="cTaskSave">Поставить</button>' + (c.task_text && !c.task_done ? '<button class="btn ok-btn" id="cTaskDone">Выполнено</button><button class="btn ghost" id="cTaskDel">Снять</button>' : '') + '</div>' +
    /* support chat */
    '<div class="sect"><div class="st">Поддержка в приложении</div><div class="chat" id="cChat">' + (j.support.length ? j.support.map(function(m){
      return '<div class="msg ' + (m.sender === 'manager' ? 'us' : 'them') + '">' + esc(m.text) + '<small>' + (m.sender === 'manager' ? esc(m.by || 'менеджер') + ' · ' : '') + dt(m.at) + '</small></div>'; }).join('') : '<p class="note">Ученик ещё не писал в поддержку. Можно написать первым — сообщение придёт ему в бот и в приложение.</p>') + '</div>' +
      '<div class="actions"><textarea id="cReply" placeholder="Ответ ученику — придёт в бот и в чат приложения (Ctrl+Enter — отправить)"></textarea><button class="btn ok-btn" id="cSend">Отправить</button></div></div>' +
    /* questionnaire + goal */
    '<div class="sect"><div class="st">Анкета и цель</div>' + (ob ? '<div class="kv" style="margin:4px 0"><span><span class="k">Опыт</span> ' + esc(RU.exp[ob.exp] || ob.exp || '—') + '</span><span><span class="k">Торговал</span> ' + esc((ob.markets || []).map(function(x){ return RU.markets[x] || x; }).join(', ') || '—') + '</span><span><span class="k">Мешает</span> ' + esc(RU.problem[ob.problem] || ob.problem || '—') + '</span><span><span class="k">Время</span> ' + esc(RU.time[ob.time] || ob.time || '—') + '</span></div>' : '<p class="note">Анкету ещё не проходил</p>') +
      '<div class="kv" style="margin:4px 0"><span><span class="k">Старт</span> ' + money(u.tier) + '</span><span><span class="k">Цель</span> ' + esc(u.goal_text || '—') + ' · ' + money(u.goal_target) + '</span>' +
      (j.ledger.length ? '<span><span class="k">Счёт (вносит сам)</span> ' + j.ledger.map(function(x){ return x.type[0] + ':' + money(x.amount); }).join(' ') + '</span>' : '') + '</div></div>' +
    /* notes */
    '<div class="sect"><div class="st">Заметки</div>' + c.notes.slice().reverse().map(function(n){ return '<div class="q">' + esc(n.text) + '<div class="hint">' + esc(n.who) + ' · ' + dt(n.at) + '</div></div>'; }).join('') +
      '<div class="actions"><textarea id="cNote" placeholder="Заметка для команды"></textarea><button class="btn rw" id="cNoteSave">Добавить</button></div></div>' +
    (j.ai.length ? '<details class="sect"><summary class="st">Вопросы к Jason AI (' + j.ai.length + ')</summary>' + j.ai.map(function(m){ return '<div class="fbrow"><b>' + esc(m.text) + '</b> <span class="hint">' + esc(m.topic || '') + ' · ' + dt(m.at) + '</span><div class="hint" style="margin-top:4px">' + esc(m.reply || '') + '</div></div>'; }).join('') + '</details>' : '') +
    (j.referrals.length ? '<div class="sect"><div class="st">Пригласил (' + j.referrals.length + ')</div>' + j.referrals.map(function(r){ return '<span class="chip ' + (r.gate === 'approved' ? 'c-green' : 'c-grey') + '" style="margin:2px">' + esc(r.name || r.id) + '</span>'; }).join('') + '</div>' : '') +
    '<details class="sect"><summary class="st">История (' + j.log.length + ')</summary>' + (j.log.map(function(x){ return '<div class="logrow">' + dt(x.at) + ' · <b>' + esc(x.who) + '</b> · ' + esc(x.what) + '</div>'; }).join('') || '<p class="note">пусто</p>') + '</details>';
  box.innerHTML = html;
  var chat = $('cChat'); chat.scrollTop = chat.scrollHeight;
  var id = u.id, upd = function(b, msg){ b.id = id; return api('crm-update', b).then(function(){ if(msg) toast(msg); openLead(id, true); loadCrm(true); }).catch(fail); };
  box.onclick = function(e){
    var g = e.target.closest('[data-gate]');
    if(g){ var st = g.dataset.gate; if(st === 'rejected' && !confirm('Отклонить счёт? Ученик получит сообщение.')) return; g.disabled = true; api('gate', { id:id, status:st }).then(function(){ toast(st === 'approved' ? 'Подтверждено — ученику ушло сообщение' : 'Отклонено'); openLead(id, true); loadCrm(true); }).catch(fail); return; }
    if(e.target.closest('[data-vip]')){ if(!confirm('Отправить ученику ссылку в VIP-канал?')) return; api('vip', { id:id }).then(function(r){ toast(r.ok ? 'VIP-ссылка отправлена' : 'Не получилось: ' + (r.error === 'vip_not_connected' ? 'VIP-канал не подключён' : r.error)); openLead(id, true); }).catch(fail); return; }
    var q = e.target.closest('[data-qual]');
    if(q){ var on = c.quals.slice(), i = on.indexOf(q.dataset.qual); if(i === -1) on.push(q.dataset.qual); else on.splice(i, 1); upd({ quals:on }); return; }
    if(e.target.closest('[data-act2="src"]')){ var s = prompt('Метка источника (пусто — вернуть исходную)', c.src_override || u.src || ''); if(s !== null) upd({ source:s }, 'Метка сохранена'); return; }
    if(e.target.id === 'cStageSave') return upd({ stage:$('cStage').value, amount:parseFloat($('cAmount').value) || 0 }, 'Сохранено');
    if(e.target.id === 'cTaskSave'){ if(!$('cTask').value.trim()) return toast('Опишите задачу'); return upd({ task:$('cTask').value.trim(), due:$('cDue').value }, 'Задача поставлена'); }
    if(e.target.id === 'cTaskDone') return upd({ taskDone:true }, 'Готово');
    if(e.target.id === 'cTaskDel') return upd({ task:null });
    if(e.target.id === 'cNoteSave'){ if(!$('cNote').value.trim()) return; return upd({ note:$('cNote').value.trim() }, 'Заметка добавлена'); }
    if(e.target.id === 'cSend') sendReply(id);
  };
  $('cReply').onkeydown = function(e){ if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply(id); };
}
function sendReply(id){
  var t = $('cReply').value.trim(); if(!t) return;
  $('cSend').disabled = true;
  api('support-reply', { id:id, text:t }).then(function(r){ toast(r.delivered ? 'Отправлено' : 'Сохранено в приложении (в бот не доставлено — ученик мог его заблокировать)'); openLead(id, true); loadCrm(true); })
    .catch(function(e){ $('cSend').disabled = false; fail(e); });
}

/* ================= team kanban ================= */
var KB = null;
function viewTasks(){
  main.innerHTML = '<h2>Задачи команды</h2><div class="kanban" id="kanban"></div><div class="actions" style="margin-top:10px"><button class="btn rw" id="kAdd">+ Задача</button></div><p class="note">Перетаскивайте карточки между колонками. Всё сохраняется сразу.</p>';
  $('kAdd').onclick = function(){ editCard(0, -1); };
  api('tasks').then(function(j){ KB = j; drawKanban(); }).catch(fail);
}
function saveKanban(){ return api('tasks', { columns:KB.columns }).then(function(j){ KB = j; drawKanban(); }).catch(fail); }
function drawKanban(){
  $('kanban').innerHTML = KB.columns.map(function(col, ci){
    return '<div class="col" data-c="' + ci + '" data-col="' + ci + '"><h4>' + esc(col.name) + ' · ' + col.cards.length + '</h4>' + col.cards.map(function(cd, i){
      var over = cd.due && cd.due < today() && ci < KB.columns.length - 1;
      return '<div class="task' + (over ? ' overdue' : '') + '" draggable="true" data-card="' + ci + ':' + i + '">' + esc(cd.text) + '<div class="who">' + esc(cd.who || '—') + (cd.due ? ' · до ' + esc(cd.due) : '') + '</div></div>';
    }).join('') + '</div>';
  }).join('');
  var drag = null;
  $('kanban').ondragstart = function(e){ var c = e.target.closest('[data-card]'); if(c) drag = c.dataset.card.split(':').map(Number); };
  $('kanban').ondragover = function(e){ if(e.target.closest('[data-col]')) e.preventDefault(); };
  $('kanban').ondrop = function(e){ var col = e.target.closest('[data-col]'); if(!col || !drag) return; e.preventDefault(); var to = Number(col.dataset.col); var card = KB.columns[drag[0]].cards.splice(drag[1], 1)[0]; KB.columns[to].cards.push(card); drag = null; saveKanban(); };
  $('kanban').onclick = function(e){ var c = e.target.closest('[data-card]'); if(c){ var p = c.dataset.card.split(':').map(Number); editCard(p[0], p[1]); } };
}
function editCard(ci, i){
  var cd = i >= 0 ? KB.columns[ci].cards[i] : { text:'', who:ME.name, due:'' };
  modal('<h3>' + (i >= 0 ? 'Задача' : 'Новая задача') + '</h3><label>Что сделать</label><textarea id="tText">' + esc(cd.text) + '</textarea><label>Ответственный</label><input id="tWho" value="' + esc(cd.who || '') + '"><label>Срок</label><input type="date" id="tDue" value="' + esc(cd.due || '') + '">' +
    '<label>Колонка</label><select id="tCol" style="width:100%">' + KB.columns.map(function(c, k){ return '<option value="' + k + '"' + (k === ci ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>' +
    '<div class="actions"><button class="btn ok-btn" id="tSave">Сохранить</button>' + (i >= 0 ? '<button class="btn ghost" id="tDel">Удалить</button>' : '') + '<button class="btn ghost" data-mclose>Отмена</button></div>');
  $('tSave').onclick = function(){
    var nc = { text:$('tText').value.trim(), who:$('tWho').value.trim(), due:$('tDue').value }; if(!nc.text) return toast('Опишите задачу');
    if(i >= 0) KB.columns[ci].cards.splice(i, 1);
    KB.columns[Number($('tCol').value)].cards.push(nc); closeModal(); saveKanban();
  };
  if($('tDel')) $('tDel').onclick = function(){ KB.columns[ci].cards.splice(i, 1); closeModal(); saveKanban(); };
}
function modal(html){ $('tboxContent').innerHTML = html; $('tmodal').classList.add('open'); }
function closeModal(){ $('tmodal').classList.remove('open'); }
$('tmodal').addEventListener('click', function(e){ if(e.target.id === 'tmodal' || e.target.closest('[data-mclose]')) closeModal(); });

/* ================= content: lesson videos, question topics, referrals ================= */
var CSUB = 'videos';
function viewContent(){
  main.innerHTML = '<h2>Контент <span class="periods">' + [['videos','Видео в уроках'],['topics','Вопросы → идеи для роликов'],['refs','Рефералы и призы']].map(function(s){ return '<span class="per' + (CSUB === s[0] ? ' active' : '') + '" data-csub="' + s[0] + '">' + s[1] + '</span>'; }).join('') + '</span></h2><div id="cBody"></div>';
  main.querySelector('.periods').onclick = function(e){ var b = e.target.closest('[data-csub]'); if(b){ CSUB = b.dataset.csub; viewContent(); } };
  ({ videos:cVideos, topics:cTopics, refs:cRefs })[CSUB]();
}
function cVideos(){
  api('videos').then(function(j){
    var v = j.videos || {};
    $('cBody').innerHTML = '<div class="box"><p class="note" style="margin:0 0 10px">Вставьте ссылку или ID ролика YouTube. Видео должно быть «доступ по ссылке» (unlisted). Появится у учеников при следующем открытии академии.</p><table>' +
      COURSES.map(function(c){ return '<tr><th colspan="2" style="text-align:left">' + esc(c.name) + '</th></tr>' + c.lessons.map(function(l, i){ var k = c.id + ':' + i; return '<tr><td>' + (i + 1) + '. ' + esc(l.title) + '</td><td style="width:45%"><input data-vk="' + k + '" value="' + esc(v[k] || '') + '" placeholder="youtu.be/…" style="width:100%"></td></tr>'; }).join(''); }).join('') +
      '</table><div class="actions"><button class="btn ok-btn" id="vSave">Сохранить</button><span id="vMsg" class="hint"></span></div></div>';
    $('vSave').onclick = function(){
      var out = {};
      document.querySelectorAll('[data-vk]').forEach(function(inp){ var s = inp.value.trim(); if(!s) return; var m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/); out[inp.dataset.vk] = m ? m[1] : s; });
      api('videos', { videos:out }).then(function(){ $('vMsg').textContent = 'Сохранено: ' + Object.keys(out).length + ' видео'; }).catch(fail);
    };
  }).catch(fail);
}
function cTopics(){
  $('cBody').innerHTML = '<div class="toolbar"><select id="tDays"><option value="7">7 дней</option><option value="30" selected>30 дней</option><option value="90">90 дней</option><option value="3650">всё время</option></select><input class="search" id="tq" placeholder="Поиск по вопросам"><button class="btn ghost" id="tGo">Найти</button><button class="btn ghost" id="tHand">Переданы менеджеру</button><button class="btn ghost" id="tCsv">CSV всех вопросов</button></div><div id="tw"></div>';
  var load = function(){ api('topics?days=' + $('tDays').value).then(function(j){
    var max = j.topics.length ? j.topics[0].n : 1;
    $('tw').innerHTML = '<div class="box"><p class="note" style="margin:0 0 8px">Темы размечает ИИ по каждому вопросу к Jason AI. Чем выше тема, тем больше людей о ней спрашивают — готовые идеи для роликов. Нажмите на тему, чтобы увидеть вопросы.</p><table><tr><th>Тема</th><th>Вопросов</th><th>Людей</th><th>К менеджеру</th><th>Последний</th><th></th></tr>' +
      j.topics.map(function(t){ return '<tr class="click" data-topic="' + esc(t.topic) + '"><td><b>' + esc(t.topic) + '</b></td><td class="mono">' + t.n + '</td><td class="mono">' + t.users + '</td><td class="mono">' + (t.handoffs || 0) + '</td><td>' + dt(t.last) + '</td><td style="width:25%"><div class="bar" style="width:' + Math.round(100 * t.n / max) + '%"></div></td></tr>'; }).join('') + '</table></div>';
  }).catch(fail); };
  $('tDays').onchange = load; load();
  $('tGo').onclick = function(){ msgs('q=' + encodeURIComponent($('tq').value), 'Поиск'); };
  $('tHand').onclick = function(){ msgs('handoff=1', 'Переданы менеджеру'); };
  $('tCsv').onclick = function(){ api('messages').then(function(j){ download('questions.csv', [['date','topic','article','handoff','lang','user','question','answer']].concat(j.messages.map(function(m){ return [new Date(m.at).toISOString(), m.topic, m.article, m.handoff, m.lang, m.username || m.name, m.text, m.reply]; }))); }).catch(fail); };
  $('tw').onclick = function(e){ var r = e.target.closest('[data-topic]'); if(r) msgs('topic=' + encodeURIComponent(r.dataset.topic), 'Тема: ' + r.dataset.topic); };
}
function msgs(qs, title){
  modal('<p class="note">Загрузка…</p>');
  api('messages?' + qs).then(function(j){
    $('tboxContent').innerHTML = '<div class="between"><h3>' + esc(title) + ' (' + j.messages.length + ')</h3><button class="btn ghost" data-mclose>Закрыть</button></div><div style="max-height:70vh;overflow-y:auto">' +
      j.messages.map(function(x){ return '<div class="fbrow open"><b>' + esc(x.text) + '</b><div class="hint">' + dt(x.at) + ' · ' + esc(x.username ? '@' + x.username : x.name || '') + (x.handoff ? ' · к менеджеру' : '') + '</div><div class="fbfull">' + esc(x.reply) + '</div></div>'; }).join('') + '</div>';
  }).catch(fail);
}
function cRefs(){
  Promise.all([api('users'), api('rewards')]).then(function(r){
    var given = {}; r[1].rewards.forEach(function(x){ given[x.user_id + ':' + x.tier] = x.at; });
    var tiers = [1, 3, 5, 10], list = r[0].users.filter(function(u){ return u.invited > 0; }).sort(function(a, b){ return b.invited_ok - a.invited_ok; });
    $('cBody').innerHTML = '<div class="box"><p class="note" style="margin:0 0 8px">Засчитываются друзья с подтверждённым счётом. Отметьте приз, когда выдали его вручную. Тексты призов — в config.js (PRIZES).</p><table><tr><th>Кто пригласил</th><th>Подтв. / пришли</th>' + tiers.map(function(t){ return '<th>' + t + '</th>'; }).join('') + '</tr>' +
      (list.map(function(u){ return '<tr><td><b>' + esc(u.name || '') + '</b> <span class="hint">' + (u.username ? '@' + esc(u.username) : u.id) + '</span></td><td class="mono">' + u.invited_ok + ' / ' + u.invited + '</td>' +
        tiers.map(function(t){ var reached = u.invited_ok >= t, done = given[u.id + ':' + t]; return '<td>' + (!reached ? '<span class="hint">—</span>' : done ? '<button class="btn ghost" data-rw="' + u.id + ':' + t + ':undo">✓ выдан</button>' : '<button class="btn ok-btn" data-rw="' + u.id + ':' + t + '">Выдать</button>') + '</td>'; }).join('') + '</tr>'; }).join('') || '<tr><td colspan="6" class="note">Пока никто никого не пригласил</td></tr>') + '</table></div>';
    $('cBody').onclick = function(e){ var b = e.target.closest('[data-rw]'); if(!b) return; var p = b.dataset.rw.split(':'); api('reward', { id:Number(p[0]), tier:Number(p[1]), undo:p[2] === 'undo' }).then(cRefs).catch(fail); };
  }).catch(fail);
}

/* ================= team (owner) ================= */
var TAB_HELP = { funnel:'Воронка (видят все)', crm:'CRM — лиды, счета, поддержка', tasks:'Задачи команды', content:'Контент — видео, вопросы, рефералы' };
function viewTeam(){
  main.innerHTML = '<h2>Команда и доступы</h2><div class="box" id="teamBox"><p class="note">Загрузка…</p></div>' +
    '<h2>Добавить сотрудника</h2><div class="box"><div class="actions" style="margin:0"><input type="text" id="nName" placeholder="Имя" style="width:200px">' +
    CFG.memberTabs.filter(function(t){ return t !== 'funnel'; }).map(function(t){ return '<label class="cb"><input type="checkbox" value="' + t + '" class="nTab"' + (t === 'crm' ? ' checked' : '') + '> ' + TAB_NAMES[t] + '</label>'; }).join('') +
    '<button class="btn ok-btn" id="nAdd">Создать и получить ссылку</button></div><p class="note">Сотрудник открывает ссылку-приглашение и сам придумывает логин и пароль. «Воронку» видят все. «Команда» и «Настройки» — только главный администратор.</p></div>' +
    '<h2>Мой пароль</h2><div class="box"><div class="actions" style="margin:0"><input type="password" id="myPw" placeholder="Новый пароль (8+ символов)" style="width:240px"><button class="btn rw" id="myPwSave">Сменить</button></div></div>';
  $('nAdd').onclick = function(){
    var name = $('nName').value.trim(); if(!name) return toast('Введите имя');
    var tabs = [].slice.call(document.querySelectorAll('.nTab:checked')).map(function(x){ return x.value; });
    api('staff', { action:'add', name:name, tabs:tabs }).then(function(j){ $('nName').value = ''; drawTeam(j.staff); toast('Создано — скопируйте ссылку и отправьте сотруднику'); }).catch(fail);
  };
  $('myPwSave').onclick = function(){ api('staff', { action:'password', password:$('myPw').value }).then(function(){ $('myPw').value = ''; toast('Пароль изменён'); }).catch(fail); };
  api('staff').then(function(j){ drawTeam(j.staff); }).catch(fail);
}
function drawTeam(list){
  $('teamBox').innerHTML = '<table class="utable"><tr><th style="width:22%">Сотрудник</th><th>Доступ</th><th style="width:30%">Вход</th><th style="width:150px"></th></tr>' + list.map(function(s){
    var owner = s.role === 'owner';
    return '<tr data-sid="' + s.id + '"><td><b>' + esc(s.name) + '</b><div class="hint">' + (owner ? 'главный администратор' : s.login ? 'логин: ' + esc(s.login) : 'ещё не зарегистрировался') + '</div></td>' +
      '<td class="acc">' + (owner ? 'все разделы' : CFG.memberTabs.filter(function(t){ return t !== 'funnel'; }).map(function(t){ return '<label class="cb"><input type="checkbox" class="sTab" value="' + t + '"' + (s.tabs.indexOf(t) !== -1 ? ' checked' : '') + '> ' + TAB_NAMES[t] + '</label>'; }).join(' ') + ' <span class="hint">+ воронка</span>') + '</td>' +
      '<td class="acc">' + (s.invite_link ? '<span class="ilink" data-copy="' + esc(s.invite_link) + '">📋 Скопировать ссылку-приглашение</span>' : 'последний вход: ' + dt(s.last_login)) + '</td>' +
      '<td>' + (owner ? '' : '<button class="iconbtn" data-sact="reinvite" title="Новая ссылка (сбросит пароль)">↻</button><button class="iconbtn" data-sact="remove" title="Удалить доступ">×</button>') + '</td></tr>';
  }).join('') + '</table>';
  $('teamBox').onclick = function(e){
    var cp = e.target.closest('[data-copy]'); if(cp){ navigator.clipboard.writeText(cp.dataset.copy).then(function(){ toast('Ссылка скопирована'); }, function(){ prompt('Скопируйте ссылку', cp.dataset.copy); }); return; }
    var a = e.target.closest('[data-sact]'); if(!a) return;
    var id = Number(a.closest('[data-sid]').dataset.sid);
    if(a.dataset.sact === 'remove' && !confirm('Удалить доступ сотрудника? Он сразу выйдет из CRM.')) return;
    if(a.dataset.sact === 'reinvite' && !confirm('Создать новую ссылку? Старый пароль перестанет работать.')) return;
    api('staff', { action:a.dataset.sact, id:id }).then(function(j){ drawTeam(j.staff); }).catch(fail);
  };
  $('teamBox').onchange = function(e){
    if(!e.target.classList.contains('sTab')) return;
    var row = e.target.closest('[data-sid]'), s = list.filter(function(x){ return x.id === Number(row.dataset.sid); })[0];
    var tabs = [].slice.call(row.querySelectorAll('.sTab:checked')).map(function(x){ return x.value; });
    api('staff', { action:'update', id:s.id, name:s.name, tabs:tabs }).then(function(j){ toast('Доступ обновлён'); drawTeam(j.staff); }).catch(fail);
  };
}

/* ================= settings (owner) ================= */
function viewSettings(){
  api('settings').then(function(s){
    var card = function(ok, title, text){ return '<div class="box" style="margin-bottom:9px"><b>' + (ok ? '✅ ' : '⚠️ ') + title + '</b><p class="note" style="margin-top:4px">' + text + '</p></div>'; };
    main.innerHTML = '<h2>Подключения</h2>' +
      card(s.salesChat, 'Чат менеджеров', s.salesChat ? 'Подключён: туда приходят счета на проверку, обращения в поддержку и призы. Менеджеры могут отвечать реплаем прямо в Telegram — ответ увидят и здесь.' : 'Не подключён. Добавьте бота @' + esc(s.bot || '') + ' в группу менеджеров и отправьте там <b>/setsales</b>. Без этого обращения видны только здесь, в CRM.') +
      card(!!s.club, 'Канал для входа (подписка)', s.club ? '«' + esc(s.club) + '»' : 'Не подключён: сделайте бота админом канала и перешлите ему пост из канала.') +
      card(!!s.vip, 'VIP-канал после депозита', s.vip ? '«' + esc(s.vip) + '»' : 'Не подключён: сделайте бота админом VIP-канала и перешлите ему пост оттуда, выберите «VIP».') +
      card(s.webhook.ok && !s.webhook.lastError, 'Бот', 'Вебхук ' + (s.webhook.ok ? 'установлен' : 'НЕ установлен') + ', в очереди ' + s.webhook.pending + (s.webhook.lastError ? ' · последняя ошибка: ' + esc(s.webhook.lastError) : '') + ' <button class="btn ghost" id="hook">Переустановить</button>') +
      card(s.pixel && s.capi, 'Meta Pixel и Conversions API', 'Пиксель: ' + (s.pixel ? 'есть' : 'нет (PIXEL_ID)') + ' · CAPI: ' + (s.capi ? 'есть' : 'нет (CAPI_TOKEN)') + '. Задаются в Cloudflare → Workers → jason-academy-bot → Settings → Variables.') +
      card(!!s.manager, 'Менеджер для ручной связи', s.manager ? '@' + esc(s.manager) : 'не задан (переменная MANAGER)') +
      (s.salesChat ? '<div class="actions"><button class="btn ghost" id="sr">Отвязать чат менеджеров</button></div>' : '');
    if($('hook')) $('hook').onclick = function(){ api('setup-webhook', {}).then(function(r){ toast(r.ok ? 'Вебхук установлен' : 'Не получилось'); viewSettings(); }).catch(fail); };
    if($('sr')) $('sr').onclick = function(){ if(confirm('Отвязать чат менеджеров?')) api('sales-reset', {}).then(viewSettings).catch(fail); };
  }).catch(fail);
}

boot();
