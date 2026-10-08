/* ============================================================
   Funnel layer: onboarding questionnaire, broker-registration gate,
   goal widget + deposit ledger, referral card, club button,
   chat articles / manager hand-off, lesson videos from the admin panel.
   Talks to the worker; app.js calls the FUNNEL.* hooks.
   ============================================================ */
var FUNNEL = (function(){
  var C = window.CONFIG || {};
  var API = (C.API_BASE || '').replace(/\/+$/, '');
  var me = null, manager = null, serverOk = false;
  var APP = null; // filled by app.js: { T, esc, toast, openExternal, openLesson, showScreen, renderAll, storeGet, storeSet, findCourse, money }
  var T = function(k, v){ return window.T ? window.T(k, v) : k; };

  function gateEnabled(){ return !!(API && C.REF_LINK); }
  function post(path, body){
    body = body || {};
    body.initData = (window.TG && TG.initData) || '';
    body.lang = window.LANG;
    return fetch(API + path, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) }).then(function(r){ return r.json(); });
  }
  function $(id){ return document.getElementById(id); }
  function fmt(n){ return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }

  /* ---------- state from server ---------- */
  function onServer(j){
    if(!j || !j.me) return;
    serverOk = true;
    me = j.me; manager = j.manager || C.MANAGER || null;
    applyVideos(j.videos || {});
    supUnread(me.supportUnread || 0);
    try{ APP.storeSet('funnelMe', me); }catch(e){}
    if(!me.onboarded && API && !onbShown){ openOnboarding(); }
    renderAll();
  }
  function locked(){
    if(!gateEnabled()) return false;
    var m = me || (APP && APP.storeGet('funnelMe', null));
    return !(m && m.gate === 'approved');
  }
  /* Access levels: 0 = no broker account yet (all locked), 1 = base course open, 2 = deposit confirmed (club + full academy).
     Offline (no API) everything is open. */
  function level(){
    if(!API) return 2;
    if(locked()) return 0;
    var m = me || (APP && APP.storeGet('funnelMe', null));
    return m && m.deposit === 'confirmed' ? 2 : 1;
  }
  function access(cid){
    var lv = level(); if(lv === 0) return 'gate';
    var c = APP.findCourse(cid);
    if(c && c.base) return 'ok';
    return lv >= 2 ? 'ok' : 'deposit';
  }
  function applyVideos(v){
    COURSES.forEach(function(c){ c.lessons.forEach(function(l, i){ var id = v[c.id + ':' + i]; if(id) l.video = id; }); });
  }

  /* ---------- goal widget ---------- */
  function balanceOf(ledger){
    var bal = null, dep = 0, wd = 0;
    (ledger || []).forEach(function(e){
      if(e.type === 'balance') bal = e.amount;
      else if(e.type === 'deposit'){ dep += e.amount; if(bal !== null) bal += e.amount; }
      else if(e.type === 'withdrawal'){ wd += e.amount; if(bal !== null) bal -= e.amount; }
    });
    return { balance: bal !== null ? bal : dep - wd, deposits: dep, withdrawals: wd };
  }
  var DEBT_RE = /debt|loan|credit|mortgage|долг|кредит|займ|ипотек|dette|prêt|pret|crédit|credit|schuld|kredit|darlehen/i;
  function goalHtml(){
    var m = me; if(!m || !m.onboarded) return '';
    var b = balanceOf(m.ledger);
    var target = m.goalTarget || 0;
    var pct = target ? Math.max(0, Math.min(100, Math.round(100 * b.balance / target))) : 0;
    var debt = m.goalText && DEBT_RE.test(m.goalText);
    return '<div class="goal-card">' +
      '<div class="goal-top"><div class="goal-txt"><span class="lbl">🎯 ' + T('goalLbl') + '</span>' +
        '<b>' + (m.goalText ? APP.esc(m.goalText) : T('goalNoText')) + '</b>' +
        '<span class="goal-nums">' + fmt(b.balance) + ' / ' + (target ? fmt(target) : '—') + '</span></div>' +
        '<div class="goal-pct">' + pct + '%</div></div>' +
      '<div class="goal-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="goal-foot"><span>' + T('goalStart', { t: m.tier ? fmt(m.tier) : '—' }) + '</span>' +
        '<button class="btn sm" type="button" data-ledger>' + T('goalUpdate') + '</button></div>' +
      (debt ? '<p class="goal-warn">' + T('goalDebtWarn') + '</p>' : '') +
    '</div>';
  }

  /* ---------- ledger sheet ---------- */
  var ledgerType = 'deposit';
  function openLedger(){
    var sheet = $('ledgerSheet'); if(!sheet) return;
    renderLedger(); sheet.hidden = false;
  }
  function renderLedger(){
    var m = me || {}; var b = balanceOf(m.ledger);
    $('ledgerSum').innerHTML = '<div><div class="k">' + T('kBalance') + '</div><div class="v acc">' + fmt(b.balance) + '</div></div>' +
      '<div><div class="k">' + T('kDeposits') + '</div><div class="v">' + fmt(b.deposits) + '</div></div>' +
      '<div><div class="k">' + T('kWithdrawals') + '</div><div class="v">' + fmt(b.withdrawals) + '</div></div>' +
      '<div><div class="k">' + T('kTarget') + '</div><div class="v">' + (m.goalTarget ? fmt(m.goalTarget) : '—') + '</div></div>';
    document.querySelectorAll('#ledgerSeg button').forEach(function(x){ x.setAttribute('aria-pressed', String(x.dataset.type === ledgerType)); });
    var list = (m.ledger || []).slice().reverse();
    $('ledgerList').innerHTML = list.length ? list.map(function(e){
      var d = new Date(e.at);
      return '<div class="led-row"><span class="led-t ' + e.type + '">' + T('lt_' + e.type) + '</span><span class="led-d">' + d.toLocaleDateString() + '</span><b>' + (e.type === 'withdrawal' ? '−' : e.type === 'deposit' ? '+' : '') + fmt(e.amount) + '</b><button class="led-x" type="button" data-del="' + e.id + '" aria-label="delete">×</button></div>';
    }).join('') : '<p class="faint" style="font-size:12px;">' + T('ledgerEmpty') + '</p>';
  }
  function bindLedger(){
    var sheet = $('ledgerSheet'); if(!sheet) return;
    sheet.addEventListener('click', function(ev){
      if(ev.target === sheet || ev.target.closest('[data-close]')){ sheet.hidden = true; return; }
      var seg = ev.target.closest('#ledgerSeg button'); if(seg){ ledgerType = seg.dataset.type; renderLedger(); return; }
      var del = ev.target.closest('[data-del]');
      if(del){ post('/ledger', { deleteId: Number(del.dataset.del) }).then(function(j){ if(j.me){ me = j.me; renderLedger(); renderAll(); } }); return; }
      if(ev.target.closest('#ledgerAdd')){
        var amt = parseFloat(String($('ledgerAmt').value).replace(',', '.'));
        if(!(amt >= 0)){ APP.toast(T('ledgerBad')); return; }
        ev.target.closest('#ledgerAdd').disabled = true;
        post('/ledger', { type: ledgerType, amount: amt }).then(function(j){
          $('ledgerAdd').disabled = false; $('ledgerAmt').value = '';
          if(j.me){ me = j.me; renderLedger(); renderAll(); if(window.TG) TG.haptic('success'); }
        }).catch(function(){ $('ledgerAdd').disabled = false; APP.toast(T('netErr')); });
      }
    });
  }

  /* ---------- referral + club (profile) ---------- */
  function prizeText(tier){
    var p = (C.PRIZES || {})[tier]; if(!p) return '';
    return typeof p === 'string' ? p : (p[window.LANG] || p.en || '');
  }
  function refHtml(){
    var m = me; if(!m || !m.ref || !m.ref.link) return '';
    var n = m.ref.approved || 0;
    var tiers = (m.ref.tiers || [1,3,5,10]);
    var next = tiers.filter(function(t){ return t > n; })[0];
    return '<div class="card stack ref-card"><div class="section-title"><h2>' + T('refTitle') + '</h2><span class="count mono">' + T('refCount', { n: n, i: m.ref.invited || 0 }) + '</span></div>' +
      '<p class="muted">' + T('refText') + '</p>' +
      '<div class="ref-link mono" id="refLinkTxt">' + APP.esc(m.ref.link) + '</div>' +
      '<div class="row" style="gap:8px;"><button class="btn primary" style="flex:1;" type="button" data-ref-share>' + T('refShare') + '</button><button class="btn" type="button" data-ref-copy>' + T('copy') + '</button></div>' +
      '<div class="ref-tiers">' + tiers.map(function(t){
        var on = n >= t, pt = prizeText(t);
        return '<div class="ref-tier' + (on ? ' on' : '') + '"><span class="n">' + t + '</span><span class="d">' + (pt ? APP.esc(pt) : T('refPrizeTbd')) + '</span>' + (on ? '<span class="ok">✓</span>' : '') + '</div>';
      }).join('') + '</div>' +
      (next ? '<p class="faint" style="font-size:11.5px;">' + T('refNext', { k: next - n, t: next }) + '</p>' : '') +
    '</div>';
  }
  function clubBtnHtml(){
    if(!C.CLUB_LINK) return '';
    return '<button class="btn gold block club-btn" type="button" data-ext="' + APP.esc(C.CLUB_LINK) + '">🔒 ' + T('clubOpen') + '</button>';
  }
  function bindProfile(root){
    root.addEventListener('click', function(ev){
      if(ev.target.closest('[data-ref-copy]')){
        var link = me && me.ref && me.ref.link;
        try{ navigator.clipboard.writeText(link).then(function(){ APP.toast(T('copied')); }).catch(function(){ APP.toast(T('selectCopy')); }); }catch(e){ APP.toast(T('selectCopy')); }
      }
      if(ev.target.closest('[data-ref-share]')){
        var l = me && me.ref && me.ref.link; if(!l) return;
        APP.openExternal('https://t.me/share/url?url=' + encodeURIComponent(l) + '&text=' + encodeURIComponent(T('refShareText')));
      }
    });
  }

  /* ---------- proof widget: screenshot (default) or account number — used by the gate and the deposit sheet ---------- */
  function proofHtml(p, mode, img, accVal, pickKey){
    return '<div class="seg dep-seg"><button type="button" data-pmode="' + p + ':shot" aria-pressed="' + (mode === 'shot') + '">📷 ' + T('depShot') + '</button><button type="button" data-pmode="' + p + ':acc" aria-pressed="' + (mode === 'acc') + '">🔢 ' + T('depAcc') + '</button></div>' +
      (mode === 'shot'
        ? (img
          ? '<div class="proof-prev"><img src="' + img + '" alt=""><div><b>✅ ' + T('depShotReady') + '</b><label class="ilink">' + T('proofReplace') + '<input type="file" accept="image/*" id="' + p + 'File" hidden></label></div></div>'
          : '<label class="dep-file"><input type="file" accept="image/*" id="' + p + 'File" hidden><span>📎 ' + T(pickKey, { b: C.BROKER_NAME || 'broker' }) + '</span><small>' + T('proofHint') + '</small></label>')
        : '<input id="' + p + 'Acc" class="g-input" inputmode="numeric" placeholder="' + T('gAccPh') + '" value="' + APP.esc(accVal || '') + '">');
  }

  /* ---------- gate (broker registration) ---------- */
  var gMode = 'shot', gImg = null;
  function gateHtml(){
    var m = me || {}; var st = m.gate || 'none';
    var mgr = '<button class="btn block" type="button" data-support>🆘 ' + T('supportBtn') + '</button>';
    if(st === 'pending') return '<div class="gate-ico">⏳</div><h2>' + T('gPendTitle') + '</h2><p class="muted">' + (m.brokerId ? T('gPendText', { a: APP.esc(m.brokerId) }) : T('gPendShot')) + '</p>' + mgr;
    return '<div class="gate-ico">🔓</div><h2>' + T('gTitle') + '</h2><p class="muted">' + T('gText') + '</p>' +
      (st === 'rejected' ? '<p class="gate-rej">' + T('gRejected') + '</p>' : '') +
      '<div class="g-step"><span class="n">1</span><div><b>' + T('gStep1', { b: APP.esc(C.BROKER_NAME || 'broker') }) + '</b><button class="btn primary block" type="button" data-ext="' + APP.esc(C.REF_LINK || '') + '">' + T('gOpenBroker', { b: APP.esc(C.BROKER_NAME || 'broker') }) + '</button></div></div>' +
      '<div class="g-step"><span class="n">2</span><div><b>' + T('gStep2') + '</b>' + proofHtml('g', gMode, gImg, m.brokerId, 'gShotPick') +
        '<button class="btn primary block" id="gSend" type="button">' + T('depSend') + '</button></div></div>' +
      '<p class="faint" style="font-size:11.5px;">' + T('gNote') + '</p>' + mgr;
  }
  function showGate(){
    var ov = $('funnelGate'); if(!ov) return;
    if(me && !me.onboarded){ openOnboarding(); return; }
    $('funnelGateBox').innerHTML = '<button class="sheet-x" type="button" data-close aria-label="close">×</button>' + gateHtml();
    ov.hidden = false;
  }
  function bindGate(){
    var ov = $('funnelGate'); if(!ov) return;
    ov.addEventListener('click', function(ev){
      if(ev.target === ov || ev.target.closest('[data-close]')){ ov.hidden = true; return; }
      if(ev.target.closest('#gSend')){
        var body = {};
        if(gMode === 'shot'){ if(!gImg){ APP.toast(T('gShotPick', { b: C.BROKER_NAME || 'broker' })); return; } body.image = gImg; }
        else { var v = String(($('gAcc') || {}).value || '').trim(); if(v.replace(/\D/g, '').length < 4){ APP.toast(T('gBadAcc')); return; } body.accountId = v; }
        var b = $('gSend'); b.disabled = true; b.textContent = '…';
        post('/broker', body).then(function(j){
          if(j.me){ me = j.me; gImg = null; if(window.TG) TG.haptic('success'); showGate(); renderAll(); }
          else { b.disabled = false; b.textContent = T('depSend'); APP.toast(T(gMode === 'shot' ? 'depShotBad' : 'gBadAcc')); }
        }).catch(function(){ b.disabled = false; b.textContent = T('depSend'); APP.toast(T('netErr')); });
      }
    });
  }
  /* ---------- deposit → club ---------- */
  var depMode = 'shot', depImg = null;
  function depositHtml(){
    var m = me || {}, st = m.deposit || 'none';
    var help = '<button class="btn block" type="button" data-support>🆘 ' + T('supportBtn') + '</button>';
    if(st === 'confirmed') return '<div class="gate-ico">🎉</div><h2>' + T('depOkTitle') + '</h2><p class="muted">' + T('depOkText') + '</p>';
    if(st === 'pending') return '<div class="gate-ico">⏳</div><h2>' + T('depPendTitle') + '</h2><p class="muted">' + T('depPendText') + '</p>' + help;
    var link = C.REF_LINK || C.BROKER_LINK || '';
    return '<div class="gate-ico">💎</div><h2>' + T('depTitle') + '</h2><p class="muted">' + T('depText') + '</p>' +
      (st === 'rejected' ? '<p class="gate-rej">' + T('depRejected') + '</p>' : '') +
      '<div class="g-step"><span class="n">1</span><div><b>' + T('depStep1') + '</b>' + (link ? '<button class="btn block" type="button" data-ext="' + APP.esc(link) + '">' + T('depOpenBroker', { b: APP.esc(C.BROKER_NAME || 'broker') }) + '</button>' : '') + '</div></div>' +
      '<div class="g-step"><span class="n">2</span><div><b>' + T('depStep2') + '</b>' +
        proofHtml('d', depMode, depImg, m.brokerId, 'depShotPick') +
        '<button class="btn primary block" id="dSend" type="button">' + T('depSend') + '</button></div></div>' +
      '<p class="faint" style="font-size:11.5px;">' + T('depNote') + '</p>' + help;
  }
  function showDeposit(){
    var ov = $('funnelGate'); if(!ov) return;
    if(level() === 0) return showGate();
    $('funnelGateBox').innerHTML = '<button class="sheet-x" type="button" data-close aria-label="close">×</button>' + depositHtml();
    ov.hidden = false;
  }
  function shrinkImage(file){
    return new Promise(function(res, rej){
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        res(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function(){ URL.revokeObjectURL(url); rej(new Error('img')); };
      img.src = url;
    });
  }
  function bindDeposit(){
    var ov = $('funnelGate'); if(!ov) return;
    ov.addEventListener('click', function(ev){
      var md = ev.target.closest('[data-pmode]');
      if(md){ var pm = md.dataset.pmode.split(':'); if(pm[0] === 'g'){ gMode = pm[1]; showGate(); } else { depMode = pm[1]; showDeposit(); } return; }
      if(ev.target.closest('#dSend')){
        var body = {};
        if(depMode === 'shot'){ if(!depImg){ APP.toast(T('depShotPick')); return; } body.image = depImg; }
        else { var v = String(($('dAcc') || {}).value || '').trim(); if(v.replace(/\D/g, '').length < 4){ APP.toast(T('gBadAcc')); return; } body.accountId = v; }
        var b = $('dSend'); b.disabled = true; b.textContent = '…';
        post('/deposit', body).then(function(j){
          if(j.me){ me = j.me; depImg = null; if(window.TG) TG.haptic('success'); showDeposit(); renderAll(); }
          else { b.disabled = false; b.textContent = T('depSend'); APP.toast(T('netErr')); }
        }).catch(function(){ b.disabled = false; b.textContent = T('depSend'); APP.toast(T('netErr')); });
      }
    });
    ov.addEventListener('change', function(ev){
      var id = ev.target.id; if((id !== 'dFile' && id !== 'gFile') || !ev.target.files[0]) return;
      shrinkImage(ev.target.files[0]).then(function(d){ if(id === 'gFile'){ gImg = d; showGate(); } else { depImg = d; showDeposit(); } }).catch(function(){ APP.toast(T('depShotBad')); });
    });
  }

  function lockBannerHtml(){
    if(!serverOk) return '';
    if(!locked() && level() === 1){
      var dp = me && me.deposit === 'pending';
      return '<div class="lock-banner club"><div class="ico">' + (dp ? '⏳' : '💎') + '</div><div class="txt"><b>' + T(dp ? 'depPendTitle' : 'clubBannerTitle') + '</b><span>' + T(dp ? 'depPendSub' : 'clubBannerSub') + '</span></div>' +
        (dp ? '' : '<button class="btn primary sm" type="button" data-show-deposit>' + T('clubBannerBtn') + '</button>') + '</div>';
    }
    if(!locked()) return '';
    var st = (me && me.gate) || 'none';
    return '<div class="lock-banner"><div class="ico">' + (st === 'pending' ? '⏳' : '🔒') + '</div><div class="txt"><b>' + (st === 'pending' ? T('lockPending') : T('lockTitle')) + '</b><span>' + (st === 'pending' ? T('lockPendingSub') : T('lockSub')) + '</span></div>' +
      (st === 'pending' ? '' : '<button class="btn primary sm" type="button" data-show-gate>' + T('lockBtn') + '</button>') + '</div>';
  }

  /* ---------- onboarding ---------- */
  var onbShown = false, step = 0, ans = { markets: [] };
  var STEPS = [
    { key:'welcome' },
    { key:'exp', single:true, opts:['none','demo','lt1','gt1'] },
    { key:'markets', multi:true, opts:['forex','gold','crypto','stocks','none'] },
    { key:'problem', single:true, opts:['knowledge','losses','discipline','time','capital'] },
    { key:'time', single:true, opts:['lt30','h1','h2'] },
    { key:'tier', single:true, opts:['250','1000','10000'] },
    { key:'goal' }
  ];
  var GOAL_CHIPS = ['apartment','car','debts','travel','business','freedom'];
  function openOnboarding(){
    if(!serverOk) return;
    onbShown = true; step = 0;
    var prev = me && me.onboard;
    if(prev){ ans = { exp:prev.exp, markets:prev.markets || [], problem:prev.problem, time:prev.time, tier: me.tier ? String(me.tier) : null, target: me.goalTarget, goalText: me.goalText }; }
    renderOnb(); $('onbOverlay').hidden = false;
  }
  function renderOnb(){
    var s = STEPS[step], box = $('onbBox');
    var dots = '<div class="onb-dots">' + STEPS.map(function(_, i){ return '<i class="' + (i <= step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    var html = dots;
    if(s.key === 'welcome'){
      html += '<div class="onb-hero">📈</div><h2>' + T('onbWelcome') + '</h2><p class="muted">' + T('onbWelcomeSub') + '</p>';
    } else if(s.key === 'goal'){
      html += '<h2>' + T('onbGoalQ') + '</h2><p class="muted">' + T('onbGoalSub') + '</p>' +
        '<div class="onb-chips">' + GOAL_CHIPS.map(function(g){ return '<button type="button" class="chip" data-goalchip="' + g + '">' + T('gc_' + g) + '</button>'; }).join('') + '</div>' +
        '<div class="fld"><label for="onbGoalText">' + T('onbGoalText') + '</label><input id="onbGoalText" maxlength="120" value="' + APP.esc(ans.goalText || '') + '" placeholder="' + T('onbGoalPh') + '"></div>' +
        '<div class="fld"><label for="onbTarget">' + T('onbTarget') + '</label>' +
          '<div class="onb-chips tgt-chips">' + [5000, 10000, 100000, 1000000].map(function(v){ return '<button type="button" class="chip' + (Number(ans.target) === v ? ' sel' : '') + '" data-tgt="' + v + '">' + fmt(v) + '</button>'; }).join('') + '</div>' +
          '<input id="onbTarget" type="number" inputmode="decimal" value="' + (ans.target || '') + '" placeholder="' + T('onbTargetPh') + '"></div>' +
        '<p class="faint" style="font-size:11px;">' + T('onbGoalNote') + '</p>';
    } else {
      html += '<h2>' + T('q_' + s.key) + '</h2>' + (s.multi ? '<p class="muted">' + T('onbMulti') + '</p>' : '') +
        '<div class="onb-opts">' + s.opts.map(function(o){
          var sel = s.multi ? (ans.markets || []).indexOf(o) !== -1 : ans[s.key] === o;
          var label = s.key === 'tier' ? fmt(o) : T('o_' + s.key + '_' + o);
          return '<button type="button" class="onb-opt' + (sel ? ' sel' : '') + '" data-opt="' + o + '">' + label + '</button>';
        }).join('') + '</div>';
    }
    var canNext = s.key === 'welcome' || s.key === 'goal' || (s.multi ? (ans.markets || []).length > 0 : !!ans[s.key]);
    html += '<div class="onb-actions">' + (step > 0 ? '<button type="button" class="btn ghost" data-back>' + T('back') + '</button>' : '<span></span>') +
      '<button type="button" class="btn primary" data-next ' + (canNext ? '' : 'disabled') + '>' + (s.key === 'goal' ? T('onbFinish') : s.key === 'welcome' ? T('onbStart') : T('next')) + '</button></div>';
    box.innerHTML = html;
  }
  function bindOnb(){
    var ov = $('onbOverlay'); if(!ov) return;
    ov.addEventListener('click', function(ev){
      var s = STEPS[step];
      var o = ev.target.closest('[data-opt]');
      if(o){
        var v = o.dataset.opt;
        if(s.multi){
          var arr = ans.markets || [];
          if(v === 'none') arr = arr.indexOf('none') === -1 ? ['none'] : [];
          else { arr = arr.filter(function(x){ return x !== 'none'; }); var i = arr.indexOf(v); if(i === -1) arr.push(v); else arr.splice(i, 1); }
          ans.markets = arr; renderOnb();
        } else { ans[s.key] = v; if(window.TG) TG.haptic('select'); step++; renderOnb(); }
        return;
      }
      var tg = ev.target.closest('[data-tgt]');
      if(tg){ $('onbTarget').value = tg.dataset.tgt; document.querySelectorAll('[data-tgt]').forEach(function(x){ x.classList.toggle('sel', x === tg); }); if(window.TG) TG.haptic('select'); return; }
      if(ev.target.closest('[data-path-go]')){ ov.hidden = true; if(APP.openIntro) APP.openIntro(); else if(locked()) showGate(); return; }
      var gc = ev.target.closest('[data-goalchip]');
      if(gc){ $('onbGoalText').value = T('gc_' + gc.dataset.goalchip); return; }
      if(ev.target.closest('[data-back]')){ if(s.key === 'goal') saveGoalFields(); step = Math.max(0, step - 1); renderOnb(); return; }
      if(ev.target.closest('[data-next]')){
        if(s.key !== 'goal'){ step++; renderOnb(); return; }
        saveGoalFields();
        if(!(ans.target > 0)){ APP.toast(T('onbNeedTarget')); return; }
        var btn = ev.target.closest('[data-next]'); btn.disabled = true;
        post('/onboard', { answers:{ exp:ans.exp, markets:ans.markets, problem:ans.problem, time:ans.time }, tier:Number(ans.tier), target:ans.target, goalText:ans.goalText })
          .then(function(j){
            if(!j.me){ btn.disabled = false; APP.toast(T('netErr')); return; }
            me = j.me; if(window.TG) TG.haptic('success');
            renderAll();
            renderPath();
          }).catch(function(){ btn.disabled = false; APP.toast(T('netErr')); });
      }
    });
  }
  /* "Your path": the goal is the engine — show the road is real when you trade by the rules, without making it a promise */
  function monthsTo(mult, r){ return mult <= 1 ? 0 : Math.ceil(Math.log(mult) / Math.log(1 + r)); }
  function yrs(mo){ return mo < 12 ? T('pathMonths', { n: mo }) : T('pathYears', { n: Math.round(mo / 12 * 10) / 10 }); }
  function renderPath(){
    var start = Number(ans.tier) || 250, target = Number(ans.target) || 10000, mult = target / start;
    var x = mult >= 10 ? Math.round(mult) : Math.round(mult * 10) / 10;
    $('onbBox').innerHTML = '<div class="onb-hero">🎯</div><span class="eyebrow">' + T('pathEyebrow') + '</span>' +
      '<h2>' + T('pathTitle', { t: fmt(target) }) + '</h2>' + (ans.goalText ? '<p class="muted" style="margin-top:-6px">' + APP.esc(ans.goalText) + '</p>' : '') +
      '<div class="path-card"><div class="path-row"><span>' + T('pathStart') + '</span><b>' + fmt(start) + '</b></div>' +
        '<div class="path-row"><span>' + T('pathGoal') + '</span><b>' + fmt(target) + '</b></div>' +
        '<div class="path-row big"><span>' + T('pathMult') + '</span><b>×' + x + '</b></div>' +
        '<div class="path-row"><span>' + T('pathAt', { r: 5 }) + '</span><b>' + yrs(monthsTo(mult, 0.05)) + '</b></div>' +
        '<div class="path-row"><span>' + T('pathAt', { r: 10 }) + '</span><b>' + yrs(monthsTo(mult, 0.10)) + '</b></div></div>' +
      '<p>' + T('pathJason') + '</p><p class="muted">' + T('pathReal') + '</p>' +
      '<div class="onb-actions"><span></span><button type="button" class="btn primary" data-path-go>' + T('pathGo') + '</button></div>' +
      '<p class="faint" style="font-size:10.5px;margin-top:6px">' + T('pathRisk') + '</p>';
  }
  function saveGoalFields(){
    var t = $('onbGoalText'), g = $('onbTarget');
    if(t) ans.goalText = t.value.trim();
    if(g) ans.target = parseFloat(String(g.value).replace(',', '.')) || null;
  }

  /* ---------- chat extras ---------- */
  var ART = { losing_streak:['risk',2], stop_hit:['indicators',2], how_much:['risk',0], margin_call:['basics',2], revenge:['psych',0], overtrading:['psych',1], news:['gold',2], copy:['copy',1] };
  function articleCard(id){
    var a = ART[id]; if(!a) return '';
    var c = APP.findCourse(a[0]);
    return '<div class="art-card"><span class="lbl">' + T('artLbl') + '</span><b>' + T('art_' + id + '_t') + '</b><p>' + T('art_' + id + '_b') + '</p>' +
      (c ? '<button class="btn sm" type="button" data-open-lesson="' + a[0] + ':' + a[1] + '">' + T('artOpen', { l: APP.esc(c.lessons[a[1]].title) }) + '</button>' : '') + '</div>';
  }
  function handoffCard(u){
    return '<div class="art-card mgr"><span class="lbl">' + T('hoLbl') + '</span><b>' + T('hoTitle') + '</b><p>' + T('hoText') + '</p>' +
      '<button class="btn primary sm" type="button" data-support>🆘 ' + T('supportBtn') + '</button></div>';
  }
  function onChat(data){
    var cards = [];
    if(data && data.article) cards.push(articleCard(data.article));
    if(data && data.handoff && data.handoff.username) cards.push(handoffCard(data.handoff.username));
    return cards.filter(Boolean);
  }
  function chipsHtml(){
    return Object.keys(ART).slice(0, 6).map(function(id){ return '<button type="button" class="chip" data-chip="' + id + '">' + T('art_' + id + '_q') + '</button>'; }).join('');
  }

  /* ---------- support chat (student <-> manager) ---------- */
  var supMsgs = [], supTimer = null, supBusy = false;
  function supUnread(n){ var d = $('helpDot'); if(d) d.hidden = !(n > 0); }
  function supRender(){
    var log = $('supLog'); if(!log) return;
    if(!supMsgs.length){ log.innerHTML = '<p class="faint sup-empty">' + T('supportEmpty') + '</p>'; return; }
    log.innerHTML = supMsgs.map(function(m){
      var d = new Date(m.at);
      return '<div class="sup-msg ' + (m.sender === 'manager' ? 'mgr' : 'me') + '">' + (m.sender === 'manager' ? '<span class="who">' + T('supportMgr') + '</span>' : '') +
        '<span class="txt">' + APP.esc(m.text).replace(/\n/g, '<br>') + '</span><span class="tm">' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + '</span></div>';
    }).join('');
    log.scrollTop = log.scrollHeight;
  }
  function supLoad(text){
    if(!API){ APP.toast(T('netErr')); return Promise.resolve(); }
    return post('/support', text ? { text: text } : {}).then(function(j){
      if(j && j.msgs){ supMsgs = j.msgs; supRender(); supUnread(0); }
      if(j && j.error === 'rate') APP.toast(T('supportRate'));
    });
  }
  function openSupport(){
    var sh = $('supportSheet'); if(!sh) return;
    sh.hidden = false; supRender(); supLoad();
    clearInterval(supTimer); supTimer = setInterval(function(){ if(!sh.hidden && !document.hidden) supLoad(); }, 8000);
  }
  function closeSupport(){ var sh = $('supportSheet'); if(sh) sh.hidden = true; clearInterval(supTimer); }
  function supSend(){
    var inp = $('supInput'), v = String(inp.value || '').trim();
    if(!v || supBusy) return;
    supBusy = true; $('supSend').disabled = true;
    supMsgs.push({ sender:'user', text:v, at:Date.now() }); supRender(); inp.value = '';
    supLoad(v).catch(function(){ APP.toast(T('netErr')); }).then(function(){ supBusy = false; $('supSend').disabled = false; });
  }
  function bindSupport(){
    var sh = $('supportSheet'); if(!sh) return;
    sh.addEventListener('click', function(ev){
      if(ev.target === sh || ev.target.closest('[data-close]')){ closeSupport(); return; }
      if(ev.target.closest('#supSend')) supSend();
    });
    $('supInput').addEventListener('keydown', function(ev){ if(ev.key === 'Enter'){ ev.preventDefault(); supSend(); } });
  }

  /* ---------- render ---------- */
  function renderAll(){
    var g = $('goalCardStart'); if(g) g.innerHTML = goalHtml();
    var r = $('refCardProfile'); if(r) r.innerHTML = refHtml();
    var cb = $('clubBtnProfile'); if(cb) cb.innerHTML = clubBtnHtml();
    ['lockBannerStart','lockBannerCourses'].forEach(function(id){ var el = $(id); if(el) el.innerHTML = lockBannerHtml(); });
    var ch = $('chatChips'); if(ch && !ch.dataset.done){ ch.innerHTML = chipsHtml(); ch.dataset.done = '1'; }
    if(APP && APP.onFunnelRender) APP.onFunnelRender();
  }

  function init(app){
    APP = app;
    var cached = APP.storeGet('funnelMe', null); if(cached) me = cached;
    bindLedger(); bindGate(); bindOnb(); bindSupport(); bindDeposit();
    var prof = $('screen-profile'); if(prof) bindProfile(prof);
    document.addEventListener('click', function(ev){
      if(ev.target.closest('[data-ledger]')) openLedger();
      if(ev.target.closest('[data-show-gate]')) showGate();
      if(ev.target.closest('[data-show-deposit]')) showDeposit();
      if(ev.target.closest('[data-support]')){ var g = $('funnelGate'); if(g) g.hidden = true; openSupport(); }
      var ol = ev.target.closest('[data-open-lesson]');
      if(ol){ var p = ol.dataset.openLesson.split(':'); APP.openLesson(p[0], Number(p[1])); }
    });
    renderAll();
  }

  return { init:init, openSupport:openSupport, access:access, level:level, showDeposit:showDeposit, onServer:onServer, locked:locked, showGate:showGate, onChat:onChat, openOnboarding:openOnboarding, articleCard:articleCard, balanceOf:balanceOf, me:function(){ return me; } };
})();
