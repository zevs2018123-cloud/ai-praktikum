/* Block 3 — Risk management · Block 4 — Trading gold (XAUUSD) */

var COURSE_RISK = { id:'risk', blockId:'risk', icon:'shield', name:'Risk First', lessons:[

  { title:'The 1% rule and position sizing', min:5, body:[
    'This is the most important lesson in the academy. Strategies come and go; the traders who survive long enough to get good all share one habit — they decide what they can lose <b>before</b> they enter.',
    {h:'The rule'},
    'Risk a small, fixed percentage of your account per trade — most professionals use <b>0.5–2%</b>, and 1% is the classic starting point. On a $1,000 account, 1% is $10. That is the most you lose if your stop is hit. Not "about $10". Exactly $10.',
    {h:'Why so small?'},
    'Because losing streaks are normal. Even a good strategy that wins 55% of the time will regularly hit 5–8 losses in a row. Look at what that does:',
    {table:{ head:['Losses in a row','Risk 1%','Risk 5%','Risk 10%'], rows:[
      ['5','−4.9%','−22.6%','−41.0%'],
      ['8','−7.7%','−33.7%','−57.0%'],
      ['10','−9.6%','−40.1%','−65.1%']
    ]}},
    'At 1%, a bad streak is an annoying week. At 10%, it ends the account.',
    {h:'From risk to lot size'},
    {formula:'Lots = (Balance × Risk%) ÷ (Stop distance × $ per unit per lot)\n\nGold, $1,000 account, 1% risk, stop $5 away:\n$10 ÷ ($5 × 100) = 0.02 lots', label:'Position size formula', copy:true},
    'Notice what happens: the stop is decided by the chart (where your idea is wrong), the risk is decided by your rule, and the lot size is just the result. You never pick the lot size first.',
    {tool:'size', t:'Open the position size calculator'},
    {warn:'If the correct size comes out below your broker\'s minimum (usually 0.01 lots), the trade is too big for your account. Skip it — don\'t "round up" your risk.'},
    {task:'Take your planned live balance. Calculate your 1% in dollars. Then use the calculator for a gold trade with a $4 stop and a $10 stop. Write down both lot sizes.'}
  ]},

  { title:'Stop losses and reward-to-risk', min:5, body:[
    'A stop loss is not an admission of defeat. It is the price at which your trade idea is proven wrong — and the order that gets you out automatically, even if you\'re asleep or frozen.',
    {h:'Where the stop goes'},
    {list:[
      '<b>Beyond structure</b> — below the higher low you\'re buying, above the lower high you\'re selling.',
      '<b>Plus a volatility buffer</b> — a fraction of ATR, so normal noise doesn\'t tag you.',
      '<b>Never</b> at a random dollar amount because "$5 feels right".'
    ]},
    {h:'Reward-to-risk (R:R)'},
    'If you risk $10 to make $20, your R:R is 1:2. The math that follows is what makes trading a business rather than a coin flip:',
    {table:{ head:['R:R','Win rate needed to break even'], rows:[
      ['1 : 1','50%'],['1 : 1.5','40%'],['1 : 2','33%'],['1 : 3','25%']
    ]}},
    'At 1:2 you can be wrong on two out of three trades and still not lose money (before costs). Many good traders win less than half their trades.',
    {h:'Three rules for stops'},
    {step:1, t:'Set it before you enter', d:'Every trade goes in with a stop. No exceptions, including "just a quick scalp".'},
    {step:2, t:'Never widen it', d:'Moving a stop further away to avoid a loss turns a small, planned loss into a big, unplanned one.'},
    {step:3, t:'Tighten only by plan', d:'Moving the stop to break-even or trailing it behind new structure is fine — if your plan says when.'},
    {note:'Think in R, not dollars. "I lost 1R" and "I made 2.5R" keep your head clear, whatever the account size.'},
    {task:'Review any 5 trades (demo or past). For each: where was the stop, was it beyond structure, and what R:R did the trade offer? If there was no stop, write down what it should have been.'}
  ]},

  { title:'Drawdown: why losses hurt more than gains help', min:4, body:[
    'Drawdown is how far your account has fallen from its peak. It is the number that decides whether you stay in the game.',
    {h:'The asymmetry'},
    {table:{ head:['Loss','Gain needed to recover'], rows:[
      ['−10%','+11.1%'],['−20%','+25%'],['−30%','+42.9%'],['−50%','+100%'],['−75%','+300%']
    ]}},
    'Lose half and you need to <b>double</b> what\'s left just to get back to where you were. That is why protecting capital beats chasing returns.',
    {tool:'dd', t:'Play with the drawdown calculator'},
    {h:'Circuit breakers'},
    'Professionals have hard limits that stop them trading before a bad day becomes a disaster:',
    {list:[
      '<b>Daily loss limit</b> — e.g. −3% in a day, you stop until tomorrow.',
      '<b>Weekly loss limit</b> — e.g. −6% in a week, you stop and review.',
      '<b>Max open risk</b> — never more than e.g. 3% at risk across all open trades at once.'
    ]},
    {h:'Correlation hides risk'},
    'Buying gold and selling USDJPY at the same time can be the same bet twice — both are often driven by the dollar. Two 1% trades on correlated instruments can behave like one 2% trade.',
    {warn:'The most dangerous moment is right after a big loss, when you want to "make it back" quickly. That impulse has a name — revenge trading — and we cover it in the psychology course. Your daily limit exists for exactly that moment.'},
    {task:'Write your own three circuit breakers (daily limit, weekly limit, max open risk) on a note and put it where you trade. These are now rules, not suggestions.'}
  ]}

], quiz:[
  {q:'With a $1,000 account and 1% risk, your max loss per trade is…', opts:['$10','$100','$1'], correct:0, explain:'1% of $1,000 is $10.'},
  {q:'What do you decide first?', opts:['Stop location and risk %, then lot size follows','Lot size, then the stop','Take profit, then everything else'], correct:0, explain:'Lot size is the output of risk ÷ stop distance.'},
  {q:'Gold, $2,000 account, 1% risk, stop $4 away (100 oz/lot). Lot size?', opts:['0.05','0.5','0.02'], correct:0, explain:'$20 ÷ ($4 × 100) = 0.05 lots.'},
  {q:'At 1:2 reward-to-risk, the break-even win rate is about…', opts:['33%','50%','66%'], correct:0, explain:'Win 1 × 2R pays for 2 × 1R losses.'},
  {q:'Price is approaching your stop. The right move is…', opts:['Let the stop do its job','Move the stop further away','Remove the stop and wait'], correct:0, explain:'Widening stops turns planned losses into big ones.'},
  {q:'After a 50% drawdown, what gain do you need to recover?', opts:['100%','50%','25%'], correct:0, explain:'Half the capital must double to return to the start.'},
  {q:'Why can gold long + USDJPY short be riskier than it looks?', opts:['Both can be driven by the dollar — effectively one bigger bet','They are traded at different times','Gold can\'t be traded with JPY pairs'], correct:0, explain:'Correlated trades stack risk.'}
]};

