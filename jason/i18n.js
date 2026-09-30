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

/* ---- funnel: onboarding, gate, goal, referrals, chat articles ---- */
Object.assign(I18N.en.ui, {
  goalLbl:'My goal', goalNoText:'Set your goal', goalStart:'Start: {t}', goalUpdate:'+ Update',
  goalDebtWarn:'Rule #1: never trade borrowed money or money you need for debt payments. Pay debts from income; trade only risk capital.',
  kBalance:'Balance', kDeposits:'Deposits', kWithdrawals:'Withdrawals', kTarget:'Target',
  lt_deposit:'Deposit', lt_withdrawal:'Withdrawal', lt_balance:'Balance', ledgerTitle:'Deposits & balance', ledgerAdd:'Add',
  ledgerHint:'Balance = your current account balance at the broker. Deposits and withdrawals after it are added automatically.',
  ledgerEmpty:'No entries yet — add your first deposit or current balance.', ledgerBad:'Enter an amount', netErr:'No connection — try again',
  refTitle:'Invite friends', refCount:'{n} confirmed · {i} joined', refText:'Share your personal link. A friend counts once they open an account and get access to the courses.',
  refShare:'Share link', refShareText:'I’m learning to trade gold with Jason — join the academy:', refPrizeTbd:'Prize coming soon', refNext:'{k} more to unlock the next prize ({t} friends)',
  clubOpen:'Open the private club', mgrContact:'Message @{m}',
  gTitle:'Unlock all courses', gText:'The academy is free for students of our partner broker. Two steps, about 3 minutes:',
  gStep1:'Open an account with {b} via our link', gOpenBroker:'Open {b} account →', gStep2:'Send us your account number',
  gAccPh:'Account number', gSend:'Send', gNote:'A manager checks the account and unlocks the courses — usually within a few hours.',
  gRejected:'We couldn’t confirm that account. Check the number or message the manager.', gBadAcc:'Enter a valid account number',
  gPendTitle:'Checking your account', gPendText:'Account {a} is being verified by a manager. You’ll get a message in the bot as soon as the courses unlock.',
  lockTitle:'Courses are locked', lockSub:'Open an account via our partner link to unlock everything.', lockBtn:'Unlock',
  lockPending:'Your account is being checked', lockPendingSub:'We’ll message you in the bot as soon as it’s done.',
  onbWelcome:'Let’s build your path', onbWelcomeSub:'6 quick questions — about 1 minute. We’ll tailor the academy to your level and your goal.', onbStart:'Let’s go',
  q_exp:'How much trading experience do you have?', o_exp_none:'None — I’m new', o_exp_demo:'Only on a demo account', o_exp_lt1:'Less than a year live', o_exp_gt1:'More than a year live',
  q_markets:'What have you traded before?', onbMulti:'Pick all that apply.', o_markets_forex:'Forex', o_markets_gold:'Gold', o_markets_crypto:'Crypto', o_markets_stocks:'Stocks', o_markets_none:'Nothing yet',
  q_problem:'What holds you back the most?', o_problem_knowledge:'Not enough knowledge', o_problem_losses:'I keep losing money', o_problem_discipline:'Discipline and emotions', o_problem_time:'Not enough time', o_problem_capital:'Small starting capital',
  q_time:'How much time can you give it per day?', o_time_lt30:'Under 30 minutes', o_time_h1:'About an hour', o_time_h2:'2+ hours',
  q_tier:'Which starting deposit fits you?',
  onbGoalQ:'What are you working towards?', onbGoalSub:'Your goal stays pinned at the top of your dashboard.', onbGoalText:'Goal', onbGoalPh:'e.g. my own apartment', onbTarget:'Target amount, $',
  onbGoalNote:'Trading carries a real risk of loss. Set a target, but never trade money you can’t afford to lose.', onbNeedTarget:'Enter a target amount',
  gc_apartment:'🏠 Apartment', gc_car:'🚗 Car', gc_debts:'💳 Pay off debts', gc_travel:'✈️ Travel', gc_business:'💼 My own business', gc_freedom:'🕊 Financial freedom',
  back:'Back', next:'Next', onbFinish:'Finish',
  fDeposit:'Your deposit', optCustom:'Other amount', fStopD:'Stop distance, $', fTpD:'Target distance, $',
  kProjLot:'Project lot', kPerDollar:'Per $1 gold move', kProfit:'Profit at target',
  sizeIntro2:'Lot sizes follow the project’s volumes for your deposit. Set how far your stop and target are — see exactly what’s at stake.',
  sizeWide:'At the project lot this stop risks {p}% of your deposit — above 2%. Use a tighter, logical stop or skip the trade.',
  sizeOk:'This stop risks {p}% of your deposit — within the project’s risk rules.', volFoot:'XAUUSD, 100 oz per lot. Project volumes:',
  artLbl:'Quick guide', artOpen:'Open lesson: {l}',
  hoLbl:'Personal help', hoTitle:'Let’s sort this out together', hoText:'Looks like the platform part is tricky. Our manager will walk you through it personally.',
  art_losing_streak_q:'I keep losing', art_losing_streak_t:'Several losses in a row?', art_losing_streak_b:'Losing streaks happen to every trader — even a good strategy has 5–8 losses in a row. Cut your risk to 0.5–1% per trade, stop after two losses a day, and review the last 10 trades in your journal before the next one.',
  art_stop_hit_q:'My stop always gets hit', art_stop_hit_t:'Stop hit, then price reverses?', art_stop_hit_b:'Usually the stop is too tight for gold’s normal noise, or sits right at an obvious level. Place it beyond structure plus 0.5–1× ATR — and shrink the lot so the dollar risk stays the same.',
  art_how_much_q:'How much to start with?', art_how_much_t:'How much should I start with?', art_how_much_b:'Only money you can afford to lose. What matters more than the amount is the rule: risk 1% per trade. The calculator shows the project lot for $250, $1,000 and $10,000.',
  art_margin_call_q:'Margin call / stop out', art_margin_call_t:'Margin call or stop out?', art_margin_call_b:'It means the position was too big for the account. Leverage isn’t the problem — size is. Size every trade from your stop and 1% risk, and never have more than ~3% at risk at once.',
  art_revenge_q:'I want to win it back', art_revenge_t:'Want to win it back right now?', art_revenge_b:'That’s revenge trading — the fastest way from −1R to −8R. Close the platform for today. The market will be there tomorrow; your capital needs to be too.',
  art_overtrading_q:'I trade too much', art_overtrading_t:'Trading too often?', art_overtrading_b:'Cap it at 3 trades a day, trade only in your window (London / New York open), and use price alerts instead of staring at the chart.',
  art_news_q:'Price jumped on news', art_news_t:'Crazy spike on news?', art_news_b:'NFP, CPI and FOMC move gold $20–50 in minutes; spreads widen and stops slip. No new entries 15 minutes before and after high-impact USD news.',
  art_copy_q:'How does copying work?', art_copy_t:'How does copy trading work?', art_copy_b:'You follow the trades of an experienced trader — manually or automatically. Keep your own risk settings: allocation, 0.5–1% per trade, an equity stop. Past results don’t guarantee future ones.',
  intro_foundations:'Everything I do on a chart sits on these basics. This block is what every trader should know before the first real trade.',
  intro_chart:'I don’t use 10 indicators. Levels, structure and one or two tools — that’s what I read on every gold chart before a trade.',
  intro_risk:'My challenge from $10k to $1M only works because of this block. I can be wrong often — I just can’t afford to be wrong big.',
  intro_gold:'Gold is my market. These are the moves and the hours I actually trade — the same ones you see in the club.',
  intro_system:'Every trade I post in the club goes through this checklist first. Build yours here.',
  intro_mindset:'The hardest part isn’t the chart, it’s your head. This is the part that keeps you in the game long enough to get good.'
});
