(function(){
  "use strict";
  var C = window.CONFIG || {};
  var CLUB_LINK = C.CLUB_LINK || '';
  var API = (C.API_BASE || '').replace(/\/+$/, '');

  /* ---------- storage ----------
     localStorage keys are namespaced per Telegram account (see tg.js); CloudStorage
     mirrors them un-prefixed so progress follows the user across devices. */
  var mem = {};
  function lk(k){ return (window.TG && TG.lsKey) ? TG.lsKey(k) : k; }
  function storeGet(k, fb){ try{ var v = localStorage.getItem(lk(k)); return v===null ? fb : JSON.parse(v); } catch(e){ return (k in mem) ? mem[k] : fb; } }
  function storeSet(k, v){
    var s = JSON.stringify(v);
    try{ localStorage.setItem(lk(k), s); } catch(e){ mem[k]=v; }
    if(window.TG && TG.cloudSet) TG.cloudSet(k, s);
  }
  function storeRemove(k){
    try{ localStorage.removeItem(lk(k)); } catch(e){ delete mem[k]; }
    if(window.TG && TG.cloudRemove) TG.cloudRemove(k);
  }
  function storeAllKeys(){
    var pref = (window.TG && TG.lsPrefix) || '';
    var keys = [];
    try{
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(pref){ if(k.indexOf(pref) === 0) keys.push(k.slice(pref.length)); }
        else if(!/^u\d+:/.test(k)) keys.push(k);
      }
    } catch(e){ keys = Object.keys(mem); }
    return keys;
  }

  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg){ toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 1900); }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(ch){ return ch==='&'?'&amp;':ch==='<'?'&lt;':ch==='>'?'&gt;':'&quot;'; }); }
  function s(n, one, many){ return n === 1 ? one : (many || one + 's'); }

  function openExternal(url){
    if(!url) return;
    if(window.TG) TG.haptic('light');
    if(/^https?:\/\/t\.me\//.test(url) && window.TG && TG.openTelegramLink && TG.openTelegramLink(url)) return;
    if(window.TG && TG.openLink && TG.openLink(url)) return;
    window.open(url, '_blank', 'noopener');
  }
  /* any element with data-ext="url" opens natively (Telegram) or in a new tab */
  document.addEventListener('click', function(ev){
    var el = ev.target.closest && ev.target.closest('[data-ext]');
    if(!el) return;
    ev.preventDefault(); ev.stopPropagation();
    openExternal(el.getAttribute('data-ext'));
  });

  /* ---------- screens ---------- */
  var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var titleEl = document.getElementById('screenTitle');
  var eyebrowEl = document.getElementById('screenEyebrow');
  function syncChatHeight(){
    var topbar = document.querySelector('.topbar');
    var tabbar = document.querySelector('.tabbar');
    var content = document.querySelector('.content');
    if(!topbar || !tabbar || !content) return;
    try{
      var cs = getComputedStyle(content);
      var avail = (window.visualViewport ? window.visualViewport.height : window.innerHeight) - topbar.offsetHeight - tabbar.offsetHeight - (parseFloat(cs.paddingTop)||0) - (parseFloat(cs.paddingBottom)||0);
      if(avail > 220){ document.documentElement.style.setProperty('--chat-avail-h', avail + 'px'); }
    }catch(e){}
  }
  window.addEventListener('resize', syncChatHeight);
  window.addEventListener('orientationchange', function(){ setTimeout(syncChatHeight, 60); });

  function showScreen(name){
    closeLesson(); closeQuiz();
    screens.forEach(function(sc){ sc.hidden = (sc.id !== 'screen-' + name); });
    tabs.forEach(function(t){ t.setAttribute('aria-current', String(t.dataset.screen === name)); });
    var active = document.getElementById('screen-' + name);
    if(active){ titleEl.textContent = active.dataset.title; eyebrowEl.textContent = active.dataset.eyebrow; }
    storeSet('activeScreen', name);
    document.querySelector('.content').scrollTop = 0;
    if(name === 'assistant'){ syncChatHeight(); if(chatLog) chatLog.scrollTop = chatLog.scrollHeight; }
  }
  tabs.forEach(function(t){ t.addEventListener('click', function(){ if(window.TG) TG.haptic('select'); showScreen(t.dataset.screen); }); });
  document.querySelectorAll('[data-goto]').forEach(function(b){ b.addEventListener('click', function(){ showScreen(b.dataset.goto); }); });

  /* ---------- progress ---------- */
  function readKey(cid){ return 'read_' + cid; }
  function readArr(cid){ return storeGet(readKey(cid), []); }
  function qzKey(cid){ return 'qz_' + cid; }
  function getAnswers(cid){ return storeGet(qzKey(cid), {}); }
  function setAnswers(cid, obj){ storeSet(qzKey(cid), obj); }

  function findCourse(cid){ return COURSES.filter(function(c){return c.id===cid;})[0]; }
  function coursesInBlock(bid){ return COURSES.filter(function(c){ return c.blockId===bid; }); }
  function flatOrder(){ var arr=[]; BLOCKS.forEach(function(b){ coursesInBlock(b.id).forEach(function(c){ arr.push(c.id); }); }); return arr; }

  function quizDone(c){ return Object.keys(getAnswers(c.id)).length >= c.quiz.length; }
  function quizScore(c){ var ans = getAnswers(c.id); var correct=0, answered=0; c.quiz.forEach(function(q,qi){ if(ans[qi]!==undefined){ answered++; if(ans[qi]===q.correct) correct++; } }); return {answered:answered, correct:correct, total:c.quiz.length}; }
  function courseStatus(c){
    if(quizDone(c)) return 'done';
    if(readArr(c.id).length>0 || Object.keys(getAnswers(c.id)).length>0) return 'progress';
    return 'new';
  }
  function coursePct(c){
    var readShare = c.lessons.length ? readArr(c.id).length/c.lessons.length : 0;
    var quizShare = c.quiz.length ? quizScore(c).answered/c.quiz.length : 0;
    return Math.round(100 * (readShare*0.6 + quizShare*0.4));
  }
  function ctaLabel(c){
    if(courseStatus(c)==='done') return 'Done ↻';
    var read = readArr(c.id).length;
    if(read===0) return 'Start';
    if(read < c.lessons.length) return 'Continue';
    return 'Take quiz';
  }
  function continueCourse(cid){
    var c = findCourse(cid); if(!c) return;
    storeSet('activeCourseId', cid);
    var read = readArr(cid);
    var next = 0; while(read.indexOf(next) !== -1) next++;
    if(next < c.lessons.length){ openLesson(cid, next); } else { openQuiz(cid); }
    renderAll();
  }

  /* ---------- promo cards ---------- */
  var clubSvg = '<path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7l-8-4Z"/>';
  function clubCardHtml(eyebrow, id){
    if(!CLUB_LINK) return '';
    return '<div class="club"' + (id ? ' id="' + id + '" hidden' : '') + '><p class="eyebrow">' + esc(eyebrow || 'Private club') + '</p>' +
      '<h3>' + esc(C.CLUB_TITLE || 'Join the private club') + '</h3><p>' + esc(C.CLUB_TEXT || '') + '</p>' +
      (C.CLUB_PRICE ? '<div class="price">' + esc(C.CLUB_PRICE) + '</div>' : '') +
      '<button class="btn gold block" type="button" data-ext="' + esc(CLUB_LINK) + '">Join the club →</button>' +
      '<p class="faint" style="font-size:10.5px; margin:9px 0 0; line-height:1.4;">Past results don\'t guarantee future returns. Copying trades carries the same risk as placing them yourself.</p></div>';
  }
  function brokerCardHtml(){
    if(!C.BROKER_LINK) return '';
    return '<div class="syntx"><div class="ico"><svg viewBox="0 0 24 24"><path d="M4 19h16M6 16V9M10 16V6M14 16v-5M18 16V8"/></svg></div>' +
      '<div class="txt"><b>Practise on a demo — ' + esc(C.BROKER_NAME || 'broker') + '</b>' + esc(C.BROKER_TEXT || '') +
      '<button class="btn primary" style="margin-top:8px; padding:7px 12px; font-size:12px;" type="button" data-ext="' + esc(C.BROKER_LINK) + '">Open demo account →</button></div></div>';
  }

  /* ---------- banners ---------- */
  function bannerHtml(){
    var activeId = storeGet('activeCourseId', null);
    var c = activeId ? findCourse(activeId) : null;
    if(!c){
      return '<div class="empty-banner"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v14"/><path d="M4 19a2 2 0 0 0 2 2h12M4 19a2 2 0 0 1 2-2h12"/></svg>' +
        '<span class="muted" style="font-size:12.5px;">No course picked yet — start with Trading 101</span><button class="btn primary sm" data-start-first>Start learning</button></div>';
    }
    var pct = coursePct(c), read = readArr(c.id);
    var next = 0; while(read.indexOf(next) !== -1) next++;
    var label = courseStatus(c)==='done' ? 'Course complete · you can retake the quiz' : (next < c.lessons.length ? 'Next: ' + c.lessons[next].title : 'Next: course quiz');
    return '<div class="active-banner"><div class="between"><span class="eyebrow">Current course</span><span class="faint mono" style="font-size:11px;">' + pct + '%</span></div>' +
      '<span class="name">' + c.name + '</span><div class="progress"><i style="width:' + pct + '%"></i></div><span class="next">' + label + '</span>' +
      '<div class="row" style="gap:8px;"><button class="btn primary" data-continue="' + c.id + '" style="flex:1;">' + ctaLabel(c) + '</button><button class="btn ghost sm" data-switch>Switch</button></div></div>';
  }
  function renderBanners(){
    var html = bannerHtml();
    ['startActiveBanner','coursesActiveBanner'].forEach(function(id){
      var el = document.getElementById(id); if(!el) return;
      el.innerHTML = html;
      el.querySelectorAll('[data-continue]').forEach(function(b){ b.addEventListener('click', function(){ continueCourse(b.dataset.continue); }); });
      el.querySelectorAll('[data-switch]').forEach(function(b){ b.addEventListener('click', function(){ storeSet('activeCourseId', null); renderAll(); showScreen('courses'); }); });
      el.querySelectorAll('[data-start-first]').forEach(function(b){ b.addEventListener('click', function(){ continueCourse(flatOrder()[0]); }); });
    });
  }

  /* ---------- courses ---------- */
  var blocksListEl = document.getElementById('blocksList');
  var checkSvg = '<path d="M4 12l5 5L20 6"/>';
  var arrowSvg = '<path d="m9 6 6 6-6 6"/>';
  var quizIconPath = '<path d="M9.1 9a3 3 0 1 1 4.4 2.6c-.8.5-1.5 1-1.5 2.1M12 17h.01"/><circle cx="12" cy="12" r="9.5"/>';
  var ICONS = {
    book:'<path d="M4 19V5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v14"/><path d="M4 19a2 2 0 0 0 2 2h12M4 19a2 2 0 0 1 2-2h12"/>',
    candle:'<path d="M7 3v18M17 3v18"/><rect x="5" y="7" width="4" height="9" rx="1"/><rect x="15" y="9" width="4" height="6" rx="1"/>',
    trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    shield:clubSvg,
    gold:'<path d="M3 18h18l-3-6H6l-3 6Z"/><path d="M7 12l2-5h6l2 5"/>',
    plan:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    brain:'<path d="M9 4a3 3 0 0 0-3 3v0a3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/><path d="M15 4a3 3 0 0 1 3 3v0a3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h0a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    wave:'<path d="M3 12h3l3-7 4 14 3-7h5"/>'
  };

  function renderCourseCard(c){
    var wrap = document.createElement('details');
    wrap.className = 'course'; wrap.id = 'course-' + c.id;
    var pct = coursePct(c);
    wrap.innerHTML =
      '<summary><div class="course-icon"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[c.icon] || ICONS.book) + '</svg></div>' +
      '<div class="course-meta"><div class="name">' + c.name + '</div>' +
      '<span class="faint mono course-sub" style="font-size:11px;">' + c.lessons.length + ' ' + s(c.lessons.length,'lesson') + ' · ' + pct + '%</span>' +
      '<div class="progress sm" style="margin-top:6px;"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="course-actions"><button class="btn primary sm course-cta" type="button">' + ctaLabel(c) + '</button>' +
      '<svg class="chev" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></div></summary>' +
      '<div class="lesson-list"></div>';
    wrap.querySelector('.course-cta').addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); continueCourse(c.id); });
    var list = wrap.querySelector('.lesson-list');
    c.lessons.forEach(function(l, i){
      var row = document.createElement('div'); row.className = 'lesson-row';
      var isRead = readArr(c.id).indexOf(i) !== -1;
      row.innerHTML = '<button class="lesson-check" data-read="' + isRead + '" aria-label="Mark as read"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + checkSvg + '</svg></button>' +
        '<span class="lesson-txt"><span class="n">' + String(i+1).padStart(2,'0') + '</span>' + (l.video ? '<span class="lesson-video-dot" title="Has video"></span>' : '') + l.title + '</span>' +
        '<svg class="lesson-arrow" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + arrowSvg + '</svg>';
      row.querySelector('.lesson-check').addEventListener('click', function(ev){ ev.stopPropagation(); toggleRead(c.id, i); syncCourseCard(c); });
      row.addEventListener('click', function(){ storeSet('activeCourseId', c.id); renderBanners(); openLesson(c.id, i); });
      list.appendChild(row);
    });
    var quizRow = document.createElement('div');
    quizRow.className = 'quiz-row';
    var qs = quizScore(c);
    quizRow.innerHTML = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + quizIconPath + '</svg><span>Course quiz — ' + c.quiz.length + ' questions' + (quizDone(c) ? (' · done ' + qs.correct + '/' + qs.total) : '') + '</span>';
    quizRow.addEventListener('click', function(ev){ ev.stopPropagation(); storeSet('activeCourseId', c.id); openQuiz(c.id); });
    list.appendChild(quizRow);
    if(CLUB_LINK){
      var clubMini = document.createElement('div'); clubMini.className = 'club-mini';
      clubMini.innerHTML = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + clubSvg + '</svg><span>See it applied live — Jason\'s private club</span>';
      clubMini.addEventListener('click', function(ev){ ev.stopPropagation(); openExternal(CLUB_LINK); });
      list.appendChild(clubMini);
    }
    return wrap;
  }

  function toggleRead(cid, idx){
    var arr = readArr(cid); var i = arr.indexOf(idx);
    if(i===-1){ arr.push(idx); } else arr.splice(i,1);
    storeSet(readKey(cid), arr);
    refreshProfile(); renderBanners();
    if(i===-1) progressChanged(true);
  }
  function markRead(cid, idx){
    var arr = readArr(cid);
    if(arr.indexOf(idx)===-1){ arr.push(idx); storeSet(readKey(cid), arr); }
  }
  function syncCourseCard(c){
    var wrap = document.getElementById('course-' + c.id); if(!wrap) return;
    var pct = coursePct(c);
    wrap.querySelector('.course-sub').textContent = c.lessons.length + ' ' + s(c.lessons.length,'lesson') + ' · ' + pct + '%';
    wrap.querySelector('.progress > i').style.width = pct + '%';
    wrap.querySelector('.course-cta').textContent = ctaLabel(c);
    var arr = readArr(c.id);
    wrap.querySelectorAll('.lesson-check').forEach(function(btn, i){ btn.setAttribute('data-read', String(arr.indexOf(i)!==-1)); });
    refreshProfile();
  }

  function renderBlocks(){
    var openIds = Array.prototype.map.call(blocksListEl.querySelectorAll('details[open]'), function(d){ return d.id; });
    blocksListEl.innerHTML = '';
    BLOCKS.forEach(function(b){
      var head = document.createElement('div'); head.className = 'block-head';
      head.innerHTML = '<div class="num">' + b.num + '</div><h2>' + b.name + '</h2><span class="lvl">' + b.level + '</span>';
      blocksListEl.appendChild(head);
      var list = coursesInBlock(b.id);
      list.forEach(function(c){ var card = renderCourseCard(c); if(openIds.indexOf(card.id) !== -1) card.open = true; blocksListEl.appendChild(card); });
      if(b.soon && b.soon.length){
        var soon = document.createElement('div'); soon.className = 'soon-card';
        soon.innerHTML = '<span class="eyebrow">Coming soon</span><div class="soon-list">' + b.soon.map(function(x){ return '<span class="soon-pill">' + x + '</span>'; }).join('') + '</div>';
        blocksListEl.appendChild(soon);
      }
    });
  }

  /* ---------- XP, levels, achievements (all derived from real progress) ---------- */
  var XP_LESSON = 10, XP_CORRECT = 5, XP_COURSE = 50, XP_BLOCK = 150;
  var LEVELS = [
    { min:0,    name:'Rookie' },
    { min:150,  name:'Chart Reader' },
    { min:400,  name:'Risk Manager' },
    { min:800,  name:'Swing Trader' },
    { min:1300, name:'Gold Specialist' },
    { min:1900, name:'Market Pro' },
    { min:2600, name:'Legend' }
  ];
  function blockDone(b){
    var list = coursesInBlock(b.id);
    if(!list.length) return false;
    for(var i=0;i<list.length;i++){ if(!quizDone(list[i])) return false; }
    return true;
  }
  function computeStats(){
    var st = { xp:0, lessons:0, totalLessons:0, correct:0, coursesDone:0, blocksDone:0, perfect:0, totalCourses:COURSES.length, tools:storeGet('toolsUsed', []).length, streakBest:(getStreak()||{}).best||0 };
    COURSES.forEach(function(c){
      var read = readArr(c.id).length;
      st.lessons += read; st.totalLessons += c.lessons.length;
      st.xp += read * XP_LESSON;
      var qz = quizScore(c);
      st.correct += qz.correct; st.xp += qz.correct * XP_CORRECT;
      if(quizDone(c)){ st.coursesDone++; st.xp += XP_COURSE; if(qz.total && qz.correct === qz.total) st.perfect++; }
    });
    BLOCKS.forEach(function(b){ if(blockDone(b)){ st.blocksDone++; st.xp += XP_BLOCK; } });
    return st;
  }
  function levelFor(xp){
    var idx = 0;
    for(var i=0;i<LEVELS.length;i++){ if(xp >= LEVELS[i].min) idx = i; }
    var cur = LEVELS[idx], next = LEVELS[idx+1] || null;
    var pct = next ? Math.round(100 * (xp - cur.min) / (next.min - cur.min)) : 100;
    return { idx:idx, name:cur.name, next:next, pct:Math.max(0, Math.min(100, pct)) };
  }
  function riskCourseDone(){ var c = findCourse('risk'); return !!(c && quizDone(c)); }
  function goldCourseDone(){ var c = findCourse('gold'); return !!(c && quizDone(c)); }
  var ACHIEVEMENTS = [
    { id:'first',   ico:'🌱', name:'First candle',   desc:'Read your first lesson',            test:function(x){ return x.lessons >= 1; } },
    { id:'warm',    ico:'📈', name:'Warming up',     desc:'5 lessons read',                    test:function(x){ return x.lessons >= 5; } },
    { id:'hooked',  ico:'📚', name:'Hooked',         desc:'15 lessons read',                   test:function(x){ return x.lessons >= 15; } },
    { id:'course1', ico:'🎓', name:'First course',   desc:'Finished a whole course',           test:function(x){ return x.coursesDone >= 1; } },
    { id:'risk',    ico:'🛡️', name:'Risk manager',   desc:'Completed Risk First',              test:function(){ return riskCourseDone(); } },
    { id:'gold',    ico:'🥇', name:'Gold bug',       desc:'Completed Trading Gold',            test:function(){ return goldCourseDone(); } },
    { id:'sniper',  ico:'🎯', name:'Sniper entry',   desc:'A course quiz with zero mistakes',  test:function(x){ return x.perfect >= 1; } },
    { id:'nomiss',  ico:'💎', name:'Diamond hands',  desc:'3 perfect course quizzes',          test:function(x){ return x.perfect >= 3; } },
    { id:'tools',   ico:'🧮', name:'Numbers first',  desc:'Used all three trading tools',      test:function(x){ return x.tools >= 3; } },
    { id:'streak7', ico:'🔥', name:'7-day streak',   desc:'Studied 7 days in a row',           test:function(x){ return x.streakBest >= 7; } },
    { id:'block',   ico:'🧩', name:'Block cleared',  desc:'Every course in a block completed', test:function(x){ return x.blocksDone >= 1; } },
    { id:'all',     ico:'👑', name:'Graduate',       desc:'Every course in the academy done',  test:function(x){ return x.totalCourses && x.coursesDone >= x.totalCourses; } }
  ];
  var achPop = document.getElementById('achPop');
  var achPopTimer = null;
  function showAchPop(a){
    document.getElementById('achPopIco').textContent = a.ico;
    document.getElementById('achPopName').textContent = a.name;
    document.getElementById('achPopDesc').textContent = a.desc;
    achPop.classList.add('show');
    if(window.TG) TG.haptic('success');
    clearTimeout(achPopTimer);
    achPopTimer = setTimeout(function(){ achPop.classList.remove('show'); }, 2600);
  }
  function checkAchievements(silent){
    var st = computeStats();
    var seen = storeGet('achUnlocked', []);
    var fresh = [];
    ACHIEVEMENTS.forEach(function(a){ if(a.test(st) && seen.indexOf(a.id) === -1){ seen.push(a.id); fresh.push(a); } });
    if(fresh.length){
      storeSet('achUnlocked', seen);
      if(!silent){ fresh.forEach(function(a, i){ setTimeout(function(){ showAchPop(a); }, i * 2800); }); }
    }
    return st;
  }
  function xpCardHtml(st){
    var lv = levelFor(st.xp);
    var hint = lv.next ? (lv.next.min - st.xp) + ' XP to “' + lv.next.name + '”' : 'Max level reached';
    return '<div class="xp-card"><div class="xp-top"><span class="xp-lvl">' + lv.name + '</span><span class="xp-num">' + st.xp + ' XP</span></div>' +
      '<div class="xp-bar"><i style="width:' + lv.pct + '%"></i></div><div class="xp-hint">' + hint + '</div></div>';
  }
  function renderGamification(st){
    var unlocked = storeGet('achUnlocked', []);
    var cardHtml = xpCardHtml(st);
    ['xpCardStart','xpCardProfile'].forEach(function(id){ var el = document.getElementById(id); if(el) el.innerHTML = cardHtml; });
    var grid = document.getElementById('achGrid');
    if(grid){
      grid.innerHTML = ACHIEVEMENTS.map(function(a){
        var on = unlocked.indexOf(a.id) !== -1;
        return '<div class="ach' + (on ? ' on' : '') + '" title="' + esc(a.desc) + '"><span class="ico">' + a.ico + '</span><span class="nm">' + a.name + '</span></div>';
      }).join('');
    }
    var cnt = document.getElementById('achCount');
    if(cnt) cnt.textContent = unlocked.length + '/' + ACHIEVEMENTS.length;
  }

  /* ---------- profile ---------- */
  function refreshProfile(){
    var totalLessons=0, totalRead=0, totalAns=0, totalCorrect=0;
    COURSES.forEach(function(c){
      totalLessons += c.lessons.length; totalRead += readArr(c.id).length;
      var qz = quizScore(c); totalAns += qz.answered; totalCorrect += qz.correct;
    });
    var sD = document.getElementById('statDone'); if(sD) sD.innerHTML = totalRead + '<span class="faint" style="font-size:13px;">/' + totalLessons + '</span>';
    var pct = totalLessons ? Math.round(100*totalRead/totalLessons) : 0;
    var ring = document.getElementById('profileRing');
    if(ring) ring.setAttribute('stroke-dashoffset', String(194.7 - 194.7*pct/100));
    document.getElementById('profilePct').textContent = pct + '%';
    document.getElementById('profileFrac').textContent = totalRead + ' of ' + totalLessons + ' lessons read';
    var acc = totalAns ? Math.round(100*totalCorrect/totalAns) : null;
    document.getElementById('profileAccuracy').textContent = 'quizzes: ' + (acc===null ? 'no answers yet' : acc + '% (' + totalCorrect + '/' + totalAns + ')');
    document.getElementById('statAccuracy').textContent = acc===null ? '—' : acc + '%';
    var listEl = document.getElementById('profileCourseList');
    listEl.innerHTML = '';
    var activeId = storeGet('activeCourseId', null);
    COURSES.forEach(function(c, i){
      var p = coursePct(c), status = courseStatus(c);
      var statusTxt = status==='new' ? 'not started' : status==='done' ? 'completed' : 'in progress';
      var row = document.createElement('div'); row.className = 'prof-course-row';
      row.innerHTML = '<div class="info"><div class="between"><b>' + c.name + (c.id===activeId ? ' <span class="faint" style="font-weight:500;">· current</span>' : '') + '</b><span class="status-pill ' + status + '">' + statusTxt + '</span></div><div class="progress sm"><i style="width:' + p + '%"></i></div></div>';
      listEl.appendChild(row);
      if(i < COURSES.length-1){ var hr = document.createElement('hr'); hr.className='divider'; listEl.appendChild(hr); }
    });
  }

  function renderAll(){ renderBlocks(); renderBanners(); refreshProfile(); renderGamification(computeStats()); renderStreak(); }

  /* real progress happened → maybe pop achievements, count toward today's goal */
  function progressChanged(studied){
    if(studied) recordStudy();
    var st = checkAchievements(false);
    renderGamification(st);
    if(studied) sendPing({ progressOnly:true, studied:true }); else pingProgress();
  }

  /* ---------- lesson body ----------
     body items: 'paragraph' | {h} | {step,t,d} | {list} | {note} | {warn} | {task} |
     {formula,label} (monospace example, copyable) | {links:[{n,u,d}]} | {table:{head:[],rows:[[]]}} */
  var copyStore = [];
  function linksCardHtml(items){
    return '<div class="lsn-links"><span class="lbl">Links from this lesson</span>' + items.map(function(it){
      return '<div class="lsn-svc"><div class="svc-txt"><b>' + it.n + '</b>' + (it.d ? '<span>' + it.d + '</span>' : '') + '</div>' +
        '<button class="btn sm" type="button" data-ext="' + esc(it.u) + '">Open ↗</button></div>';
    }).join('') + '</div>';
  }
  function tableHtml(t){
    return '<table class="dd-table"><tr>' + t.head.map(function(h){ return '<th>' + h + '</th>'; }).join('') + '</tr>' +
      t.rows.map(function(r){ return '<tr>' + r.map(function(cell){ return '<td>' + cell + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }
  function renderBody(body){
    copyStore = [];
    return body.map(function(p){
      if(typeof p === 'string') return '<p>' + p + '</p>';
      if(p.h) return '<h4 class="lsn-h">' + p.h + '</h4>';
      if(p.step) return '<div class="lsn-step"><div class="n">' + p.step + '</div><div class="c"><b>' + p.t + '</b>' + (p.d ? '<span>' + p.d + '</span>' : '') + '</div></div>';
      if(p.list) return '<ul class="lsn-list">' + p.list.map(function(li){ return '<li>' + li + '</li>'; }).join('') + '</ul>';
      if(p.note) return '<div class="lsn-note">' + p.note + '</div>';
      if(p.warn) return '<div class="lsn-note warn">' + p.warn + '</div>';
      if(p.task) return '<div class="lsn-task"><span class="lbl">Practice</span>' + p.task + '</div>';
      if(p.links) return linksCardHtml(p.links);
      if(p.table) return '<div class="card" style="padding:12px 13px; box-shadow:none;">' + tableHtml(p.table) + '</div>';
      if(p.formula){
        var i = copyStore.push(p.formula) - 1;
        return '<div class="lsn-prompt">' + (p.label ? '<span class="lbl">' + p.label + '</span>' : '') + '<pre>' + esc(p.formula) + '</pre>' +
          (p.copy ? '<button class="btn ghost sm copy-prompt" data-pi="' + i + '" type="button">Copy</button>' : '') + '</div>';
      }
      if(p.tool) return '<button class="btn block" type="button" data-open-tool="' + p.tool + '">' + (p.t || 'Open the calculator') + ' →</button>';
      return '';
    }).join('');
  }
  function bindLessonExtras(root){
    root.querySelectorAll('.copy-prompt').forEach(function(btn){
      btn.addEventListener('click', function(){
        var text = copyStore[Number(btn.dataset.pi)]; if(!text) return;
        try{ navigator.clipboard.writeText(text).then(function(){ toast('Copied'); if(window.TG) TG.haptic('light'); }).catch(function(){ toast('Select the text and copy'); }); }
        catch(e){ toast('Select the text and copy'); }
      });
    });
    root.querySelectorAll('[data-open-tool]').forEach(function(btn){
      btn.addEventListener('click', function(){ showScreen('toolkit'); selectTool(btn.dataset.openTool); });
    });
  }

  function videoBlockHtml(vid){
    if(!vid) return '';
    return '<div class="video-wrap" data-vid="' + esc(vid) + '"><img class="video-thumb" src="https://i.ytimg.com/vi/' + esc(vid) + '/hqdefault.jpg" alt="" loading="lazy">' +
      '<button class="video-play" type="button" aria-label="Watch video"><span class="ico"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg></span><span class="lbl">Watch the video</span></button></div>' +
      '<div class="video-link-row"><a href="#" data-ext="https://youtu.be/' + esc(vid) + '">Open on YouTube ↗</a></div>';
  }
  function bindVideo(root){
    root.querySelectorAll('.video-thumb').forEach(function(img){ img.addEventListener('error', function(){ img.style.display = 'none'; }); });
    root.querySelectorAll('.video-wrap').forEach(function(wrap){
      var btn = wrap.querySelector('.video-play'); if(!btn) return;
      btn.addEventListener('click', function(){
        var vid = wrap.dataset.vid;
        var frame = document.createElement('iframe');
        frame.src = 'https://www.youtube-nocookie.com/embed/' + vid + '?autoplay=1&playsinline=1&rel=0';
        frame.title = 'Lesson video';
        frame.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen');
        frame.setAttribute('allowfullscreen', '');
        wrap.classList.add('playing'); wrap.appendChild(frame);
        var alive = false; frame.addEventListener('load', function(){ alive = true; });
        setTimeout(function(){ if(alive || !wrap.classList.contains('playing')) return; wrap.classList.remove('playing'); frame.remove(); openExternal('https://youtu.be/' + vid); }, 4000);
      });
    });
  }

  /* ---------- lesson overlay ---------- */
  var overlay = document.getElementById('lessonOverlay');
  var lessonScroll = document.getElementById('lessonScroll');
  var lessonKicker = document.getElementById('lessonKicker');
  var lessonTitleTxt = document.getElementById('lessonTitleTxt');
  var finishBtn = document.getElementById('lessonFinishBtn');
  function closeLesson(){ overlay.hidden = true; if(window.TG){ TG.hideBack(); TG.hideMainButton(); } }
  document.getElementById('lessonBack').addEventListener('click', function(){ closeLesson(); renderAll(); });

  function openLesson(cid, idx){
    var c = findCourse(cid); if(!c) return;
    if(idx >= c.lessons.length){ openQuiz(cid); return; }
    quizOverlay.hidden = true;
    var lesson = c.lessons[idx];
    lessonKicker.textContent = c.name + ' · lesson ' + (idx+1) + '/' + c.lessons.length;
    lessonTitleTxt.textContent = lesson.title;
    lessonScroll.innerHTML = videoBlockHtml(lesson.video) + '<h3>' + lesson.title + '</h3>' +
      (lesson.min ? '<span class="faint mono" style="font-size:11px; margin-top:-8px;">' + lesson.min + ' min read</span>' : '') +
      '<div class="body-txt">' + renderBody(lesson.body) + '</div>';
    lessonScroll.scrollTop = 0;
    bindLessonExtras(lessonScroll); bindVideo(lessonScroll);
    var isLast = idx === c.lessons.length - 1;
    finishBtn.textContent = isLast ? 'Done → course quiz' : 'Next lesson →';
    finishBtn.onclick = function(){
      var wasRead = readArr(cid).indexOf(idx) !== -1;
      markRead(cid, idx); syncCourseCard(c); renderBanners(); refreshProfile();
      if(wasRead){ recordStudy(); renderStreak(); sendPing({ progressOnly:true, studied:true }); } else progressChanged(true);
      if(isLast) openQuiz(cid); else openLesson(cid, idx+1);
    };
    if(window.TG){ TG.showBack(function(){ closeLesson(); renderAll(); }); TG.hideMainButton(); }
    overlay.hidden = false;
  }

  /* ---------- quiz overlay ---------- */
  var quizOverlay = document.getElementById('quizOverlay');
  var quizScroll = document.getElementById('quizScroll');
  var quizTitleTxt = document.getElementById('quizTitleTxt');
  var quizFinishBtn = document.getElementById('quizFinishBtn');
  function closeQuiz(){ quizOverlay.hidden = true; if(window.TG){ TG.hideBack(); TG.hideMainButton(); } }
  document.getElementById('quizBack').addEventListener('click', function(){ closeQuiz(); renderAll(); });

  function openQuiz(cid){
    var c = findCourse(cid); if(!c) return;
    overlay.hidden = true;
    quizTitleTxt.textContent = c.name;
    if(window.TG) TG.showBack(function(){ closeQuiz(); renderAll(); });
    var saved = getAnswers(cid);
    var html = '<div class="quiz-head"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + quizIconPath + '</svg><b>' + c.name + ' — ' + c.quiz.length + ' questions</b></div>';
    c.quiz.forEach(function(q, qi){
      html += '<div class="quiz-q" data-qi="' + qi + '"><p class="q-text">' + (qi+1) + '. ' + q.q + '</p><div class="q-opts">' +
        q.opts.map(function(o, oi){ return '<button class="q-opt" data-oi="' + oi + '"><span>' + o + '</span><span class="mark"></span></button>'; }).join('') +
        '</div><p class="q-explain" hidden></p></div>';
    });
    quizScroll.innerHTML = html + clubCardHtml('“' + c.name + '” complete', 'quizClub');
    quizScroll.scrollTop = 0;
    var answered = Object.keys(saved).length, correctN = 0;
    c.quiz.forEach(function(q,qi){ if(saved[qi]===q.correct) correctN++; });
    function paint(qEl, q, chosen){
      qEl.querySelectorAll('.q-opt').forEach(function(o2, oi2){ o2.disabled = true; if(oi2===q.correct) o2.classList.add('correct'); else if(oi2===chosen) o2.classList.add('incorrect'); });
      var exp = qEl.querySelector('.q-explain'); exp.textContent = (chosen===q.correct ? '✓ Correct. ' : '✕ Not quite. ') + q.explain; exp.hidden = false;
    }
    quizScroll.querySelectorAll('.quiz-q').forEach(function(qEl){
      var qi = Number(qEl.dataset.qi), q = c.quiz[qi];
      if(saved[qi] !== undefined) paint(qEl, q, saved[qi]);
      qEl.querySelectorAll('.q-opt').forEach(function(optEl){
        optEl.addEventListener('click', function(){
          if(saved[qi] !== undefined) return;
          var oi = Number(optEl.dataset.oi);
          saved[qi] = oi; setAnswers(cid, saved);
          answered++; if(oi===q.correct) correctN++;
          paint(qEl, q, oi);
          if(window.TG) TG.haptic(oi===q.correct ? 'success' : 'error');
          refreshProfile(); updateQuizFinishState(c, answered, correctN); progressChanged(false);
        });
      });
    });
    updateQuizFinishState(c, answered, correctN);
    quizOverlay.hidden = false;
  }
  function updateQuizFinishState(c, answered, correct){
    if(answered >= c.quiz.length){
      quizFinishBtn.disabled = false;
      quizFinishBtn.textContent = 'Quiz done (' + correct + '/' + c.quiz.length + ') · continue';
      quizFinishBtn.onclick = function(){ finishQuiz(c, correct); };
    } else {
      quizFinishBtn.disabled = true;
      quizFinishBtn.textContent = 'Answer all questions (' + answered + '/' + c.quiz.length + ')';
      quizFinishBtn.onclick = null;
    }
  }
  function finishQuiz(c, correct){
    toast('Quiz complete · ' + correct + '/' + c.quiz.length + ' correct');
    if(window.TG) TG.haptic('success');
    var clubBlock = document.getElementById('quizClub');
    if(clubBlock){ clubBlock.hidden = false; clubBlock.scrollIntoView({behavior:'smooth', block:'start'}); }
    var order = flatOrder(), nextId = order[order.indexOf(c.id)+1];
    quizFinishBtn.textContent = nextId ? 'Next course →' : 'Back to courses';
    quizFinishBtn.onclick = nextId
      ? function(){ closeQuiz(); showScreen('courses'); continueCourse(nextId); }
      : function(){ closeQuiz(); renderAll(); showScreen('courses'); };
    renderAll();
  }

  /* ---------- tools ---------- */
  function num(id){ var v = parseFloat(String(document.getElementById(id).value).replace(',', '.')); return isFinite(v) ? v : NaN; }
  function money(v){ return '$' + (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)); }
  function markToolUsed(t){
    var used = storeGet('toolsUsed', []);
    if(used.indexOf(t) === -1){ used.push(t); storeSet('toolsUsed', used); var st = checkAchievements(false); renderGamification(st); }
  }
  var toolTouched = {};
  function selectTool(t){
    document.querySelectorAll('#toolSeg button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
    ['size','dd','comp'].forEach(function(x){ document.getElementById('tool-' + x).hidden = x !== t; });
    storeSet('activeTool', t);
  }
  document.querySelectorAll('#toolSeg button').forEach(function(b){ b.addEventListener('click', function(){ if(window.TG) TG.haptic('select'); selectTool(b.dataset.tool); }); });

  var INSTR = {
    xau:{ entry:4000, stop:3992, tp:4016, dec:2 },
    fx:{ entry:1.1000, stop:1.0980, tp:1.1040, dec:5 },
    jpy:{ entry:150.00, stop:149.70, tp:150.60, dec:3 }
  };
  document.getElementById('cInstr').addEventListener('change', function(){
    var d = INSTR[this.value];
    document.getElementById('cEntry').value = d.entry; document.getElementById('cStop').value = d.stop; document.getElementById('cTp').value = d.tp;
    calcSize(true);
  });
  function calcSize(user){
    var instr = document.getElementById('cInstr').value;
    var bal = num('cBal'), risk = num('cRisk'), entry = num('cEntry'), stop = num('cStop'), tp = num('cTp');
    var out = document.getElementById('sizeOut'), msg = document.getElementById('sizeMsg');
    msg.className = 'calc-msg';
    if(!(bal > 0) || !(risk > 0) || !(entry > 0) || !(stop > 0) || entry === stop){
      out.innerHTML = ''; msg.textContent = 'Fill in balance, risk, entry and a stop that differs from entry.'; return;
    }
    var dist = Math.abs(entry - stop);
    var perLot; // $ lost per 1.00 lot if stop is hit
    if(instr === 'xau') perLot = dist * 100;
    else if(instr === 'fx') perLot = dist * 100000;
    else perLot = dist * 100000 / entry;
    var riskUsd = bal * risk / 100;
    var lots = riskUsd / perLot;
    var lotsR = Math.floor(lots * 100) / 100;
    var realRisk = lotsR * perLot;
    var distTxt = instr === 'xau' ? '$' + dist.toFixed(2) : (dist / (instr === 'jpy' ? 0.01 : 0.0001)).toFixed(1) + ' pips';
    var rr = null, reward = null, dir = entry > stop ? 1 : -1;
    if(tp > 0 && (tp - entry) * dir > 0){ rr = Math.abs(tp - entry) / dist; reward = lotsR * perLot * rr; }
    out.innerHTML =
      '<div><div class="k">Lot size</div><div class="v acc">' + (lotsR >= 0.01 ? lotsR.toFixed(2) : '< 0.01') + '</div></div>' +
      '<div><div class="k">Money at risk</div><div class="v bad">' + money(lotsR >= 0.01 ? realRisk : riskUsd) + '</div></div>' +
      '<div><div class="k">Stop distance</div><div class="v">' + distTxt + '</div></div>' +
      '<div><div class="k">Reward : risk</div><div class="v ' + (rr ? (rr >= 2 ? 'ok' : rr >= 1 ? '' : 'bad') : '') + '">' + (rr ? '1 : ' + rr.toFixed(1) : '—') + '</div></div>';
    var parts = [ (dir > 0 ? 'Long (buy)' : 'Short (sell)') + ' setup.' ];
    if(lotsR < 0.01){ msg.className = 'calc-msg bad'; parts.push('Even 0.01 lots risks ' + money(perLot*0.01) + ' here — more than your ' + risk + '%. Widen your account, tighten the stop logically, or skip the trade.'); }
    else {
      if(reward) parts.push('If the target hits: +' + money(reward) + '.');
      if(risk > 2){ msg.className = 'calc-msg bad'; parts.push('Risking more than 2% per trade makes a normal losing streak very painful — see Risk First.'); }
      else if(rr && rr < 1) parts.push('Reward is smaller than risk — you need a very high win rate for this to pay.');
    }
    msg.textContent = parts.join(' ');
    if(user) markToolUsed('size');
  }
  ['cBal','cRisk','cEntry','cStop','cTp'].forEach(function(id){ document.getElementById(id).addEventListener('input', function(){ calcSize(true); }); });

  function calcDD(user){
    var loss = num('dLoss'), bal = num('dBal');
    var out = document.getElementById('ddOut');
    if(!(loss > 0 && loss < 100) || !(bal > 0)){ out.innerHTML = '<div class="calc-msg" style="grid-column:1/-1;">Enter a loss between 0 and 100%.</div>'; }
    else {
      var need = 100 * loss / (100 - loss);
      out.innerHTML = '<div><div class="k">Balance after</div><div class="v bad">' + money(bal * (1 - loss/100)) + '</div></div>' +
        '<div><div class="k">Gain needed to recover</div><div class="v acc">+' + need.toFixed(1) + '%</div></div>';
    }
    var rows = [5,10,20,30,40,50,75];
    document.getElementById('ddTable').innerHTML = '<tr><th>Loss</th><th>Needed to get back</th></tr>' + rows.map(function(l){
      var n = 100 * l / (100 - l);
      return '<tr><td>−' + l + '%</td><td>+' + (n % 1 ? n.toFixed(1) : n) + '%<div class="dd-bar" style="width:' + Math.min(100, n/3) + '%; margin-left:auto;"></div></td></tr>';
    }).join('');
    if(user) markToolUsed('dd');
  }
  ['dLoss','dBal'].forEach(function(id){ document.getElementById(id).addEventListener('input', function(){ calcDD(true); }); });

  function calcComp(user){
    var a = num('gStart'), b = num('gTarget'), r = num('gRate');
    var out = document.getElementById('compOut'), msg = document.getElementById('compMsg');
    if(!(a > 0) || !(b > a) || !(r > 0)){ out.innerHTML = ''; msg.textContent = 'Target must be larger than start, return above 0.'; return; }
    var months = Math.log(b / a) / Math.log(1 + r/100);
    var yearly = (Math.pow(1 + r/100, 12) - 1) * 100;
    out.innerHTML = '<div><div class="k">Time needed</div><div class="v acc">' + (months < 24 ? Math.ceil(months) + ' mo' : (months/12).toFixed(1) + ' yrs') + '</div></div>' +
      '<div><div class="k">Same as yearly</div><div class="v">' + (yearly > 10000 ? '>10,000%' : '+' + Math.round(yearly).toLocaleString('en-US') + '%') + '</div></div>';
    msg.textContent = 'That assumes ' + r + '% every single month with zero losing months. For context, top professional funds are happy with 15–25% a year. The math is why risk control matters more than any single trade.';
    if(user) markToolUsed('comp');
  }
  ['gStart','gTarget','gRate'].forEach(function(id){ document.getElementById(id).addEventListener('input', function(){ calcComp(true); }); });

  /* ---------- daily tip ---------- */
  function renderTip(){
    var el = document.getElementById('dailyTip'); if(!el || !window.TIPS || !TIPS.length) return;
    var d = new Date(); var dayN = Math.floor((d - new Date(d.getFullYear(),0,0)) / 864e5);
    var t = TIPS[dayN % TIPS.length];
    el.innerHTML = '<div class="tip-card"><div class="ico">' + t.ico + '</div><div class="txt"><span class="lbl">Rule of the day</span><b>' + t.t + '</b><span>' + t.d + '</span></div></div>';
  }

  /* ---------- daily streak (local, synced via CloudStorage) ----------
     Goal: read one lesson a day. A freeze is earned every 7 days (max 2) and
     silently covers one missed day. */
  function dayStr(d){ d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function daysBetween(a, b){ var pa = a.split('-'), pb = b.split('-'); return Math.round((new Date(pb[0],pb[1]-1,pb[2]) - new Date(pa[0],pa[1]-1,pa[2])) / 864e5); }
  function getStreak(){ return storeGet('streak', null); }
  function effectiveStreak(){
    var s0 = getStreak(); if(!s0 || !s0.last) return { n:0, best:(s0&&s0.best)||0, freezes:(s0&&s0.freezes)||0, done:false };
    var gap = daysBetween(s0.last, dayStr());
    var alive = gap <= 1 || (gap - 1 <= (s0.freezes || 0));
    return { n: alive ? s0.streak : 0, best: s0.best || 0, freezes: s0.freezes || 0, done: gap === 0 };
  }
  function recordStudy(){
    var today = dayStr();
    var s0 = getStreak() || { streak:0, best:0, freezes:0, last:null };
    if(s0.last === today) return;
    var gap = s0.last ? daysBetween(s0.last, today) : 99;
    if(gap === 1) s0.streak += 1;
    else if(gap > 1 && gap - 1 <= (s0.freezes||0)){ s0.freezes -= (gap - 1); s0.streak += 1; }
    else s0.streak = 1;
    if(s0.streak % 7 === 0 && s0.freezes < 2) s0.freezes += 1;
    s0.best = Math.max(s0.best || 0, s0.streak);
    s0.last = today;
    storeSet('streak', s0);
    renderStreak();
  }
  function renderStreak(){
    var el = document.getElementById('streakCard'); if(!el) return;
    var st = effectiveStreak(), n = st.n;
    el.innerHTML = '<div class="streak-card' + (st.done ? ' done' : '') + '"><div class="st-flame">' + (n ? '🔥' : '🌱') + '</div>' +
      '<div class="st-txt"><b>' + (n ? n + '-day streak' : 'Start your streak today') + '</b><span>' + (st.done ? 'Today\'s goal done — see you tomorrow' : 'Today\'s goal: read one lesson') + '</span></div>' +
      '<div class="st-goal" aria-label="' + (st.done ? 'goal done' : 'goal not done') + '">' + (st.done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>' : '') + '</div></div>' +
      ((st.best > 1 || st.freezes) ? '<p class="faint mono" style="font-size:10.5px; text-align:center; margin-top:6px;">best: ' + st.best + ' ' + s(st.best,'day') + (st.freezes ? ' · streak freezes: ' + st.freezes : '') + '</p>' : '');
  }

  /* ---------- backend: subscription lock + activity pings ---------- */
  var channelLink = C.CHANNEL_LINK || CLUB_LINK;
  function applyAccess(j){
    var ov = document.getElementById('gateOverlay');
    if(j.channel){ channelLink = /^https?:/.test(j.channel) ? j.channel : 'https://t.me/' + String(j.channel).replace(/^@/, ''); }
    ov.hidden = j.access !== false;
  }
  function bindGate(){
    var reBtn = document.getElementById('gateRecheck'), hint = document.getElementById('gateHint');
    document.getElementById('gateOpenChannel').addEventListener('click', function(){ openExternal(channelLink); });
    reBtn.addEventListener('click', function(){
      reBtn.disabled = true; hint.textContent = 'Checking…';
      sendPing({ progressOnly:true, recheck:true });
      setTimeout(function(){
        reBtn.disabled = false;
        hint.textContent = document.getElementById('gateOverlay').hidden ? '' : 'Can\'t see your subscription yet. If you just joined, wait a few seconds and tap again.';
      }, 2500);
    });
  }
  function progressSnapshot(){ try{ var st = computeStats(); return { lessons:st.lessons, totalLessons:st.totalLessons, coursesDone:st.coursesDone, xp:st.xp, streak:effectiveStreak().n }; }catch(e){ return null; } }
  function sendPing(opts){
    if(!API || !window.TG || !TG.user || !TG.user.id) return;
    try{
      var payload = { id:TG.user.id, name:TG.user.displayName || TG.user.username || null, initData:TG.initData || '', progress:progressSnapshot(), tz:-new Date().getTimezoneOffset()/60 };
      if(opts){ ['progressOnly','studied','recheck'].forEach(function(k){ if(opts[k]) payload[k] = true; }); }
      fetch(API + '/open', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(payload) })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(j){ if(j && typeof j.access === 'boolean') applyAccess(j); })
        .catch(function(){});
    }catch(e){}
  }
  function pingOpen(){
    if(!window.TG || !TG.user) return;
    var mark = 'pinged_' + TG.user.id, already = false;
    try{ already = !!sessionStorage.getItem(mark); if(!already) sessionStorage.setItem(mark, '1'); }catch(e){}
    sendPing(already ? { progressOnly:true } : undefined);
  }
  var progressTimer = null;
  function pingProgress(){ clearTimeout(progressTimer); progressTimer = setTimeout(function(){ sendPing({ progressOnly:true }); }, 8000); }

  /* ---------- Jason AI chat ---------- */
  var chatHistory = [];
  var chatLog = document.getElementById('chatLog');
  var chatInput = document.getElementById('chatInput');
  var chatSend = document.getElementById('chatSend');
  var chatBusy = false;
  function renderChatLog(){
    chatLog.innerHTML = chatHistory.map(function(m){ return '<div class="chat-msg ' + (m.role==='user'?'user':'bot') + '">' + esc(m.content) + '</div>'; }).join('');
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  function sendChatMessage(){
    if(chatBusy) return;
    var text = chatInput.value.trim(); if(!text) return;
    chatInput.value = '';
    chatHistory.push({ role:'user', content:text }); renderChatLog();
    if(!API){
      chatHistory.push({ role:'assistant', content:'Jason AI is being switched on — for now, check the Courses tab or the lesson glossary. I\'ll be here soon.' });
      renderChatLog(); return;
    }
    chatBusy = true;
    var typingEl = document.createElement('div'); typingEl.className = 'chat-msg bot typing'; typingEl.textContent = 'typing…';
    chatLog.appendChild(typingEl); chatLog.scrollTop = chatLog.scrollHeight;
    fetch(API + '/chat', { method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ message:text, history:chatHistory.slice(-9, -1), id:(window.TG && TG.user && TG.user.id) || null, initData:(window.TG && TG.initData) || '', name:(window.TG && TG.user && TG.user.displayName) || null })
    }).then(function(r){ return r.json(); }).then(function(data){
      chatBusy = false;
      chatHistory.push({ role:'assistant', content:(data && data.reply) ? data.reply : 'Couldn\'t answer that one — try again.' }); renderChatLog();
    }).catch(function(){
      chatBusy = false;
      chatHistory.push({ role:'assistant', content:'Jason AI is offline right now — try again in a bit.' }); renderChatLog();
    });
  }
  chatSend.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); sendChatMessage(); } });
  function seedChat(){
    var name = (window.TG && TG.user && TG.user.displayName) || '';
    chatHistory = [{ role:'assistant', content:'Hey' + (name ? ' ' + name : '') + ' 👋 Ask me anything from the lessons — what a pip is, how to size a gold trade, why a stop goes where it goes. I explain; I don\'t give signals.' }];
    renderChatLog();
  }

  /* ---------- reset ---------- */
  var resetBtn = document.getElementById('resetBtn');
  var resetArmed = false, resetTimer;
  resetBtn.addEventListener('click', function(){
    if(!resetArmed){ resetArmed = true; resetBtn.textContent = 'Sure? Tap again to reset'; clearTimeout(resetTimer);
      resetTimer = setTimeout(function(){ resetArmed = false; resetBtn.textContent = 'Reset all progress'; }, 2600); return; }
    storeAllKeys().forEach(function(k){ if(k && (k.indexOf('read_')===0 || k.indexOf('qz_')===0 || k === 'activeCourseId' || k === 'achUnlocked' || k === 'toolsUsed')) storeRemove(k); });
    resetArmed = false; resetBtn.textContent = 'Reset all progress';
    renderAll(); toast('Progress reset');
  });

  function applyUserName(){
    var name = (window.TG && TG.user && TG.user.displayName) ? TG.user.displayName : null;
    document.getElementById('heroGreeting').textContent = name ? ('Hey, ' + name + ' 👋') : 'Hey 👋';
    document.getElementById('profileName').textContent = name || 'Profile';
  }

  /* ---------- self-update: Telegram caches the page hard ---------- */
  var BUILD = '202609282108';
  function checkForUpdate(){
    try{
      fetch('version.json?t=' + Date.now(), { cache:'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
        if(!j || !j.v || j.v === BUILD) return;
        var mark = 'reloadedFor_' + j.v;
        try{ if(sessionStorage.getItem(mark)) return; sessionStorage.setItem(mark, '1'); }catch(e){}
        location.reload();
      }).catch(function(){});
    }catch(e){}
  }

  /* ---------- deterministic shuffle of quiz options (data has the right answer first) ---------- */
  function seedFrom(str){ var h = 2166136261; for(var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }
  function shuffleQuizzes(){
    COURSES.forEach(function(c){
      (c.quiz || []).forEach(function(q, qi){
        if(!q || !q.opts || q.opts.length < 2 || q._mixed) return;
        var seed = seedFrom(c.id + '#' + qi + '#' + (q.q || ''));
        var idx = q.opts.map(function(_, i){ return i; });
        for(var i = idx.length - 1; i > 0; i--){
          seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0;
          var j = seed % (i + 1); var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
        }
        var correctOld = (typeof q.correct === 'number') ? q.correct : 0;
        q.opts = idx.map(function(i){ return q.opts[i]; });
        q.correct = idx.indexOf(correctOld);
        q._mixed = true;
      });
    });
  }

  function boot(){
    checkForUpdate();
    shuffleQuizzes();
    var totalLessons = 0; COURSES.forEach(function(c){ totalLessons += c.lessons.length; });
    document.getElementById('buildInfo').textContent = 'build ' + BUILD + ' · ' + COURSES.length + ' courses · ' + totalLessons + ' lessons';
    applyUserName();
    ['clubCardProfile'].forEach(function(id){ document.getElementById(id).innerHTML = clubCardHtml('Private club'); });
    document.getElementById('brokerCardStart').innerHTML = brokerCardHtml();
    renderTip();
    calcSize(false); calcDD(false); calcComp(false);
    selectTool(storeGet('activeTool', 'size'));
    checkAchievements(true);
    bindGate();
    seedChat();
    renderAll();
    showScreen(storeGet('activeScreen', 'start'));
    pingOpen();
  }
  if(window.TG && TG.cloudSync){ TG.cloudSync(boot); } else { boot(); }
})();
