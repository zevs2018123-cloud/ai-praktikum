/* Base course — 4 free lessons that open after broker registration.
   Goal: show the path is real when you trade by the rules, and lead to the club (deposit → full academy).
   RU translation: lang/ru.js → I18N.ru.courses.base (same number of body blocks per lesson). */
var COURSE_BASE = { id:'base', blockId:'start', icon:'trend', name:'Base course: your path to 100x', base:true, quiz:[], lessons:[

  { title:'Mindset and your roadmap', min:4, body:[
    'Every result in trading starts with one thing: a goal. Not "make some money", but a number and a reason. The goal is the engine — it is what keeps you disciplined on the days the market tests you.',
    {h:'Why the goal matters'},
    'A trader without a goal takes random trades, risks random amounts and quits after the first bad week. A trader with a goal asks one question before every trade: does this bring me closer, or does it put the account at risk?',
    {note:'The 100x idea: Jason is turning $10,000 into $1,000,000 in the open — that is 100x. It does not come from one lucky trade. It comes from hundreds of disciplined trades and time.'},
    {h:'Your roadmap — 4 steps'},
    {step:'1', t:'Choose a broker', d:'Done — you opened an account. That is where you will trade.'},
    {step:'2', t:'Get the knowledge', d:'This base course, then the full academy: how the market moves, where to enter, where to exit, how much to risk.'},
    {step:'3', t:'Practise a strategy', d:'One clear set of rules, repeated until it is automatic. Not ten strategies — one that you understand.'},
    {step:'4', t:'Find a mentor', d:'Someone who already walked the path and catches your mistakes before they cost you money. More on this in lesson 4.'},
    {task:'Write down your goal in one line: the amount and what it is for. Keep it where you will see it before every trading session.'}
  ]},

  { title:'The math behind 100x', min:4, body:[
    '"100x" sounds like a fantasy. It is not magic — it is compounding plus time. Here is what the numbers actually look like.',
    {h:'How compounding works'},
    'If an account grows a few percent per month and you keep the profit in, every month you earn on a bigger balance. Slow at the start, fast at the end.',
    {table:{head:['Monthly growth','×10','×100'], rows:[['5% per month','~4 years','~8 years'],['10% per month','~2 years','~4 years']]}},
    {h:'What this means for you'},
    {list:[
      '<b>$1,000 → $100,000</b> is 100x — the same distance as Jason’s challenge, just from a smaller start.',
      '<b>$10,000 → $1,000,000</b> is Jason’s path. He is doing it in public, trade by trade.',
      'You do not have to follow this pace. The point is not speed — the point is that the account survives long enough to compound.'
    ]},
    {note:'The fastest way to never reach 100x is to try to do it in one month. Accounts that chase speed blow up; accounts that respect risk keep growing.'},
    {task:'Open Tools → Compounding and put in your start amount and your goal. Look at how many months it takes at 5% and at 10%.'}
  ]},

  { title:'How not to blow the account on day one', min:5, body:[
    'Most new traders do not lose because their idea was wrong. They lose because one trade was too big. These rules exist so your account lives long enough to grow.',
    {h:'The 4 rules of survival'},
    {step:'1', t:'Risk 1–2% per trade', d:'If the stop is hit, you lose a small, planned amount. Ten losses in a row still leave 80–90% of the account.'},
    {step:'2', t:'Always a stop loss', d:'Decided before entry, never moved further away. A stop is the price of being wrong — pay it and move on.'},
    {step:'3', t:'Position size from the stop', d:'Not "I feel like 1 lot". Distance to stop + 1% risk = lot size. The calculator does it for you.'},
    {step:'4', t:'Two losses — done for the day', d:'The urge to win it back is the most expensive feeling in trading.'},
    {h:'Why this is the foundation of 100x'},
    'Compounding only works on an account that still exists. Every rule above trades a little speed for a lot of survival — and survival is what turns a small start into a big number.',
    {task:'Open Tools → Position size. Enter your deposit and a $5 stop on gold. Note the lot size — that is what 1% risk looks like for you.'}
  ]},

  { title:'Why you need a mentor — and the club', min:5, body:[
    'You now know the goal, the math and the survival rules. The honest truth: knowing the rules and following them under pressure are two different things.',
    {h:'Where people actually lose money'},
    'People are emotional. A loss makes you want to win it back; a win makes you feel invincible. Most beginners lose their deposit on mistakes that could have been avoided — overtrading, moving stops, trading the news, trading without a plan.',
    {h:'Why a mentor is the logical path'},
    {list:[
      '<b>Someone checks your decisions</b> before the market does.',
      '<b>You copy a working process</b> instead of inventing one with your own money.',
      '<b>You stay in the game longer</b> — and staying in the game is the whole point. Our goal is that you trade for years, not that you blow the account in a week.'
    ]},
    {h:'The private club'},
    'Inside the club you get Jason’s trading signals, live trade breakdowns and the full academy — 20+ lessons from the basics to a complete trading system. It was built by a whole team: the head strategist and the best students of the project.',
    {note:'How to get in: top up your broker account with any amount and send us the proof (a screenshot or the account number). A manager confirms it and the club opens.'},
    {warn:'Trading CFDs with leverage carries a high risk of losing money. Goals and examples are not promises of results. Only trade money you can afford to lose.'}
  ]}
]};
