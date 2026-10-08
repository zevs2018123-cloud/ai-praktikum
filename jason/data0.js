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
    {step:'3', t:'Practise a strategy', d:'Ours is scalping on gold with signals from the project’s traders. One clear set of rules, repeated until it is automatic.'},
    {step:'4', t:'Find a mentor', d:'Someone who already walked the path and catches your mistakes before they cost you money. More on this in lesson 4.'},
    {task:'Write down your goal in one line: the amount and what it is for. Keep it where you will see it before every trading session.'}
  ]},

  { title:'The math behind 100x', min:4, body:[
    '"100x" sounds like a fantasy. It is not magic — it is compounding plus time. Here is what the numbers actually look like.',
    {h:'How compounding works'},
    'If the account grows by a percentage every month, you keep the profit in and raise the lot as the balance grows, each month you earn on a bigger balance. Slow at the start, fast at the end.',
    {h:'What our signals show'},
    {list:[
      '<b>Strategy:</b> scalping on gold (XAUUSD), signals from the project’s traders.',
      '<b>Return:</b> on average about <b>30% a month</b> on the deposit.',
      '<b>Accuracy:</b> 70–80% — out of 10 trades, 2–3 close at the stop. That is normal and built into the strategy.',
      '<b>Lot:</b> 0.03 for every $250 of deposit.'
    ]},
    {table:{head:['Path at ~30% a month','Growth','Time'], rows:[['$250 → $2,500','×10','~9 months'],['$1,000 → $100,000','×100','~1.5 years'],['$10,000 → $1,000,000','×100','~1.5 years'],['$250 → $1,000,000','×4000','~2.7 years']]}},
    {note:'These are the signals’ past statistics, not a guarantee. Some months are weaker, some end in a loss — and 30% only compounds on an account that survives the bad streaks. That is why the rules in the next lesson come first.'},
    {task:'Open Tools → Compounding, put in your start amount, your goal and 30% a month. Look at how many months it takes.'}
  ]},

  { title:'How not to blow the account on day one', min:5, body:[
    'Most new traders do not lose because their idea was wrong. They lose because one trade was too big. These rules exist so your account lives long enough to grow.',
    {h:'The 4 rules of survival'},
    {step:'1', t:'Lot: 0.03 for every $250', d:'The project standard for our scalping signals. $500 → 0.06, $1,000 → 0.12. Not more — not even after a winning streak.'},
    {step:'2', t:'Always a stop loss', d:'Decided before entry, never moved further away. A stop is the price of being wrong — pay it and move on.'},
    {step:'3', t:'Short stop — small risk', d:'At 0.03 lot every $1 move in gold = $3. A scalping stop of $1.5–2 means risking $4.5–6 — about 2% of a $250 account.'},
    {step:'4', t:'Two losses — done for the day', d:'With 70–80% accuracy, 2–3 losing trades out of 10 are normal. The urge to win them back is the most expensive feeling in trading.'},
    {h:'Why this is the foundation of 100x'},
    'Compounding only works on an account that still exists. Every rule above trades a little speed for a lot of survival — and survival is what turns a small start into a big number.',
    {task:'Open Tools → Position size. Pick $250 and a $2 stop on gold: you will see the 0.03 lot and a risk of about $6 — that is one trade by the project rules.'}
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
    'Inside the club you get the VIP signals — scalping on gold, on average about 30% a month with 70–80% accuracy — live trade breakdowns and the full academy: 20+ lessons from the basics to a complete trading system. It was built by a whole team: the head strategist and the best students of the project.',
    {note:'How to get in: top up your broker account with <b>at least $250</b> — that is the minimum for VIP signals (lot 0.03). Send us the proof (a screenshot or the account number), a manager confirms it and the club opens.'},
    {warn:'Trading CFDs with leverage carries a high risk of losing money. The signals’ past results do not guarantee future results; goals and examples are not promises. Only trade money you can afford to lose.'}
  ]}
]};
