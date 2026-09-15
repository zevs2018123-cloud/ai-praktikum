(function(){
  "use strict";
  var SYNTX_LINK = "https://t.me/syntxaibot?start=aff_7800944895";
  var CLUB_LINK = "https://t.me/Desanji";

  var mem = {};
  function storeGet(k, fb){ try{ var v = localStorage.getItem(k); return v===null ? fb : JSON.parse(v); } catch(e){ return (k in mem) ? mem[k] : fb; } }
  function storeSet(k, v){
    var s = JSON.stringify(v);
    try{ localStorage.setItem(k, s); } catch(e){ mem[k]=v; }
    if(window.TG && TG.cloudSet) TG.cloudSet(k, s);
  }
  function storeRemove(k){
    try{ localStorage.removeItem(k); } catch(e){ delete mem[k]; }
    if(window.TG && TG.cloudRemove) TG.cloudRemove(k);
  }
  function storeAllKeys(){ var keys=[]; try{ for(var i=0;i<localStorage.length;i++){ keys.push(localStorage.key(i)); } } catch(e){ keys = Object.keys(mem); } return keys; }

  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg){ toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 1900); }

  var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var titleEl = document.getElementById('screenTitle');
  var eyebrowEl = document.getElementById('screenEyebrow');
  function showScreen(name){
    closeLesson(); closeQuiz();
    screens.forEach(function(s){ s.hidden = (s.id !== 'screen-' + name); });
    tabs.forEach(function(t){ t.setAttribute('aria-current', String(t.dataset.screen === name)); });
    var active = document.getElementById('screen-' + name);
    if(active){ titleEl.textContent = active.dataset.title; eyebrowEl.textContent = active.dataset.eyebrow; }
    storeSet('activeScreen', name);
    document.querySelector('.content').scrollTop = 0;
  }
  tabs.forEach(function(t){ t.addEventListener('click', function(){ if(window.TG) TG.haptic('select'); showScreen(t.dataset.screen); }); });
  document.querySelectorAll('[data-goto]').forEach(function(b){ b.addEventListener('click', function(){ showScreen(b.dataset.goto); }); });

  function ytId(url){ if(!url) return null; var m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/); return m ? m[1] : null; }

  /* ---- progress keys ---- */
  function readKey(cid){ return 'read_' + cid; }
  function readArr(cid){ return storeGet(readKey(cid), []); }
  function qzKey(cid){ return 'qz_' + cid; }
  function getAnswers(cid){ return storeGet(qzKey(cid), {}); }
  function setAnswers(cid, obj){ storeSet(qzKey(cid), obj); }
  function vidKey(cid, idx){ return 'vid_' + cid + '_' + idx; }
  function getVideo(c, idx){ var custom = storeGet(vidKey(c.id, idx), null); return custom || c.lessons[idx].video || null; }

  function findCourse(cid){ return COURSES.filter(function(c){return c.id===cid;})[0]; }
  function coursesInBlock(bid){ return COURSES.filter(function(c){ return c.blockId===bid; }); }
  function flatOrder(){ var arr=[]; BLOCKS.forEach(function(b){ coursesInBlock(b.id).forEach(function(c){ arr.push(c.id); }); }); return arr; }

  function quizDone(c){ var ans = getAnswers(c.id); return Object.keys(ans).length >= c.quiz.length; }
  function quizScore(c){ var ans = getAnswers(c.id); var correct=0, answered=0; c.quiz.forEach(function(q,qi){ if(ans[qi]!==undefined){ answered++; if(ans[qi]===q.correct) correct++; } }); return {answered:answered, correct:correct, total:c.quiz.length}; }
  function courseStatus(c){
    var read = readArr(c.id).length;
    if(quizDone(c)) return 'done';
    if(read>0 || getAnswers(c.id) && Object.keys(getAnswers(c.id)).length>0) return 'progress';
    return 'new';
  }
  function coursePct(c){
    var read = readArr(c.id).length, total = c.lessons.length;
    var readShare = total ? read/total : 0;
    var qz = quizScore(c);
    var quizShare = c.quiz.length ? qz.answered/c.quiz.length : 0;
    return Math.round(100 * (readShare*0.6 + quizShare*0.4));
  }
  function ctaLabel(c){
    var st = courseStatus(c);
    if(st==='done') return 'Пройден ↻';
    var read = readArr(c.id).length;
    if(read===0) return 'Начать курс';
    if(read < c.lessons.length) return 'Продолжить статьи';
    return 'Пройти квиз';
  }

  function continueCourse(cid){
    var c = findCourse(cid); if(!c) return;
    storeSet('activeCourseId', cid);
    var read = readArr(cid);
    if(read.length < c.lessons.length){ openLesson(cid, read.length); }
    else { openQuiz(cid); }
    renderAll();
  }

  /* ---------- banners ---------- */
  function bannerHtml(){
    var activeId = storeGet('activeCourseId', null);
    var c = activeId ? findCourse(activeId) : null;
    if(!c){
      return '<div class="empty-banner"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v14"/><path d="M4 19a2 2 0 0 0 2 2h12M4 19a2 2 0 0 1 2-2h12"/></svg>' +
        '<span class="muted" style="font-size:12.5px;">Курс ещё не выбран</span><button class="btn primary sm" data-pick-any>Выбрать курс</button></div>';
    }
    var pct = coursePct(c), status = courseStatus(c);
    var label = status==='done' ? 'Курс пройден · можно повторить квиз' : (readArr(c.id).length < c.lessons.length ? 'Дальше: ' + c.lessons[readArr(c.id).length].title : 'Дальше: квиз курса');
    return '<div class="active-banner"><div class="between"><span class="eyebrow">Активный курс</span><span class="faint mono" style="font-size:11px;">' + pct + '%</span></div>' +
      '<span class="name">' + c.name + '</span><div class="progress"><i style="width:' + pct + '%"></i></div><span class="next">' + label + '</span>' +
      '<div class="row" style="gap:8px;"><button class="btn primary" data-continue="' + c.id + '" style="flex:1;">' + ctaLabel(c) + '</button><button class="btn ghost sm" data-switch>Сменить курс</button></div></div>';
  }
  function renderBanners(){
    var html = bannerHtml();
    ['startActiveBanner','coursesActiveBanner'].forEach(function(id){
      var el = document.getElementById(id); if(!el) return;
      el.innerHTML = html;
      el.querySelectorAll('[data-continue]').forEach(function(b){ b.addEventListener('click', function(){ continueCourse(b.dataset.continue); }); });
      el.querySelectorAll('[data-switch]').forEach(function(b){ b.addEventListener('click', function(){ storeSet('activeCourseId', null); renderAll(); }); });
      el.querySelectorAll('[data-pick-any]').forEach(function(b){ b.addEventListener('click', function(){ showScreen('courses'); }); });
    });
  }

  /* ---------- course + block rendering ---------- */
  var blocksListEl = document.getElementById('blocksList');
  var checkSvg = '<path d="M4 12l5 5L20 6"/>';
  var arrowSvg = '<path d="m9 6 6 6-6 6"/>';
  var courseIconPath = '<path d="M4 19V5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v14"/><path d="M4 19a2 2 0 0 0 2 2h12M4 19a2 2 0 0 1 2-2h12"/>';
  var quizIconPath = '<path d="M9.1 9a3 3 0 1 1 4.4 2.6c-.8.5-1.5 1-1.5 2.1M12 17h.01"/><circle cx="12" cy="12" r="9.5"/>';
  var clubSvg = '<path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7l-8-4Z"/>';

  function renderCourseCard(c){
    var wrap = document.createElement('details');
    wrap.className = 'course'; wrap.id = 'course-' + c.id;
    var pct = coursePct(c);
    wrap.innerHTML =
      '<summary><div class="course-icon"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + courseIconPath + '</svg></div>' +
      '<div class="course-meta"><div class="name">' + c.name + '</div>' +
      '<span class="faint mono course-sub" style="font-size:11px;">' + c.lessons.length + ' ' + (c.lessons.length===1?'статья':'статей') + ' · ' + pct + '%</span>' +
      '<div class="progress sm" style="margin-top:6px;"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="course-actions"><button class="btn primary sm course-cta" type="button">' + ctaLabel(c) + '</button>' +
      '<svg class="chev" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></div></summary>' +
      '<div class="lesson-list"></div>';
    wrap.querySelector('.course-cta').addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); continueCourse(c.id); });
    var list = wrap.querySelector('.lesson-list');
    c.lessons.forEach(function(l, i){
      var row = document.createElement('div'); row.className = 'lesson-row';
      var isRead = readArr(c.id).indexOf(i) !== -1;
      var hasVideo = !!getVideo(c, i);
      row.innerHTML = '<button class="lesson-check" data-read="' + isRead + '"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + checkSvg + '</svg></button>' +
        '<span class="lesson-txt"><span class="n">' + String(i+1).padStart(2,'0') + '</span>' + (hasVideo ? '<span class="lesson-video-dot" title="Есть видео"></span>' : '') + l.title + '</span>' +
        '<svg class="lesson-arrow" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + arrowSvg + '</svg>';
      row.querySelector('.lesson-check').addEventListener('click', function(ev){ ev.stopPropagation(); toggleRead(c.id, i); syncCourseCard(c); });
      row.addEventListener('click', function(){ storeSet('activeCourseId', c.id); renderBanners(); openLesson(c.id, i); });
      list.appendChild(row);
    });
    var quizRow = document.createElement('div');
    quizRow.className = 'quiz-row';
    quizRow.innerHTML = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + quizIconPath + '</svg><span>Квиз курса — ' + c.quiz.length + ' вопросов' + (quizDone(c) ? (' · пройден ' + quizScore(c).correct + '/' + quizScore(c).total) : '') + '</span>';
    quizRow.addEventListener('click', function(ev){ ev.stopPropagation(); storeSet('activeCourseId', c.id); openQuiz(c.id); });
    list.appendChild(quizRow);
    var clubMini = document.createElement('div'); clubMini.className = 'club-mini';
    clubMini.innerHTML = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + clubSvg + '</svg><span>После курса — закрытый клуб, $100 / 10 000 ₽</span>';
    clubMini.addEventListener('click', function(ev){ ev.stopPropagation(); window.open(CLUB_LINK, '_blank', 'noopener'); });
    list.appendChild(clubMini);
    return wrap;
  }

  function toggleRead(cid, idx){
    var arr = readArr(cid); var i = arr.indexOf(idx);
    if(i===-1) arr.push(idx); else arr.splice(i,1);
    storeSet(readKey(cid), arr);
    refreshProfile(); renderBanners();
  }
  function markRead(cid, idx){
    var arr = readArr(cid);
    if(arr.indexOf(idx)===-1){ arr.push(idx); storeSet(readKey(cid), arr); }
  }
  function syncCourseCard(c){
    var wrap = document.getElementById('course-' + c.id); if(!wrap) return;
    var pct = coursePct(c);
    wrap.querySelector('.course-sub').textContent = c.lessons.length + ' ' + (c.lessons.length===1?'статья':'статей') + ' · ' + pct + '%';
    wrap.querySelector('.progress > i').style.width = pct + '%';
    wrap.querySelector('.course-cta').textContent = ctaLabel(c);
    var arr = readArr(c.id);
    wrap.querySelectorAll('.lesson-check').forEach(function(btn, i){ btn.setAttribute('data-read', String(arr.indexOf(i)!==-1)); });
    refreshProfile();
  }

  function renderBlocks(){
    blocksListEl.innerHTML = '';
    BLOCKS.forEach(function(b){
      var head = document.createElement('div'); head.className = 'block-head';
      head.innerHTML = '<div class="num">' + b.num + '</div><h2>' + b.name + '</h2><span class="lvl">' + b.level + '</span>';
      blocksListEl.appendChild(head);
      var list = coursesInBlock(b.id);
      list.forEach(function(c){ blocksListEl.appendChild(renderCourseCard(c)); });
      if(b.soon && b.soon.length){
        var soon = document.createElement('div'); soon.className = 'soon-card';
        soon.innerHTML = '<span class="eyebrow">Скоро в этом блоке</span><div class="soon-list">' + b.soon.map(function(s){ return '<span class="soon-pill">' + s + '</span>'; }).join('') + '</div>';
        blocksListEl.appendChild(soon);
      }
      if(!list.length && (!b.soon || !b.soon.length)){
        var empty = document.createElement('div'); empty.className='soon-card';
        empty.innerHTML = '<span class="eyebrow">Материалы готовятся</span>';
        blocksListEl.appendChild(empty);
      }
    });
  }

  /* ---------- profile ---------- */
  function refreshProfile(){
    var totalLessons=0, totalRead=0, totalQ=0, totalAns=0, totalCorrect=0;
    COURSES.forEach(function(c){
      totalLessons += c.lessons.length; totalRead += readArr(c.id).length;
      totalQ += c.quiz.length;
      var qz = quizScore(c); totalAns += qz.answered; totalCorrect += qz.correct;
    });
    var sD = document.getElementById('statDone'); if(sD) sD.innerHTML = totalRead + '<span class="faint" style="font-size:13px;">/' + totalLessons + '</span>';
    var pct = totalLessons ? Math.round(100*totalRead/totalLessons) : 0;
    var ring = document.getElementById('profileRing');
    if(ring) ring.setAttribute('stroke-dashoffset', String(194.7 - 194.7*pct/100));
    var pp = document.getElementById('profilePct'); if(pp) pp.textContent = pct + '%';
    var pf = document.getElementById('profileFrac'); if(pf) pf.textContent = totalRead + ' из ' + totalLessons + ' статей прочитано';
    var accTxt = totalAns ? Math.round(100*totalCorrect/totalAns) + '% (' + totalCorrect + '/' + totalAns + ')' : 'пока нет ответов';
    var pa = document.getElementById('profileAccuracy'); if(pa) pa.textContent = 'квизы: ' + accTxt;
    var sa = document.getElementById('statAccuracy'); if(sa) sa.textContent = totalAns ? Math.round(100*totalCorrect/totalAns) + '%' : '—';

    var listEl = document.getElementById('profileCourseList');
    if(listEl){
      listEl.innerHTML = '';
      var activeId = storeGet('activeCourseId', null);
      COURSES.forEach(function(c, i){
        var p = coursePct(c), status = courseStatus(c);
        var statusTxt = status==='new' ? 'не начат' : status==='done' ? 'пройден' : 'в процессе';
        var row = document.createElement('div'); row.className = 'prof-course-row';
        row.innerHTML = '<div class="info"><div class="between"><b>' + c.name + (c.id===activeId ? ' <span class="faint" style="font-weight:500;">· активный</span>' : '') + '</b><span class="status-pill ' + status + '">' + statusTxt + '</span></div><div class="progress sm"><i style="width:' + p + '%"></i></div></div>';
        listEl.appendChild(row);
        if(i < COURSES.length-1){ var hr = document.createElement('hr'); hr.className='divider'; listEl.appendChild(hr); }
      });
    }
  }

  function renderAll(){ renderBlocks(); renderBanners(); refreshProfile(); }

  /* ---------- lesson overlay ---------- */
  var overlay = document.getElementById('lessonOverlay');
  var lessonScroll = document.getElementById('lessonScroll');
  var lessonKicker = document.getElementById('lessonKicker');
  var lessonTitleTxt = document.getElementById('lessonTitleTxt');
  var finishBtn = document.getElementById('lessonFinishBtn');

  function closeLesson(){ overlay.hidden = true; if(window.TG){ TG.hideBack(); TG.hideMainButton(); } }
  document.getElementById('lessonBack').addEventListener('click', function(){ closeLesson(); renderAll(); });

  var playSvg = '<circle cx="12" cy="12" r="9.5"/><path d="m10 8.5 5 3.5-5 3.5v-7Z"/>';
  function videoBlockHtml(c, idx){
    var vid = getVideo(c, idx);
    if(vid){
      return '<div class="video-wrap"><iframe src="https://www.youtube.com/embed/' + vid + '" title="Видео к уроку" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>' +
        '<div class="video-link-row"><a href="https://youtu.be/' + vid + '" target="_blank" rel="noopener">Смотреть на YouTube ↗</a></div>';
    }
    return '<div class="video-empty"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + playSvg + '</svg>' +
      '<span class="muted" style="font-size:12.3px;">Видео к этой статье ещё не добавлено</span>' +
      '<div class="add-row"><input type="text" placeholder="Вставь ссылку на YouTube" id="videoAddInput"><button class="btn primary sm" id="videoAddBtn">Добавить</button></div></div>';
  }

  function openLesson(cid, idx){
    var c = findCourse(cid); if(!c) return;
    if(idx >= c.lessons.length){ openQuiz(cid); return; }
    var lesson = c.lessons[idx];
    lessonKicker.textContent = c.name + ' · статья ' + (idx+1) + '/' + c.lessons.length;
    lessonTitleTxt.textContent = lesson.title;
    var syntxHtml = '<div class="syntx"><div class="ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5c-3 3-3 13 0 17M12 3.5c3 3 3 13 0 17M4 12h16"/></svg></div>' +
      '<div class="txt"><b>Всё это уже есть в Syntx AI</b>То, что разобрано в статье, доступно прямо сейчас в Syntx — удобном сервисе генерации: 90+ нейросетей без VPN, по токенам.' +
      '<a class="btn primary" style="margin-top:8px; padding:7px 12px; font-size:12px;" href="' + SYNTX_LINK + '" target="_blank" rel="noopener">Открыть Syntx AI →</a></div></div>';
    lessonScroll.innerHTML = videoBlockHtml(c, idx) + '<h3>' + lesson.title + '</h3><div class="body-txt">' + lesson.body.map(function(p){ return '<p>' + p + '</p>'; }).join('') + '</div>' + syntxHtml;
    lessonScroll.scrollTop = 0;
    var videoInput = document.getElementById('videoAddInput');
    var videoBtn = document.getElementById('videoAddBtn');
    if(videoBtn){ videoBtn.addEventListener('click', function(){
      var id = ytId(videoInput.value.trim());
      if(!id){ toast('Не похоже на ссылку YouTube'); return; }
      storeSet(vidKey(cid, idx), id); toast('Видео добавлено'); openLesson(cid, idx);
    }); }
    var isLast = idx === c.lessons.length - 1;
    var lessonNextLabel = isLast ? 'Прочитано → квиз курса' : 'Следующая статья →';
    finishBtn.textContent = lessonNextLabel;
    var lessonNextAction = function(){
      markRead(cid, idx); syncCourseCard(c); renderBanners(); refreshProfile();
      if(isLast) openQuiz(cid); else openLesson(cid, idx+1);
    };
    finishBtn.onclick = lessonNextAction;
    if(window.TG){
      TG.showBack(function(){ closeLesson(); renderAll(); });
      TG.setMainButton(lessonNextLabel, lessonNextAction);
    }
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
    quizTitleTxt.textContent = c.name;
    if(window.TG) TG.showBack(function(){ closeQuiz(); renderAll(); });
    var saved = getAnswers(cid);
    var html = '<div class="quiz-head"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + quizIconPath + '</svg><b>Квиз курса «' + c.name + '» — ' + c.quiz.length + ' вопросов</b></div>';
    c.quiz.forEach(function(q, qi){
      html += '<div class="quiz-q" data-qi="' + qi + '"><p class="q-text">' + (qi+1) + '. ' + q.q + '</p><div class="q-opts">' +
        q.opts.map(function(o, oi){ return '<button class="q-opt" data-oi="' + oi + '"><span>' + o + '</span><span class="mark"></span></button>'; }).join('') +
        '</div><p class="q-explain" hidden></p></div>';
    });
    var clubHtml = '<div class="club" id="quizClub" hidden><p class="eyebrow">Курс «' + c.name + '» пройден</p><h3>Разбор твоего кейса лично</h3><p>В закрытом клубе — практика с обратной связью и живые работы учеников.</p><div class="price">$100 <span>или</span> 10 000 ₽</div><a class="btn gold block" href="' + CLUB_LINK + '" target="_blank" rel="noopener">Написать в клуб →</a></div>';
    quizScroll.innerHTML = html + clubHtml;
    quizScroll.scrollTop = 0;

    var localAnswered = Object.keys(saved).length;
    var localCorrect = 0; c.quiz.forEach(function(q,qi){ if(saved[qi]===q.correct) localCorrect++; });

    quizScroll.querySelectorAll('.quiz-q').forEach(function(qEl){
      var qi = Number(qEl.dataset.qi); var q = c.quiz[qi];
      var already = saved[qi];
      if(already !== undefined){
        qEl.querySelectorAll('.q-opt').forEach(function(o2, oi2){ o2.disabled = true; if(oi2===q.correct) o2.classList.add('correct'); else if(oi2===already) o2.classList.add('incorrect'); });
        var exp0 = qEl.querySelector('.q-explain'); exp0.textContent = (already===q.correct ? '✓ Верно. ' : '✕ Не совсем. ') + q.explain; exp0.hidden = false;
      }
      qEl.querySelectorAll('.q-opt').forEach(function(optEl){
        optEl.addEventListener('click', function(){
          if(saved[qi] !== undefined) return;
          var oi = Number(optEl.dataset.oi);
          saved[qi] = oi; setAnswers(cid, saved);
          localAnswered++; var correct = oi===q.correct; if(correct) localCorrect++;
          qEl.querySelectorAll('.q-opt').forEach(function(o2, oi2){ o2.disabled = true; if(oi2===q.correct) o2.classList.add('correct'); else if(oi2===oi) o2.classList.add('incorrect'); });
          var exp = qEl.querySelector('.q-explain'); exp.textContent = (correct ? '✓ Верно. ' : '✕ Не совсем. ') + q.explain; exp.hidden = false;
          if(window.TG) TG.haptic(correct ? 'success' : 'error');
          refreshProfile();
          updateQuizFinishState(c, localAnswered, localCorrect);
        });
      });
    });
    updateQuizFinishState(c, localAnswered, localCorrect);
    quizOverlay.hidden = false;
  }

  function updateQuizFinishState(c, answered, correct){
    if(answered >= c.quiz.length){
      quizFinishBtn.disabled = false;
      var doneLabel = 'Квиз пройден (' + correct + '/' + c.quiz.length + ') · далее';
      var doneAction = function(){ finishQuiz(c, correct); };
      quizFinishBtn.textContent = doneLabel;
      quizFinishBtn.onclick = doneAction;
      if(window.TG) TG.setMainButton(doneLabel, doneAction);
    } else {
      quizFinishBtn.disabled = true;
      quizFinishBtn.textContent = 'Ответь на все вопросы (' + answered + '/' + c.quiz.length + ')';
      quizFinishBtn.onclick = null;
      if(window.TG) TG.hideMainButton();
    }
  }

  function finishQuiz(c, correct){
    toast('Квиз курса пройден · ' + correct + '/' + c.quiz.length + ' верно');
    if(window.TG) TG.haptic('success');
    var clubBlock = document.getElementById('quizClub');
    if(clubBlock){ clubBlock.hidden = false; clubBlock.scrollIntoView({behavior:'smooth', block:'start'}); }
    var order = flatOrder(); var pos = order.indexOf(c.id); var nextId = order[pos+1];
    var nextLabel, nextAction;
    if(nextId){
      nextLabel = 'Следующий курс →';
      nextAction = function(){ closeQuiz(); continueCourse(nextId); showScreen('courses'); };
    } else {
      nextLabel = 'Вернуться к курсам';
      nextAction = function(){ closeQuiz(); renderAll(); showScreen('courses'); };
    }
    quizFinishBtn.textContent = nextLabel;
    quizFinishBtn.onclick = nextAction;
    if(window.TG) TG.setMainButton(nextLabel, nextAction);
    renderAll();
  }

  /* ---------- toolkit ---------- */
  var fields = ['fRole','fTask','fContext','fStyle','fResult'];
  var labels = { fRole:'Роль', fTask:'Задача', fContext:'Контекст', fStyle:'Стиль', fResult:'Результат' };
  var previewEl = document.getElementById('formulaPreview');
  function renderPreview(){
    var any = fields.some(function(id){ var el=document.getElementById(id); return el && el.value.trim(); });
    var parts = fields.map(function(id){ var el=document.getElementById(id); var v = el?el.value.trim():''; return labels[id] + ': ' + (v || '…'); });
    previewEl.innerHTML = any ? parts.join('\n') : 'Заполни поля выше';
  }
  fields.forEach(function(id){ var el=document.getElementById(id); if(el) el.addEventListener('input', renderPreview); });
  var copyBtn = document.getElementById('copyPrompt');
  if(copyBtn) copyBtn.addEventListener('click', function(){
    var text = fields.map(function(id){ var el=document.getElementById(id); var v = el?el.value.trim():''; return labels[id] + ': ' + (v || '—'); }).join('\n');
    try{ navigator.clipboard.writeText(text).then(function(){ toast('Промпт скопирован'); }).catch(function(){ toast('Промпт готов — выдели и скопируй'); }); }
    catch(e){ toast('Промпт готов — выдели и скопируй'); }
  });

  /* ---------- reset ---------- */
  var resetBtn = document.getElementById('resetBtn');
  var resetArmed = false, resetTimer;
  if(resetBtn) resetBtn.addEventListener('click', function(){
    if(!resetArmed){ resetArmed = true; resetBtn.textContent = 'Точно сбросить? Нажми ещё раз'; clearTimeout(resetTimer);
      resetTimer = setTimeout(function(){ resetArmed = false; resetBtn.textContent = 'Сбросить весь прогресс'; }, 2600); return; }
    storeAllKeys().forEach(function(k){ if(k && (k.indexOf('read_')===0 || k.indexOf('qz_')===0 || k === 'activeCourseId')) storeRemove(k); });
    resetArmed = false; resetBtn.textContent = 'Сбросить весь прогресс';
    renderAll(); toast('Прогресс сброшен');
  });

  function boot(){
    renderAll();
    showScreen(storeGet('activeScreen', 'start'));
  }
  if(window.TG && TG.cloudSync){ TG.cloudSync(boot); } else { boot(); }
})();