var COURSE_GOLD = { id:'gold', blockId:'gold', icon:'gold', name:'Trading Gold (XAUUSD)', lessons:[

  { title:'What moves gold', min:5, body:[
    'Gold is not a company with earnings. Its price reacts to money, fear and the dollar. Knowing the drivers stops you being surprised by moves that were obvious to everyone reading the news.',
    {h:'The main drivers'},
    {step:1, t:'The US dollar', d:'Gold is priced in dollars. When the dollar strengthens, gold often weakens, and vice versa. Watch the dollar index (DXY) next to your gold chart.'},
    {step:2, t:'Real interest rates', d:'Gold pays no interest. When real yields (rates minus inflation) rise, holding gold costs more in missed income — pressure on gold. When real yields fall, gold tends to benefit.'},
    {step:3, t:'Fear and uncertainty', d:'War, banking stress, market crashes — gold is the classic safe haven. Risk-off headlines can move it $20–50 in minutes.'},
    {step:4, t:'Central banks and big buyers', d:'Central-bank gold buying has been a major source of demand in recent years and supports the longer-term picture.'},
    {step:5, t:'Inflation expectations', d:'Gold is widely seen as a store of value, so rising inflation fears can attract buyers.'},
    {note:'These relationships are tendencies, not laws. There are periods when gold and the dollar rise together. Use the drivers to understand context — let the chart tell you what is actually happening.'},
    {h:'Why gold is popular — and tricky'},
    'Gold moves a lot. Large daily ranges mean opportunity, but also that a sloppy position size hurts fast. A $30 day on gold is ordinary. On one full lot that is $3,000.',
    {task:'Put DXY and XAUUSD side by side on the 4H chart for the last month. Mark 3 moments where they clearly moved in opposite directions, and 1 where they didn\'t.'}
  ]},

  { title:'Sessions: when gold moves', min:4, body:[
    'Gold trades nearly 24 hours a day on weekdays, but it doesn\'t move evenly. Liquidity and volatility come in waves, following the world\'s financial centres.',
    {h:'The three sessions (approx., GMT)'},
    {table:{ head:['Session','Hours (GMT)','Gold behaviour'], rows:[
      ['Asia','00:00–08:00','Usually quieter, builds a range'],
      ['London','07:00–16:00','Volatility picks up, often sweeps the Asian range'],
      ['New York','12:00–21:00','US data at 12:30/13:30 GMT; big moves'],
      ['London–NY overlap','12:00–16:00','Most liquid window of the day']
    ]}},
    'Exact times shift by an hour with daylight saving in the UK and US. Your platform\'s server time may differ from your local time — check once and write down your personal session times.',
    {h:'Using sessions'},
    {list:[
      'Mark the <b>Asian high and low</b> every day. London often runs one of them before choosing a direction.',
      'Expect <b>wider spreads</b> around the daily rollover (late US session) — avoid entering then.',
      'If your strategy needs movement, trade London and New York. Trading Asia with a breakout strategy is a common way to collect fakeouts.'
    ]},
    {task:'For the next 3 days, mark the Asian session high and low on the 15m gold chart. Did London break one of them? Did the break hold or reverse?'}
  ]},

  { title:'News days: NFP, CPI and the Fed', min:5, body:[
    'Some days gold does its normal thing. On other days one number released at a set minute moves it $30 before you can click. You need to know which day is which.',
    {h:'The big three'},
    {list:[
      '<b>NFP (Non-Farm Payrolls)</b> — US jobs report, usually the first Friday of the month, 8:30 New York time.',
      '<b>CPI</b> — US inflation, monthly, 8:30 New York time.',
      '<b>FOMC</b> — the Federal Reserve\'s rate decision, 8 times a year, statement at 2:00 PM New York time, press conference 30 minutes later.'
    ]},
    'Plus: PCE inflation, GDP, jobless claims, Fed speakers — and unscheduled geopolitical headlines.',
    {h:'What happens around news'},
    {step:1, t:'Spreads widen', d:'Seconds before and after the release, spreads can jump several times over.'},
    {step:2, t:'Slippage', d:'Your stop may fill worse than its price when the market gaps through it.'},
    {step:3, t:'Whipsaw', d:'The first move is often reversed within minutes as the market digests the details.'},
    {h:'A simple news policy'},
    {list:[
      'Check an economic calendar every Sunday and every morning. Filter for USD high-impact events.',
      'No new entries from 15 minutes before to 15 minutes after a high-impact release.',
      'Already in a trade? Decide beforehand: close it, reduce it, or hold with the stop in place — and accept the stop may slip.'
    ]},
    {warn:'"Trading the news" — jumping in on the release — is one of the fastest ways to lose money as a beginner. Let the dust settle and trade the structure that forms afterwards.'},
    {links:[
      {n:'Forex Factory calendar', u:'https://www.forexfactory.com/calendar', d:'Free economic calendar; filter by USD and high impact.'}
    ]},
    {task:'Open an economic calendar and list every high-impact USD event this week with its time in YOUR timezone. Pin the list somewhere you\'ll see it before trading.'}
  ]}

], quiz:[
  {q:'When the US dollar strengthens, gold often…', opts:['Weakens','Strengthens every time','Is unaffected'], correct:0, explain:'Gold is dollar-priced; they tend to move inversely.'},
  {q:'Rising real interest rates tend to…', opts:['Pressure gold, since it pays no interest','Always push gold higher','Only affect stocks'], correct:0, explain:'Higher real yields raise the opportunity cost of holding gold.'},
  {q:'Which window is usually the most liquid?', opts:['London–New York overlap','Late Asian session','Friday rollover'], correct:0, explain:'Two major centres open at once = peak liquidity.'},
  {q:'What does London often do to the Asian range?', opts:['Sweep one side of it','Nothing, it ignores it','Close the market'], correct:0, explain:'Asian highs/lows are common targets at the London open.'},
  {q:'NFP is usually released…', opts:['First Friday of the month, 8:30 New York time','Every day at midnight','Only in December'], correct:0, explain:'Mark it every month — it moves gold hard.'},
  {q:'What can happen to your stop during a major release?', opts:['It may fill at a worse price (slippage)','It is always filled exactly','It is disabled by the broker'], correct:0, explain:'Fast markets can gap through stop prices.'},
  {q:'A sensible beginner news policy is…', opts:['No new entries around high-impact releases','Enter right on the release for the big move','Double position size on news days'], correct:0, explain:'Let the dust settle; trade what forms after.'}
]};

