/* Block 5 — System · Block 6 — Mindset & the long game · wiring */

var COURSE_PLAN = { id:'plan', blockId:'system', icon:'plan', name:'Your Trading Plan', lessons:[

  { title:'The pre-trade checklist', min:4, body:[
    'Pilots run a checklist before every take-off, no matter how many thousands of hours they have. Not because they forget — because pressure makes everyone skip steps. Trading is the same.',
    {h:'A checklist you can copy'},
    {formula:'□ Higher-timeframe trend / bias noted\n□ Price at a marked level (not in the middle of nowhere)\n□ Setup matches my playbook (which one?)\n□ Confirmation candle closed\n□ No high-impact news in the next 30 min\n□ Stop beyond structure + ATR buffer\n□ Target gives at least 1:2\n□ Lot by project rules: 0.03 per $250, stop ≤ $2\n□ Total open risk within my limit\n□ I am calm, not chasing or revenge-trading', label:'Pre-trade checklist', copy:true},
    'If one box is empty, there is no trade. It sounds rigid. It is supposed to be — the checklist is you, calm, protecting you, excited.',
    {note:'Most of your edge comes from the trades you <b>don\'t</b> take. The checklist is a filter that removes the worst 50% of impulses.'},
    {task:'Copy the checklist into your notes app and edit it to fit your style. Use it on every demo trade this week — including the ones you decide to skip.'}
  ]},

  { title:'The trading journal', min:4, body:[
    'Without a journal you have opinions about your trading. With one you have data. Every consistently profitable trader keeps some version of it.',
    {h:'What to log for every trade'},
    {list:[
      'Date, time, session, instrument, direction',
      'Setup name (from your playbook)',
      'Entry, stop, target, lot size, risk in $ and %',
      'Result in R (e.g. −1R, +2.3R)',
      'Screenshot of the chart at entry and at exit',
      'One line: how you felt and whether you followed the plan'
    ]},
    {h:'The weekly review'},
    'Every weekend, 20 minutes:',
    {step:1, t:'Total R for the week', d:'Not dollars — R. It shows performance independent of size.'},
    {step:2, t:'Rules followed?', d:'Mark each trade: plan followed / broken. Compare the results of both groups. This is usually the most eye-opening number.'},
    {step:3, t:'Best and worst setup', d:'Which setup made the most R? Which lost the most? Do more of one, less of the other.'},
    {step:4, t:'One change', d:'Pick exactly one thing to improve next week. Not five.'},
    {note:'After 50–100 logged trades you\'ll know your win rate, your average R, your best session and your worst habit. That is the moment trading stops being guessing.'},
    {task:'Create your journal today — a simple spreadsheet is fine. Log your last 5 demo trades in it, including a screenshot for each.'}
  ]},

  { title:'Expectancy: is your strategy any good?', min:4, body:[
    'A strategy can win 70% of the time and lose money. Another can win 35% and make plenty. The number that decides it is <b>expectancy</b> — how much you make or lose per trade, on average, in R.',
    {formula:'Expectancy = (Win rate × Avg win) − (Loss rate × Avg loss)\n\nExample: 40% wins at 2.5R, 60% losses at 1R\n= 0.40 × 2.5 − 0.60 × 1 = +0.40R per trade', label:'Expectancy', copy:true},
    '+0.4R per trade means that, over many trades, each one is worth 0.4 × your risk. At $10 risk, 100 trades ≈ +$400 — if you execute consistently and the edge holds.',
    {h:'Why it needs a sample'},
    'Twenty trades can look great or terrible by pure luck. You need at least 50–100 trades of the <b>same</b> setup, executed the same way, before the numbers mean much.',
    {warn:'Expectancy must include costs: spread, commission, swap, slippage. A strategy that makes +0.05R before costs often makes nothing after them — especially on short timeframes with many trades.'},
    {task:'From your journal, calculate your current win rate, average win in R and average loss in R. What is your expectancy? How many trades is it based on?'}
  ]}

], quiz:[
  {q:'If one box on your checklist is empty, you…', opts:['Don\'t take the trade','Take it with half size','Take it if you feel confident'], correct:0, explain:'The checklist is binary by design.'},
  {q:'Why log results in R rather than dollars?', opts:['R shows performance independent of position size','Dollars are illegal to log','R is always positive'], correct:0, explain:'R normalises results across different sizes.'},
  {q:'The most useful comparison in a weekly review is often…', opts:['Trades where you followed the plan vs trades where you didn\'t','Your P/L vs a friend\'s','Monday vs Friday screenshots'], correct:0, explain:'It shows the cost of breaking your own rules.'},
  {q:'40% win rate, avg win 2.5R, avg loss 1R. Expectancy?', opts:['+0.4R','−0.4R','+1.5R'], correct:0, explain:'0.4 × 2.5 − 0.6 × 1 = 0.4.'},
  {q:'A 70% win rate strategy can still lose money if…', opts:['Average losses are much bigger than average wins','It is used on gold','The journal is on paper'], correct:0, explain:'Win rate alone says nothing without win/loss size.'},
  {q:'Roughly how many trades before expectancy means much?', opts:['50–100 of the same setup','5','One good week'], correct:0, explain:'Small samples are dominated by luck.'}
]};

