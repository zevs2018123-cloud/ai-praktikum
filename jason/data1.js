/* Block 1 — Foundations · Block 2 — Reading the chart */

var COURSE_101 = { id:'basics', blockId:'foundations', icon:'book', name:'Trading 101', lessons:[

  { title:'What trading actually is', min:4, body:[
    'Forget the Lamborghini screenshots for a minute. Trading is one thing: you open a position betting that price will move in a direction, and you close it later. The difference between your entry and your exit, times the size of your position, is your profit or loss. Everything else — indicators, strategies, signals — is just a way to make better bets.',
    {h:'What you are actually buying'},
    'When you trade gold or EURUSD through a retail broker, you almost never own the metal or the currency. You trade a <b>CFD</b> (contract for difference): an agreement with the broker to settle the price difference in cash. That is why you can profit when price falls — you can <b>sell first</b> (go short) and buy back later.',
    {list:[
      '<b>Long / buy</b> — you profit if price goes up.',
      '<b>Short / sell</b> — you profit if price goes down.',
      '<b>Position</b> — an open trade. It is live until you close it or your stop / target closes it for you.'
    ]},
    {h:'Who is on the other side'},
    'Your broker connects you to the market and makes money from the <b>spread</b> (the gap between the buy and sell price), sometimes a commission, and <b>swap</b> — an overnight fee for holding leveraged positions. These costs are small per trade but add up fast if you trade a lot.',
    {warn:'Regulated CFD brokers must publish how many retail accounts lose money. The figure is typically somewhere between 60% and 80%. That is not a reason to quit — it is the reason this academy starts with risk, not with entries.'},
    {h:'Trading vs investing'},
    'Investing is buying something you want to hold for years. Trading is short- to medium-term: minutes, hours, days, sometimes weeks. Traders care about <b>where price goes next</b>, not what a company or a metal is "worth" long-term. That means timing and risk control matter more than being right about the big picture.',
    {note:'The one-sentence version: a trader is a risk manager who occasionally takes a position. Keep that in your head for every lesson that follows.'},
    {task:'Open any free chart of XAUUSD (gold) — TradingView works. Write down today\'s price, then check it again tomorrow at the same time. Did it go up or down, and by how many dollars? That dollar move is what traders fight over.'}
  ]},

  { title:'Reading a quote: bid, ask, pips and lots', min:5, body:[
    'Every price you see on a platform is really two prices. Understanding them is what separates "why did I lose money the second I entered?" from knowing exactly what you paid.',
    {h:'Bid, ask and the spread'},
    {list:[
      '<b>Bid</b> — the price you can <b>sell</b> at.',
      '<b>Ask</b> — the price you can <b>buy</b> at. Always slightly higher.',
      '<b>Spread</b> — ask minus bid. You pay it on every trade, which is why a fresh position starts slightly negative.'
    ]},
    'Spreads widen when the market is thin (late night, holidays) and around big news. A trade that looks fine on a normal day can be expensive at 23:00.',
    {h:'Pips and points'},
    'A <b>pip</b> is the standard unit of price movement. For EURUSD it is the 4th decimal: a move from 1.1000 to 1.1001 is one pip. For JPY pairs it is the 2nd decimal. Gold is quoted in dollars and cents, and brokers label its moves differently — so for gold we simply talk in <b>dollars of price movement</b>: "gold moved $12".',
    {h:'Lots: how big your position is'},
    {table:{ head:['Instrument','1.00 lot =','$ per move'], rows:[
      ['EURUSD','100,000 EUR','≈ $10 per pip'],
      ['XAUUSD (gold)','100 oz','$100 per $1 move'],
      ['0.01 lot of gold','1 oz','$1 per $1 move']
    ]}},
    'So if you buy <b>0.10 lots of gold</b> and price rises $5, you make 10 oz × $5 = <b>$50</b>. If it falls $5, you lose $50. Same math, both directions.',
    {formula:'P/L = price move × units\nGold: 0.10 lot = 10 oz\n$5 move × 10 oz = $50', label:'Gold example'},
    {warn:'Contract sizes vary between brokers — some use 100 oz per lot for gold, a few use different sizes. Always check the "contract specification" of the instrument on your broker before your first trade.'},
    {task:'In your platform (or TradingView), find the current bid and ask for XAUUSD. Calculate the spread in dollars. Then work out: how much would that spread cost you on a 0.10-lot trade?'}
  ]},

  { title:'Leverage and margin — the double-edged sword', min:5, body:[
    'Leverage is the reason trading is accessible with $1,000 — and the reason most small accounts blow up. It deserves its own lesson.',
    {h:'What leverage does'},
    'Leverage lets you control a position much bigger than your deposit. With 1:100 leverage, every $1 of your money controls $100 of market exposure. The broker locks a slice of your balance as <b>margin</b> — a deposit that keeps the position open.',
    {formula:'Gold at $4,000 (round example)\n1.00 lot = 100 oz = $400,000 exposure\nLeverage 1:100 → margin = $4,000\n0.10 lot → margin = $400', label:'Margin math'},
    {h:'The trap'},
    'Leverage does not change how much price moves. It changes how much <b>that move costs you</b>. A $10 drop in gold is $1,000 on one full lot. On a $1,000 account, that is the whole account — from a move gold can make in an hour.',
    {list:[
      '<b>Margin level</b> — equity ÷ used margin × 100%. Your platform shows it.',
      '<b>Margin call</b> — a warning that your equity is getting too close to the margin you have used.',
      '<b>Stop out</b> — the broker closes your positions automatically to stop your balance going negative. The exact levels differ by broker.'
    ]},
    {note:'Pros think in reverse: they never ask "how much can I open?". They ask "how much am I willing to lose if I\'m wrong?" — and size the position from that. The available leverage is a ceiling, not a target.'},
    {h:'The takeaway'},
    'High leverage is fine as long as your <b>position size</b> is small. Low leverage with a huge position is still dangerous. What protects you is the stop loss and the size — you\'ll learn to calculate both in the Risk First course.',
    {task:'Look up your broker\'s (or a demo account\'s) leverage for gold and its stop-out level. Then calculate: with a $1,000 account, how many dollars does gold need to move against a 0.50-lot position to wipe you out?'}
  ]}

], quiz:[
  {q:'What do you actually trade with most retail brokers when you "buy gold"?', opts:['A CFD that settles the price difference in cash','Physical gold stored in a vault','A share in a gold mining company'], correct:0, explain:'Retail brokers offer CFDs — you trade price movement, not the metal.'},
  {q:'You go short on gold. When do you make money?', opts:['When the price falls','When the price rises','Only when the spread narrows'], correct:0, explain:'Short = sell first, buy back cheaper later.'},
  {q:'Which price do you pay when you open a BUY?', opts:['The ask','The bid','The average of bid and ask'], correct:0, explain:'You buy at the ask and sell at the bid. The gap is the spread.'},
  {q:'You hold 0.10 lots of gold (100 oz per lot). Price rises $5. Your P/L?', opts:['+$50','+$5','+$500'], correct:0, explain:'0.10 lot = 10 oz; 10 × $5 = $50.'},
  {q:'What does 1:100 leverage change?', opts:['How much a price move costs or pays you relative to your deposit','How far price moves each day','The spread you pay'], correct:0, explain:'Leverage amplifies exposure, not the market\'s movement.'},
  {q:'What is a stop out?', opts:['The broker closing positions automatically when equity gets too low','Your own stop loss order','A pause in trading during news'], correct:0, explain:'Stop out is the broker\'s safety mechanism — by then the damage is done.'},
  {q:'How does a professional decide position size?', opts:['From how much they\'re willing to lose if wrong','From the maximum leverage available','From how confident they feel'], correct:0, explain:'Risk first, size second.'}
]};