var COURSE_PLAYBOOK = { id:'playbook', blockId:'gold', icon:'candle', name:'Gold Setups Playbook', lessons:[

  { title:'Setup 1: trend pullback', min:5, body:[
    'The bread-and-butter setup. It won\'t catch tops and bottoms — it catches the middle of moves, which is where most of the money is.',
    {h:'Conditions'},
    {list:[
      '4H structure is clearly trending (HH/HL for buys, LH/LL for sells).',
      'Price is on the right side of the 50 EMA on the 4H.',
      'Price pulls back into a zone: previous resistance-turned-support, the 20/50 EMA, or both.'
    ]},
    {h:'Execution (long example)'},
    {step:1, t:'Wait for the pullback', d:'Let price come to your zone. No chasing green candles.'},
    {step:2, t:'Wait for rejection', d:'On the 15m–1H, look for a long lower wick or a bullish candle closing back above the zone.'},
    {step:3, t:'Stop', d:'Below the zone / the pullback low, plus a small ATR buffer.'},
    {step:4, t:'Target', d:'The last swing high first. At least 1:2 reward-to-risk, or skip the trade.'},
    {step:5, t:'Size', d:'Calculator: your risk %, your stop distance. Done.'},
    {note:'"No trade" is a position. If the pullback goes straight through your zone without a rejection, the setup didn\'t happen. That\'s the plan working, not failing.'},
    {task:'Find 5 historical trend-pullback setups on the 4H gold chart. For each, mark entry, stop and first target. How many reached 2R before the stop?'}
  ]},

  { title:'Setup 2: the liquidity sweep', min:5, body:[
    'Gold loves to take out an obvious high or low and then reverse. Instead of being the trader who gets swept, you wait for the sweep and trade the reversal.',
    {h:'Conditions'},
    {list:[
      'A clear, obvious level: the Asian range high/low, the previous day\'s high/low, or a double top/bottom.',
      'Price pushes <b>through</b> the level — ideally at the London or New York open.',
      'Then closes <b>back inside</b> on the 15m or 1H. That close is the tell: the breakout failed.'
    ]},
    {h:'Execution (short example after a high is swept)'},
    {step:1, t:'Mark the level before the session', d:'You are not reacting — you are waiting for a specific event.'},
    {step:2, t:'See the sweep and the close back below', d:'No close back inside = no trade.'},
    {step:3, t:'Entry', d:'On the close, or on a small retest of the swept level from below.'},
    {step:4, t:'Stop', d:'Above the sweep high (the wick), plus a buffer.'},
    {step:5, t:'Target', d:'The other side of the range or the next clear level.'},
    {warn:'Sometimes the "sweep" is the real breakout and price keeps going. Your stop above the wick is what makes this setup survivable. Take it every time.'},
    {task:'Over the next week, mark the Asian high/low daily and log each London sweep: did price close back inside? How far did it go in your favour vs against you?'}
  ]},

  { title:'Managing the trade after entry', min:4, body:[
    'Entries get all the attention. Management decides most of your results.',
    {h:'Three common approaches'},
    {step:1, t:'Set and forget', d:'Stop and target placed, you walk away. Simplest, removes emotion, works well for beginners.'},
    {step:2, t:'Partial profit', d:'Close half at 1R or 1.5R, move the stop to break-even, let the rest run to the bigger target. Smoother equity, slightly lower average win.'},
    {step:3, t:'Trailing stop', d:'Move the stop behind each new higher low (for longs). Captures big trends, gives back more on reversals.'},
    {h:'What you don\'t do'},
    {list:[
      'Close a trade early because it went slightly red — that\'s what the stop is for.',
      'Move to break-even too early — gold\'s normal noise will tag you, then continue without you.',
      'Add to a losing position to "average down".'
    ]},
    {note:'Pick one management style and use it for at least 20 trades before judging it. Switching every week means you never know what works.'},
    {task:'Write your management rule in one sentence, e.g. "Close 50% at 1.5R, stop to break-even, rest to 3R." Use it on your next 20 demo trades without changes.'}
  ]}

], quiz:[
  {q:'The trend-pullback setup mainly aims to catch…', opts:['The middle of a move in the trend direction','Exact tops and bottoms','News spikes'], correct:0, explain:'It joins an existing trend after a pullback.'},
  {q:'Price pulls back to your zone but slices through with no rejection. You…', opts:['Skip — the setup didn\'t happen','Buy anyway, it\'s cheaper now','Double the size'], correct:0, explain:'No confirmation, no trade.'},
  {q:'The key confirmation of a liquidity sweep is…', opts:['A close back inside the range after the break','Any wick through a level','Price touching a round number'], correct:0, explain:'The failed breakout is shown by the close back inside.'},
  {q:'Where does the stop go on a sweep short?', opts:['Above the sweep wick plus a buffer','Right at the entry','There is no stop on this setup'], correct:0, explain:'Beyond the extreme that would prove the idea wrong.'},
  {q:'What is "averaging down"?', opts:['Adding to a losing position — something to avoid','Taking partial profits','Moving the stop to break-even'], correct:0, explain:'It increases risk on a trade that is already wrong.'},
  {q:'How long should you test a management style before judging it?', opts:['At least ~20 trades','One trade','One day'], correct:0, explain:'Small samples are just noise.'}
]};