var COURSE_PSYCH = { id:'psych', blockId:'mindset', icon:'brain', name:'Trader Psychology', lessons:[

  { title:'FOMO and revenge trading', min:4, body:[
    'Two emotions destroy more accounts than any bad strategy. Both feel completely rational in the moment.',
    {h:'FOMO — fear of missing out'},
    'Gold rips $25 in ten minutes, and you buy near the top because "it\'s going to keep going". Signs you are in FOMO:',
    {list:[
      'You\'re entering a move that already happened, not a level you planned.',
      'You skip the checklist "just this once".',
      'You size up because it "looks obvious".'
    ]},
    'The antidote: the market gives new setups every single day. Missing one costs you nothing. Chasing one costs you money.',
    {h:'Revenge trading'},
    'You take a loss, feel wronged by the market, and immediately open another trade — bigger — to "win it back". Then a third. This is how −1R becomes −8R in an afternoon.',
    {step:1, t:'Name it', d:'Say it out loud: "I want to make it back." Naming the emotion weakens it.'},
    {step:2, t:'Hard rule after losses', d:'After 2 losses in a row, stop for the day. No debate.'},
    {step:3, t:'Change your state', d:'Close the platform, walk for 15 minutes. The chart will be there tomorrow.'},
    {note:'The market doesn\'t know you exist and doesn\'t owe you anything. A loss isn\'t a debt to collect — it\'s a business expense you already budgeted with your 1%.'},
    {task:'Write your personal "stop rule" (e.g. two losses in a row = done for the day) and add it to your checklist.'}
  ]},

  { title:'Overtrading and the boredom trap', min:4, body:[
    'More trades doesn\'t mean more money. Past a point, it means more spread, more mistakes and a slow bleed.',
    {h:'Signs you are overtrading'},
    {list:[
      'You take trades because you\'re at the screen, not because there\'s a setup.',
      'Your number of trades per week keeps rising, your R per trade keeps falling.',
      'You trade outside your planned sessions — late at night, on thin markets.'
    ]},
    {h:'Fixes that work'},
    {step:1, t:'Cap the count', d:'Maximum trades per day (for example, 3). Once you hit it, you\'re done.'},
    {step:2, t:'Trade windows', d:'Decide your hours — say, the London open and the New York open. Outside them, charts closed.'},
    {step:3, t:'Alerts instead of staring', d:'Set price alerts at your levels and walk away. Come back when price does.'},
    {note:'Good trading is mostly boring: waiting, checking, skipping. If it feels like a casino, something is off.'},
    {task:'Set your trade cap and trade windows. Put price alerts on your 3 key gold levels instead of watching the chart.'}
  ]},

  { title:'The math of the long game', min:5, body:[
    'Every trading channel shows the big goal — turning a small account into a large one. Here\'s the honest math behind it, because knowing it is what makes the journey survivable.',
    {h:'Compounding is powerful — and slow'},
    {table:{ head:['Steady monthly return','Time for $1k → $100k'], rows:[
      ['3% / month','≈ 13 years'],['5% / month','≈ 8 years'],['10% / month','≈ 4 years'],['20% / month','≈ 2 years']
    ]}},
    'And those numbers assume <b>every month</b> is positive, with zero losing months. For context: the best professional funds in the world are happy with 15–25% <b>a year</b>.',
    {tool:'comp', t:'Try the compounding calculator'},
    {h:'What this means for you'},
    {list:[
      'Big targets are reached by <b>consistency plus adding capital over time</b> — not by one hero trade.',
      'Risking 10–20% per trade to "get there faster" mostly gets you to zero faster (see the drawdown table).',
      'Your first year\'s real goal: follow your rules, keep drawdowns small, and build a journal that proves you have an edge.'
    ]},
    {warn:'Anyone promising you fixed monthly returns, "guaranteed" profits or a system that never loses is either mistaken or selling something. Real trading has losing weeks and losing months — including for the best.'},
    {note:'This is exactly why the academy is built risk-first. Staying in the game long enough is the edge most people never get to use.'},
    {task:'Write down a realistic 12-month goal that is about process, not money — e.g. "100 journaled trades, never more than 1% risk, max drawdown under 10%".'}
  ]}

], quiz:[
  {q:'A typical sign of FOMO is…', opts:['Entering a move that already happened, skipping your checklist','Waiting for your level','Using a stop loss'], correct:0, explain:'Chasing unplanned moves is classic FOMO.'},
  {q:'What is revenge trading?', opts:['Trading bigger right after a loss to win it back','Taking a planned trade after a win','Journaling your losses'], correct:0, explain:'It turns small losses into big ones.'},
  {q:'A good rule after two losses in a row is…', opts:['Stop for the day','Double the size on the next trade','Remove stop losses'], correct:0, explain:'A hard stop rule protects you from tilt.'},
  {q:'Which is a sign of overtrading?', opts:['Taking trades because you\'re at the screen, not because of a setup','Using price alerts','Trading only in your planned window'], correct:0, explain:'Boredom trades are overtrading.'},
  {q:'At a steady 10% per month, $1k → $100k takes roughly…', opts:['4 years','4 months','40 years'], correct:0, explain:'ln(100) / ln(1.1) ≈ 48 months.'},
  {q:'Top professional funds are typically happy with…', opts:['15–25% a year','15–25% a week','100% a month'], correct:0, explain:'Keeps expectations grounded.'},
  {q:'A realistic first-year goal is best framed around…', opts:['Process: rules followed, risk kept, trades journaled','A specific dollar amount by any means','Beating other traders\' screenshots'], correct:0, explain:'Process goals are within your control.'}
]};