var COURSE_CHART = { id:'chart', blockId:'foundations', icon:'candle', name:'Your First Chart', lessons:[

  { title:'Candlesticks: reading price like a story', min:4, body:[
    'A candlestick chart is the default in almost every platform for a reason: each candle tells you in one glance who won a period of time — buyers or sellers — and how hard they fought.',
    {h:'Anatomy of a candle'},
    {list:[
      '<b>Open</b> — price at the start of the period.',
      '<b>Close</b> — price at the end.',
      '<b>High / low</b> — the extremes reached, shown by the thin lines (wicks).',
      '<b>Body</b> — the thick part between open and close. Green (or white) = closed higher than it opened. Red (or black) = closed lower.'
    ]},
    {h:'What the shapes say'},
    {step:1, t:'Big body, small wicks', d:'One side dominated the whole period. Strong conviction.'},
    {step:2, t:'Long lower wick', d:'Sellers pushed price down, buyers pushed it all the way back. Often seen at the bottom of a move — rejection of lower prices.'},
    {step:3, t:'Long upper wick', d:'The mirror: buyers tried, sellers rejected higher prices.'},
    {step:4, t:'Tiny body, wicks both sides (doji)', d:'Indecision. On its own it means little; at a key level it can mean a lot.'},
    {note:'A single candle is a hint, not a signal. Where it forms matters far more than its shape. A long lower wick in the middle of nowhere is noise; the same wick at a major support level is information.'},
    {task:'Open a 1-hour XAUUSD chart. Find the three candles with the longest wicks from the past week. For each one, note: where did it form, and what did price do over the next 5 candles?'}
  ]},

  { title:'Timeframes: zooming in and out', min:4, body:[
    'The same market looks completely different on a 5-minute chart and a daily chart. Beginners often pick one timeframe and get whipsawed by moves they could have seen coming from a higher one.',
    {h:'The main timeframes'},
    {table:{ head:['Timeframe','Used for','Style'], rows:[
      ['Daily / 4H','Big picture, key levels','Swing trading'],
      ['1H','Structure within the day','Intraday / swing'],
      ['15m / 5m','Precise entries','Day trading'],
      ['1m','Noise for most people','Scalping (advanced)']
    ]}},
    {h:'Top-down analysis'},
    'Start high, go low. It takes two minutes and saves most bad trades.',
    {step:1, t:'Daily or 4H', d:'Which way is the bigger trend? Where are the obvious levels price has reacted to?'},
    {step:2, t:'1H', d:'Is the current move in line with the bigger trend or against it? Where is price relative to those levels?'},
    {step:3, t:'15m', d:'Only now look for an entry — in the direction the higher timeframes agree on.'},
    {warn:'Lower timeframes produce many more signals — and many more false ones. If you are new, don\'t trade anything below 15 minutes. Speed is not an edge; it is extra noise and extra spread costs.'},
    {task:'Pull up XAUUSD on the Daily, then 1H, then 15m. Write one sentence per timeframe: "trend is up / down / sideways". Do they agree?'}
  ]},

  { title:'Platforms and your demo account', min:4, body:[
    'You need two things: a charting tool to analyse, and a trading platform to execute. Sometimes they are the same app.',
    {h:'The standard setup'},
    {list:[
      '<b>TradingView</b> — the best charts, free tier is plenty to start. Most traders analyse here.',
      '<b>MetaTrader 4 / 5</b> — the platform most forex/CFD brokers use to place trades. Clunkier charts, rock-solid execution.',
      '<b>Your broker\'s app</b> — for checking and managing positions on the go.'
    ]},
    {h:'Why demo first — and how to use it properly'},
    'A demo account gives you virtual money at live prices. It is where you learn the buttons, not where you get rich. Use it seriously:',
    {step:1, t:'Match your real balance', d:'If you plan to start with $1,000, set the demo to $1,000 — not $100,000. Otherwise the numbers teach you nothing.'},
    {step:2, t:'Use real rules', d:'Stop loss on every trade, the same risk per trade you will use live.'},
    {step:3, t:'Journal every trade', d:'Entry, stop, target, reason, result. You\'ll build this habit fully in the Trading Plan course.'},
    {step:4, t:'Graduate on evidence', d:'Go live when you have 30–50 demo trades that followed your rules — not when you had a lucky week.'},
    {links:[
      {n:'TradingView', u:'https://www.tradingview.com', d:'Free charts for XAUUSD and every pair in this course.'},
      {n:'MetaTrader 5', u:'https://www.metatrader5.com', d:'The trading platform most brokers connect to.'}
    ]},
    {note:'Demo fills are perfect; live fills sometimes aren\'t (slippage, wider spreads at news). Expect your live results to be a bit worse than demo — that\'s normal.'},
    {task:'Open a demo account with the same balance you plan to trade live. Place one tiny trade on gold with a stop loss and a take profit, then close it manually. You\'ve now done the full mechanical cycle.'}
  ]}

], quiz:[
  {q:'A green candle means…', opts:['Price closed higher than it opened in that period','Price will go up next','Buyers bought more contracts than sellers sold'], correct:0, explain:'Colour only shows close vs open for that period.'},
  {q:'A long lower wick at a support level suggests…', opts:['Lower prices were rejected','Sellers are in full control','The market is closed'], correct:0, explain:'Price went down and was pushed back — rejection.'},
  {q:'What matters most about a single candle?', opts:['Where it forms','Its colour','Its exact size in pixels'], correct:0, explain:'Context — the level it forms at — gives a candle meaning.'},
  {q:'In top-down analysis, what do you look at first?', opts:['The higher timeframe (Daily/4H)','The 1-minute chart','An indicator'], correct:0, explain:'Big picture first, entry timeframe last.'},
  {q:'Why should beginners avoid sub-15-minute charts?', opts:['More noise, more false signals, more costs','They are illegal for retail traders','Prices there are fake'], correct:0, explain:'Lower timeframes amplify noise and spread costs.'},
  {q:'How big should your demo balance be?', opts:['The same as the real balance you plan to trade','$100,000 so you can practise big trades','It doesn\'t matter'], correct:0, explain:'Only a realistic balance teaches realistic sizing.'},
  {q:'When are you ready to go live?', opts:['After 30–50 demo trades that followed your rules','After one profitable day','Right after opening the demo'], correct:0, explain:'Evidence of following rules, not a lucky streak.'}
]};

