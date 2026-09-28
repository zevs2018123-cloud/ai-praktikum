/* ============================================================
   i18n core. English lives here; other languages are packs in /lang/*.js
   that register I18N.<code> = { ui:{...}, tips:[...], blocks:{...}, courses:{...} }.
   A pack is loaded only when that language is picked.
   ============================================================ */
var LANGS = [
  { code:'en', name:'English',  flag:'🇬🇧' },
  { code:'ru', name:'Русский',  flag:'🇷🇺' },
  { code:'fr', name:'Français', flag:'🇫🇷' },
  { code:'de', name:'Deutsch',  flag:'🇩🇪' }
];
var LANG = 'en';
var I18N = { en: { ui: {
  /* static screen */
  eyebrowAcademy:'Academy', tabHome:'Home', tabCourses:'Courses', tabTools:'Tools', tabAI:'Jason AI', tabProfile:'Profile',
  eyebrowLearn:'Learn', eyebrowKit:"Trader's kit", eyebrowYou:'You', eyebrowAssistant:'Assistant',
  heroHey:'Hey 👋', heroHeyName:'Hey, {name} 👋',
  heroTitle:'Learn to trade like a pro — risk first',
  heroText:"Short lessons, a quiz after every course, and tools you'll actually use on a live chart.",
  pickCourse:'Pick a course', yourProgress:'Your progress', summary:'Summary', lessonsRead:'lessons read', quizAccuracy:'quiz accuracy',
  riskNote:"Educational content, not financial advice. Trading CFDs and forex with leverage carries a high risk of losing money. Never trade money you can't afford to lose.",
  coursesIntro:'Each lesson is a short read. The course quiz is a separate button — all its questions on one page.',
  toolSize:'Position size', toolDD:'Drawdown', toolComp:'Compounding',
  sizeTitle:'Position size calculator', sizeTag:'risk-first', sizeIntro:"Decide how much you're willing to lose first. The calculator turns that into a lot size.",
  fInstr:'Instrument', optXau:'XAUUSD — gold (100 oz per lot)', optFx:'EURUSD / GBPUSD / AUDUSD (USD-quoted)', optJpy:'USDJPY (JPY-quoted)',
  fBal:'Account balance, $', fRisk:'Risk per trade, %', fEntry:'Entry price', fStop:'Stop loss', fTp:'Take profit (optional)',
  sizeFoot:"Contract sizes differ between brokers — check your instrument's spec before trading. USDJPY value uses entry price for the JPY→USD conversion.",
  ddTitle:'Drawdown recovery', ddTag:'the math of losses', ddIntro:"Losses and gains aren't symmetrical. The deeper the hole, the harder the climb out.",
  fLoss:'Loss, %', fBalBefore:'Balance before, $',
  compTitle:'Compounding reality check', compTag:'no hype', compIntro:'How long does a target actually take at a steady monthly return? Run the numbers before you believe any screenshot.',
  fStart:'Start, $', fTarget:'Target, $', fRate:'Average monthly return, %',
  achievements:'Achievements', courseProgress:'Course progress', resetAll:'Reset all progress', resetSure:'Sure? Tap again to reset', resetDone:'Progress reset',
  profile:'Profile', aiIntro:"I'm Jason AI — an AI assistant trained on the course and Jason's approach. Ask about a term from a lesson, how a tool works, or where to find something. I don't give buy/sell calls.",
  chatPh:'Ask a question...', course:'Course', lesson:'Lesson', courseQuiz:'Course quiz', answerAll:'Answer all questions',
  gateTitle:'For channel subscribers', gateText:"Every course, quiz and tool is free — you just need to be subscribed to Jason's channel, where the live trades and breakdowns go out.",
  gateOpen:'Open the channel', gateRecheck:"I've subscribed", gateChecking:'Checking…', gateNotYet:"Can't see your subscription yet. If you just joined, wait a few seconds and tap again.",
  achUnlocked:'Achievement unlocked', language:'Language',
  /* dynamic */
  ctaDone:'Done ↻', ctaStart:'Start', ctaContinue:'Continue', ctaQuiz:'Take quiz',
  clubEyebrow:'Private club', clubTitle:'Trade alongside Jason',
  clubText:'In the private club Jason posts every trade live — entry, stop, target and the reasoning — so you can see the lessons applied on a real account.',
  clubBtn:'Join the club →', clubRisk:"Past results don't guarantee future returns. Copying trades carries the same risk as placing them yourself.",
  clubMini:"See it applied live — Jason's private club", clubCourseDone:'“{name}” complete',
  brokerTitle:'Practise on a demo — {name}', brokerText:'Open a free demo account and practise every lesson with virtual money before you risk a cent.', brokerBtn:'Open demo account →',
  noCourse:'No course picked yet — start with Trading 101', startLearning:'Start learning',
  currentCourse:'Current course', courseDoneRetake:'Course complete · you can retake the quiz', nextLbl:'Next: {t}', nextQuiz:'Next: course quiz', switchBtn:'Switch',
  lessonsN:'{n} lessons', lessonsN1:'1 lesson', markRead:'Mark as read', hasVideo:'Has video',
  quizRow:'Course quiz — {n} questions', quizRowDone:' · done {c}/{t}', comingSoon:'Coming soon',
  xpTo:'{n} XP to “{lvl}”', maxLevel:'Max level reached',
  lvl0:'Rookie', lvl1:'Chart Reader', lvl2:'Risk Manager', lvl3:'Swing Trader', lvl4:'Gold Specialist', lvl5:'Market Pro', lvl6:'Legend',
  ach_first:'First candle|Read your first lesson', ach_warm:'Warming up|5 lessons read', ach_hooked:'Hooked|15 lessons read',
  ach_course1:'First course|Finished a whole course', ach_risk:'Risk manager|Completed Risk First', ach_gold:'Gold bug|Completed Trading Gold',
  ach_sniper:'Sniper entry|A course quiz with zero mistakes', ach_nomiss:'Diamond hands|3 perfect course quizzes', ach_tools:'Numbers first|Used all three trading tools',
  ach_streak7:'7-day streak|Studied 7 days in a row', ach_block:'Block cleared|Every course in a block completed', ach_all:'Graduate|Every course in the academy done',
  lessonsOf:'{r} of {t} lessons read', quizzesLbl:'quizzes: {v}', noAnswers:'no answers yet',
  stNew:'not started', stDone:'completed', stProgress:'in progress', current:'current',
  linksLbl:'Links from this lesson', open:'Open ↗', practice:'Practice', copy:'Copy', copied:'Copied', selectCopy:'Select the text and copy',
  openCalc:'Open the calculator', watchVideo:'Watch the video', openYt:'Open on YouTube ↗',
  lessonKicker:'{c} · lesson {i}/{n}', minRead:'{n} min read', nextLesson:'Next lesson →', doneToQuiz:'Done → course quiz',
  quizHead:'{name} — {n} questions', correctPfx:'✓ Correct. ', wrongPfx:'✕ Not quite. ',
  quizDoneBtn:'Quiz done ({c}/{t}) · continue', answerAllN:'Answer all questions ({a}/{t})', quizToast:'Quiz complete · {c}/{t} correct',
  nextCourse:'Next course →', backCourses:'Back to courses',
  kLot:'Lot size', kRisk:'Money at risk', kStopDist:'Stop distance', kRR:'Reward : risk', pips:'pips',
  sizeFill:'Fill in balance, risk, entry and a stop that differs from entry.', sizeLong:'Long (buy) setup.', sizeShort:'Short (sell) setup.',
  sizeTooBig:'Even 0.01 lots risks {m} here — more than your {r}%. Use a bigger account, a logically tighter stop, or skip the trade.',
  sizeReward:'If the target hits: +{m}.', sizeOver2:'Risking more than 2% per trade makes a normal losing streak very painful — see Risk First.',
  sizeRRlow:'Reward is smaller than risk — you need a very high win rate for this to pay.',
  kBalAfter:'Balance after', kNeed:'Gain needed to recover', ddEnter:'Enter a loss between 0 and 100%.', thLoss:'Loss', thNeed:'Needed to get back',
  kTime:'Time needed', kYearly:'Same as yearly', mo:'mo', yrs:'yrs', compFill:'Target must be larger than start, return above 0.',
  compMsg:'That assumes {r}% every single month with zero losing months. For context, top professional funds are happy with 15–25% a year. The math is why risk control matters more than any single trade.',
  ruleOfDay:'Rule of the day',
  streakN:'{n}-day streak', streakStart:'Start your streak today', goalDone:"Today's goal done — see you tomorrow", goalTodo:"Today's goal: read one lesson",
  best:'best: {n} {d}', day:'day', days:'days', freezes:' · streak freezes: {n}', goalDoneA:'goal done', goalTodoA:'goal not done',
  aiOff:"Jason AI is being switched on — for now, check the Courses tab. I'll be here soon.", typing:'typing…',
  aiErr:"Couldn't answer that one — try again.", aiOffline:'Jason AI is offline right now — try again in a bit.',
  aiHello:"Hey{name} 👋 Ask me anything from the lessons — what a pip is, how to size a gold trade, why a stop goes where it goes. I explain; I don't give signals.",
  build:'build {b} · {c} courses · {l} lessons'
}}};