var COURSE_COPY = { id:'copy', blockId:'mindset', icon:'copy', name:'Copy Trading & Signals', lessons:[

  { title:'How copy trading and signals work', min:4, body:[
    'Not everyone wants to analyse charts for hours. Copy trading and signal services let you follow another trader\'s positions. Done right, it\'s a way to learn from real trades. Done blindly, it\'s outsourcing your risk to a stranger.',
    {h:'Two ways it works'},
    {list:[
      '<b>Signals</b> — the trader posts entry, stop and target; you place the trade yourself. You control timing and size.',
      '<b>Automatic copy trading</b> — your account mirrors their trades through the broker\'s copy platform, scaled to your balance by a multiplier you set.'
    ]},
    {h:'What you are really buying'},
    'Not "profits". You\'re buying access to someone\'s process: their entries, their risk rules and — if they\'re good — their explanations. The best use of a signal is to understand <b>why</b> it was taken, so every trade is also a lesson.',
    {note:'Everything you learned still applies when you copy: your risk per trade, your daily limit, your max open risk. A signal doesn\'t change the math of drawdown.'},
    {task:'For the next 5 signals or copied trades you see, write down the setup type from this academy that each one matches (trend pullback, sweep, breakout-retest…). If you can\'t match it, ask why.'}
  ]},

  { title:'How to check any signal provider', min:5, body:[
    'Screenshots of winning trades are free to make. Before you follow anyone — including us — check these things.',
    {h:'The checklist'},
    {step:1, t:'Verified, long track record', d:'Months, ideally a year or more, on a third-party-verified account (e.g. a broker\'s copy platform stats or a verification site) — not screenshots.'},
    {step:2, t:'Maximum drawdown', d:'How deep has the account ever fallen? A 60% drawdown means you would have needed to survive losing more than half.'},
    {step:3, t:'Losing trades are shown', d:'Every real trader has losses. If you only ever see wins, you\'re seeing marketing.'},
    {step:4, t:'Stops on every trade', d:'Signals without a stop loss are a red flag, full stop.'},
    {step:5, t:'Risk per trade is stated', d:'You need to know how much of the account each trade risks to scale it to yours.'},
    {step:6, t:'No guarantees', d:'"Guaranteed", "risk-free" and fixed monthly returns are signs to walk away.'},
    {warn:'Past performance does not guarantee future results. Even a great provider will have losing months — the question is whether you can survive them with your settings.'},
    {task:'Pick any signal provider you follow. Run them through all 6 steps and write the answer to each. Which ones could you not verify?'}
  ]},

  { title:'Setting up copying safely', min:4, body:[
    'If you do copy, the settings matter more than the provider\'s win rate. Here\'s how to set it up so a bad month is a bad month, not the end of your account.',
    {h:'Settings to decide before you start'},
    {list:[
      '<b>Allocation</b> — only a portion of your capital goes to copying; keep the rest separate.',
      '<b>Multiplier / size</b> — scale so that each copied trade risks roughly the same 0.5–1% of <b>your</b> allocation.',
      '<b>Equity stop</b> — most copy platforms let you set a level (e.g. −20% of the allocation) at which copying stops automatically. Use it.',
      '<b>Review date</b> — decide now when you\'ll evaluate (e.g. after 3 months), and don\'t judge it after one week.'
    ]},
    {h:'Learn while you copy'},
    'Put each copied trade in your journal just like your own. After a few months you\'ll understand the strategy well enough to judge it — and maybe trade parts of it yourself.',
    {note:'Jason\'s private club posts trades with the reasoning behind them so you can do exactly this: follow along, check the setup against what you learned here, and build your own judgement.'},
    {task:'Write your copy-trading settings on one line: allocation, risk per trade, equity stop, review date. If you can\'t fill in all four, you\'re not ready to copy yet.'}
  ]}

], quiz:[
  {q:'With manual signals, who controls size and timing?', opts:['You do','The signal provider','The broker'], correct:0, explain:'You place the trade yourself.'},
  {q:'What is the best use of a signal for learning?', opts:['Understanding why the trade was taken','Copying it without looking','Ignoring its stop'], correct:0, explain:'Each signal is a case study.'},
  {q:'The most important performance number to check first is…', opts:['Maximum drawdown on a verified account','Number of Instagram followers','Win rate on screenshots'], correct:0, explain:'Drawdown tells you what you\'d have had to survive.'},
  {q:'A provider shows only winning trades. That suggests…', opts:['You\'re seeing marketing, not the full record','They never lose','They use a secret indicator'], correct:0, explain:'Every real trader has losses.'},
  {q:'What does an equity stop on a copy platform do?', opts:['Stops copying automatically at a set loss level','Guarantees profits','Removes the spread'], correct:0, explain:'It caps how much the copy allocation can lose.'},
  {q:'"Guaranteed 20% a month" is…', opts:['A red flag','A normal professional return','Required by regulators'], correct:0, explain:'No legitimate trading offers guaranteed returns.'}
]};