var COURSE_SR = { id:'structure', blockId:'chart', icon:'trend', name:'Support, Resistance & Trend', lessons:[

  { title:'Support and resistance zones', min:5, body:[
    'If you learn only one technical concept, make it this one. Support and resistance are simply prices where the market has reacted before — and where lots of traders are watching.',
    {h:'Definitions'},
    {list:[
      '<b>Support</b> — a price area where falling price has stopped and bounced before. Buyers showed up.',
      '<b>Resistance</b> — an area where rising price has stalled and turned down. Sellers showed up.'
    ]},
    {h:'Zones, not lines'},
    'Price rarely turns at the exact same cent. Draw levels as <b>zones</b> a few dollars wide on gold, covering the wicks and bodies of the reactions. A "broken" level that was only breached by $1 is usually not broken — it is a zone doing its job.',
    {h:'How to find the levels that matter'},
    {step:1, t:'Start on the Daily or 4H', d:'Higher-timeframe levels are watched by more traders and hold more often.'},
    {step:2, t:'Look for multiple touches', d:'A level that turned price 3 times is stronger than one that did it once.'},
    {step:3, t:'Look for sharp reactions', d:'Price leaving a level fast shows strong interest there.'},
    {step:4, t:'Mark round numbers', d:'Gold loves round numbers — $50 and $100 levels attract orders.'},
    {note:'Role reversal: once resistance is broken convincingly, it often becomes support on the retest (and vice versa). This "flip" is one of the most reliable setups on gold.'},
    {task:'On a 4H gold chart, mark the 3 most obvious zones above and 3 below current price. Keep them — you\'ll use them in the next lessons.'}
  ]},

  { title:'Trend structure: highs and lows', min:4, body:[
    'Indicators lag. Structure is the market telling you directly what it is doing. You read it from the sequence of swing highs and swing lows.',
    {h:'The three states'},
    {list:[
      '<b>Uptrend</b> — higher highs (HH) and higher lows (HL). Each pullback stops above the last one.',
      '<b>Downtrend</b> — lower highs (LH) and lower lows (LL).',
      '<b>Range</b> — price bouncing between a ceiling and a floor, no new highs or lows.'
    ]},
    {h:'Trading with structure'},
    'In an uptrend, the lowest-risk buys are near a <b>higher low</b> — a pullback into support — not after a big green candle that already ran. In a range, you buy near the floor and sell near the ceiling, or you wait.',
    {h:'When the trend changes'},
    'An uptrend is in trouble when price makes a <b>lower low</b> — it breaks below the last higher low. That is called a <b>break of structure</b>. It does not guarantee a reversal, but it removes the reason you were buying.',
    {warn:'Most beginner losses come from fighting the trend: "it\'s gone up so much, it must drop." Markets can stay stretched much longer than your account can stay solvent. Trade with the higher-timeframe structure unless you have a clear reason not to.'},
    {task:'On the 1H gold chart, label the last 4 swing points (HH, HL, LH or LL). What is the current structure? Where is the level that, if broken, would change it?'}
  ]},

  { title:'Breakouts vs fakeouts', min:4, body:[
    'Price breaks a level, you jump in, and it snaps straight back. Welcome to the fakeout — gold is famous for them.',
    {h:'Why fakeouts happen'},
    'Just beyond obvious levels sit piles of stop losses and breakout orders. Larger players often push price through the level to trigger those orders, fill their own positions, and reverse. What looks like a breakout is sometimes just a <b>liquidity grab</b>.',
    {h:'How to filter breakouts'},
    {step:1, t:'Wait for the close', d:'A wick through a level is not a breakout. A candle closing beyond it on your timeframe is the minimum.'},
    {step:2, t:'Look for the retest', d:'The cleaner entry is often when price comes back to test the broken level from the other side and holds.'},
    {step:3, t:'Check the bigger picture', d:'Breakouts in the direction of the higher-timeframe trend work far more often.'},
    {step:4, t:'Mind the clock', d:'Breakouts during thin hours (late US / early Asia) fail more often than those during London or New York.'},
    {note:'Flip the fakeout into a setup: when price sweeps above a clear high and then closes back below it, the trapped breakout buyers become fuel for a move down. Many gold traders specifically wait for that sweep.'},
    {task:'Find two recent breaks of a level on the 1H gold chart: one that followed through and one that failed. What was different — the close, the time of day, the trend direction?'}
  ]}

], quiz:[
  {q:'Support is…', opts:['An area where falling price has bounced before','Any round number','The lowest price of the year'], correct:0, explain:'Support is defined by past reactions.'},
  {q:'Why draw zones instead of exact lines?', opts:['Price rarely turns at the exact same cent','Lines are harder to draw','Zones guarantee a bounce'], correct:0, explain:'Markets react around areas, not single prices.'},
  {q:'What makes a level stronger?', opts:['Multiple touches and sharp reactions on a higher timeframe','A single touch on the 1-minute chart','Being close to the current price'], correct:0, explain:'More touches, higher timeframe, stronger reactions.'},
  {q:'Higher highs and higher lows describe…', opts:['An uptrend','A downtrend','A range'], correct:0, explain:'That sequence is the definition of an uptrend.'},
  {q:'In an uptrend, the lowest-risk buy is usually…', opts:['On a pullback near a higher low','After a big green candle','At a new all-time high, market order'], correct:0, explain:'Buying pullbacks gives a tighter, logical stop.'},
  {q:'What is a common reason for fakeouts?', opts:['Stop and breakout orders just beyond obvious levels','Brokers changing the chart','Indicators being wrong'], correct:0, explain:'Liquidity sits beyond obvious levels and gets swept.'},
  {q:'Minimum confirmation of a breakout on your timeframe?', opts:['A candle closing beyond the level','A wick touching the level','A news headline'], correct:0, explain:'Wicks don\'t count — closes do.'}
]};