function T(key, vars){
  var pack = I18N[LANG] && I18N[LANG].ui;
  var s = (pack && pack[key] != null) ? pack[key] : I18N.en.ui[key];
  if(s == null) return key;
  if(vars) s = s.replace(/\{(\w+)\}/g, function(_, k){ return vars[k] != null ? vars[k] : ''; });
  return s;
}

/* Overwrite course texts in place with the pack's translations (structure is identical). */
function applyContentPack(pack){
  if(!pack) return;
  if(pack.blocks) BLOCKS.forEach(function(b){ var tb = pack.blocks[b.id]; if(tb){ b.name = tb.name || b.name; b.level = tb.level || b.level; if(tb.soon) b.soon = tb.soon; } });
  if(pack.tips && pack.tips.length === TIPS.length) TIPS.forEach(function(t, i){ t.t = pack.tips[i][0]; t.d = pack.tips[i][1]; });
  if(pack.courses) COURSES.forEach(function(c){
    var tc = pack.courses[c.id]; if(!tc) return;
    if(tc.name) c.name = tc.name;
    (tc.lessons || []).forEach(function(tl, i){ var l = c.lessons[i]; if(!l || !tl) return; if(tl.title) l.title = tl.title; if(tl.body && tl.body.length === l.body.length) l.body = tl.body; });
    (tc.quiz || []).forEach(function(tq, i){ var q = c.quiz[i]; if(!q || !tq) return; q.q = tq[0]; if(tq[1].length === q.opts.length) q.opts = tq[1]; q.explain = tq[2]; });
  });
}