/* ---------------- structure ---------------- */
var BLOCKS = [
  { id:'start',       num:0, name:'Base course', level:'free after registration' },
  { id:'foundations', num:1, name:'Foundations', level:'beginner' },
  { id:'chart',       num:2, name:'Reading the Chart', level:'beginner → mid' },
  { id:'risk',        num:3, name:'Risk Management', level:'core' },
  { id:'gold',        num:4, name:'Trading Gold', level:'mid' },
  { id:'system',      num:5, name:'Your System', level:'mid → pro' },
  { id:'mindset',     num:6, name:'Mindset & the Long Game', level:'pro', soon:['Live trade breakdowns with Jason','Prop firm challenges: rules & risk'] }
];

var COURSES = [
  COURSE_BASE,
  COURSE_101, COURSE_CHART,
  COURSE_SR, COURSE_IND,
  COURSE_RISK,
  COURSE_GOLD, COURSE_PLAYBOOK,
  COURSE_PLAN,
  COURSE_PSYCH, COURSE_COPY
];

/* Home-screen "rule of the day" — rotates daily */
var TIPS = [
  { ico:'🛡️', t:'Risk is decided before entry', d:'Stop location from the chart, risk % from your rules, lot size from the calculator. In that order.' },
  { ico:'🧯', t:'Never widen a stop', d:'A stop moved further away turns a planned loss into an unplanned one.' },
  { ico:'📅', t:'Check the calendar first', d:'NFP, CPI and FOMC can move gold $30 in a minute. Know when they are before you trade.' },
  { ico:'⏳', t:'No setup, no trade', d:'Missing a move costs nothing. Chasing one costs money.' },
  { ico:'🧊', t:'Two losses, done for the day', d:'The urge to "win it back" is the most expensive feeling in trading.' },
  { ico:'📓', t:'Journal every trade', d:'Without data you have opinions. With data you have an edge — or proof you don\'t yet.' },
  { ico:'📐', t:'Think in R', d:'"I lost 1R" keeps your head clear in a way "I lost $80" doesn\'t.' },
  { ico:'🌍', t:'Mind the session', d:'Gold wakes up at the London and New York opens. Late-night breakouts fail more often.' },
  { ico:'💵', t:'Watch the dollar', d:'Keep DXY next to your gold chart — they often move in opposite directions.' },
  { ico:'🔍', t:'Zones, not lines', d:'Price reacts around areas. A $1 poke through a level is not a breakout.' }
];
