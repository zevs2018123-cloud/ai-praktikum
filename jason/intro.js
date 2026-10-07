/* ============================================================
   Intro lesson "Who is Jason" — shown on Home right after the questionnaire.
   DRAFT text: replace with the team's final copy.
   VIDEO: put the YouTube id (unlisted is fine) into INTRO.video, e.g. 'dQw4w9WgXcQ'.
   Same body format as course lessons (see README → lesson body blocks).
   ============================================================ */
var INTRO = {
  video: '',   // TODO: 2–3 min welcome video from Jason
  min: 3,
  i18n: {
    en: {
      title: 'Who is Jason — and how this academy works',
      body: [
        'I’m Jason. I trade gold (XAUUSD) for a living, and right now I’m running a public challenge: <b>from $10,000 to $1,000,000</b>. Every trade goes out in the open, in my channel and in the club — wins and losses.',
        {h:'What I believe'},
        'Trading is not complicated when you have the right strategy and follow it. I’ve said it many times, and now I’m proving it live. No magic indicators, no 50 trades a day — clear setups, tight risk, discipline.',
        {list:[
          '<b>Risk first.</b> I can be wrong often — I just never let one trade hurt the account.',
          '<b>One market.</b> Gold. I know how it moves and when.',
          '<b>A system, not emotions.</b> Every trade goes through the same checklist.'
        ]},
        {h:'Who this academy is for'},
        'We don’t work with people who just want to watch. This academy is for those who want to <b>actually earn</b> — learn the system, open an account and trade it.',
        {list:[
          '<b>Starting from $250</b> — try it, learn the basics and get a feel for real trading.',
          '<b>Starting from $1,000</b> — work towards your first $100,000.',
          '<b>Starting from $10,000</b> — follow my path towards the million.'
        ]},
        {h:'How to get in'},
        'Entry to the academy = an account with our partner broker, opened through our link. <b>No deposit needed</b> to get in — just open the account and send us its number. A manager checks it, usually within 1 hour, and the bot tells you when the academy is open.',
        'Lessons then open one by one as you complete them — from the basics to my own trading system.',
        {note:'Stuck at any step? Tap «I have a problem» at the bottom — a manager answers right in the app.'},
        {warn:'Trading CFDs with leverage carries a high risk of losing money. Targets are goals, not promises. Only trade money you can afford to lose.'}
      ],
      cta: 'Open my account →', ctaNoGate: 'Start the first lesson →'
    },
    ru: {
      title: 'Кто такой Джейсон и как устроена академия',
      body: [
        'Я Джейсон. Я профессионально торгую золотом (XAUUSD), и сейчас веду публичный челлендж: <b>с $10 000 до $1 000 000</b>. Каждая сделка — в открытую, в моём канале и в клубе: и плюсовые, и минусовые.',
        {h:'Во что я верю'},
        'Трейдинг — это не сложно, если есть правильная стратегия и ты ей следуешь. Я повторял это не раз, а теперь доказываю в прямом эфире. Никаких волшебных индикаторов и 50 сделок в день — понятные сетапы, жёсткий риск, дисциплина.',
        {list:[
          '<b>Сначала риск.</b> Я могу часто ошибаться — но ни одна сделка не бьёт по счёту.',
          '<b>Один рынок.</b> Золото. Я знаю, как и когда оно двигается.',
          '<b>Система, а не эмоции.</b> Каждая сделка проходит один и тот же чек-лист.'
        ]},
        {h:'Для кого эта академия'},
        'Мы не работаем с теми, кто хочет просто посмотреть. Академия — для тех, кто хочет <b>именно зарабатывать</b>: выучить систему, открыть счёт и торговать по ней.',
        {list:[
          '<b>Старт от $250</b> — попробовать, разобраться в базе и почувствовать реальную торговлю.',
          '<b>Старт от $1 000</b> — идти к первым $100 000.',
          '<b>Старт от $10 000</b> — повторить мой путь к миллиону.'
        ]},
        {h:'Как попасть внутрь'},
        'Вход в академию — это счёт у нашего брокера-партнёра, открытый по нашей ссылке. <b>Пополнять депозит для входа не нужно</b> — просто открой счёт и пришли нам его номер. Менеджер проверит его, обычно до 1 часа, и бот напишет, когда академия откроется.',
        'Дальше уроки открываются по очереди, по мере прохождения — от базы до моей торговой системы.',
        {note:'Застрял на каком-то шаге? Нажми «У меня проблема» внизу — менеджер ответит прямо в приложении.'},
        {warn:'Торговля CFD с плечом несёт высокий риск потери денег. Цели — это ориентиры, а не обещания. Торгуй только теми деньгами, которые можешь позволить себе потерять.'}
      ],
      cta: 'Открыть счёт →', ctaNoGate: 'Начать первый урок →'
    }
  }
};
function introText(){ return INTRO.i18n[window.LANG] || INTRO.i18n.en; }