var COURSE_IND = { id:'indicators', blockId:'chart', icon:'wave', name:'Indicators Without the Noise', lessons:[

  { title:'Moving averages: trend at a glance', min:4, body:[
    'A moving average (MA) is the average closing price over the last N candles, redrawn every candle. It smooths out the noise so you can see direction.',
    {h:'The ones worth knowing'},
    {list:[
      '<b>EMA 20</b> — short-term momentum. In strong trends, price keeps pulling back to it.',
      '<b>EMA 50</b> — medium-term trend.',
      '<b>MA 200</b> — the long-term line almost every trader watches. Above = long-term bullish bias, below = bearish.'
    ]},
    'EMA (exponential) reacts faster than SMA (simple) because it weighs recent candles more. For gold, most traders use EMAs.',
    {h:'How to actually use them'},
    {step:1, t:'As a filter', d:'Only look for buys when price is above the 50 EMA on your higher timeframe, only sells when below. This one rule removes many bad trades.'},
    {step:2, t:'As dynamic support/resistance', d:'In a clean trend, pullbacks to the 20 or 50 EMA are often where the next leg starts.'},
    {step:3, t:'Not as a trigger on its own', d:'"Buy when the fast MA crosses the slow MA" loses money in ranges, where the lines cross back and forth constantly.'},
    {note:'Every indicator is calculated from price. It can\'t know something price doesn\'t. Use indicators to organise what you see, not to replace looking.'},
    {task:'Add the 20, 50 and 200 EMA to a 4H gold chart. For the last month: how many pullbacks bounced off the 20 or 50? How often did price cross the 200?'}
  ]},

  { title:'RSI: momentum and exhaustion', min:4, body:[
    'The Relative Strength Index (RSI) measures how strong recent up-moves are compared to down-moves, on a scale of 0 to 100. The standard setting is 14 periods.',
    {h:'The classic reading — and its problem'},
    'Above 70 is called "overbought", below 30 "oversold". The problem: in a strong trend RSI can sit above 70 for days while price keeps climbing. Selling just because RSI is above 70 is fighting the trend with a calculator.',
    {h:'Better ways to use RSI'},
    {step:1, t:'Trend confirmation', d:'In an uptrend, RSI tends to hold above 40–50 on pullbacks. If it drops below 30, the trend is weakening.'},
    {step:2, t:'Divergence', d:'Price makes a higher high but RSI makes a lower high. Momentum is fading. Not a sell signal on its own — a warning to tighten up or wait.'},
    {step:3, t:'Extremes at key levels', d:'Oversold RSI + price at strong daily support + a rejection candle = three pieces of evidence pointing the same way.'},
    {warn:'Stacking five indicators that all measure momentum doesn\'t give you five confirmations — it gives you the same information five times. One trend tool + one momentum tool + price levels is plenty.'},
    {task:'Find one bearish and one bullish RSI divergence on the 1H gold chart from the last two weeks. What did price do after each?'}
  ]},

  { title:'ATR: how far price really moves', min:4, body:[
    'Average True Range (ATR) is the most useful indicator most beginners never add. It doesn\'t tell you direction. It tells you <b>how much the market typically moves per candle</b> — which is exactly what you need to place stops.',
    {h:'Reading it'},
    'If the 14-period ATR on the 1H gold chart shows 8.0, gold has been moving about $8 per hour on average recently. Volatility changes: quiet weeks shrink ATR, news weeks expand it.',
    {h:'Stops that respect volatility'},
    'A stop placed $3 away when gold moves $8 an hour will be hit by random noise. A common approach is to place the stop <b>beyond the structure level</b> that invalidates your idea, plus a buffer of roughly 0.5–1× ATR.',
    {formula:'Buy at support zone top: 4,000\nZone bottom: 3,995\n1H ATR: 6\nStop = 3,995 − 0.5 × 6 = 3,992', label:'Example'},
    {h:'ATR and position size go together'},
    'Wider stop = smaller position, so the dollar risk stays the same. That\'s why on volatile days a pro trades <b>smaller</b>, not bigger. The Risk First course turns this into a formula — and the Tools tab does it for you.',
    {tool:'size', t:'Try it in the position size calculator'},
    {task:'Check the 14-period ATR on the 1H and Daily gold chart right now. Would a $5 stop survive a normal hour? A normal day?'}
  ]}

], quiz:[
  {q:'The 200 MA is mostly used to judge…', opts:['Long-term bias','Exact entry price','The spread'], correct:0, explain:'Above/below the 200 is a widely watched long-term filter.'},
  {q:'Why do MA crossovers lose money in ranges?', opts:['The lines cross back and forth constantly','Brokers block them','They only work on crypto'], correct:0, explain:'No trend = many false crosses.'},
  {q:'RSI above 70 in a strong uptrend usually means…', opts:['Momentum is strong — not automatically a sell','Price must drop now','The indicator is broken'], correct:0, explain:'RSI can stay overbought through entire trends.'},
  {q:'Bearish divergence is…', opts:['Price makes a higher high while RSI makes a lower high','RSI below 30','Price and RSI both rising'], correct:0, explain:'Momentum fading while price still pushes.'},
  {q:'What does ATR measure?', opts:['Typical price movement per candle','Trend direction','Buyer vs seller volume'], correct:0, explain:'ATR = volatility, no direction.'},
  {q:'On a very volatile day, a pro usually…', opts:['Uses a wider stop and a smaller position','Uses a tighter stop and bigger position','Removes the stop'], correct:0, explain:'Dollar risk stays constant; size adapts to volatility.'}
]};
