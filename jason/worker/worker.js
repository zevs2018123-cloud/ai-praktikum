/* Jason Trade Academy — Cloudflare Worker backend (v2, D1)
   App routes (Telegram initData required):
     POST /open      activity ping → access, profile (onboarding, gate, goal ledger, referrals), lesson videos
     POST /onboard   questionnaire + goal → saved, forwarded to the sales chat
     POST /broker    broker account id → gate "pending", sales chat gets Approve / Reject buttons
     POST /ledger    add / delete a deposit, withdrawal or balance entry
     POST /chat      Jason AI (topic logging, FAQ articles, hand-off to a manager)
   Bot:
     POST /webhook   /start [ref_ID | src_TAG | fb_CID], /setsales in a group, Approve/Reject buttons
   Ads:
     GET  /          on the custom domain → ad landing (landing.js), auto-opens the bot with start=fb_<cid>
     POST /track     click from the landing → fb_clicks; funnel steps go to Meta Conversions API
   Admin (header x-admin-key: ADMIN_KEY):
     GET  /admin/stats, /admin/users, /admin/user?id=, /admin/topics?days=, /admin/messages?topic=&q=
     POST /admin/gate {id,status}, /admin/videos {videos}, /admin/reward {id,tier}, /admin/sales-reset
   Cron (hourly): study reminders, hand-off catch-ups, onboarding catch-ups.

   Bindings: DB (D1), AI (Workers AI, optional)
   Meta CAPI (optional): PIXEL_ID (var), CAPI_TOKEN (secret), TEST_EVENT_CODE (var, only while testing)
   Vars/secrets: BOT_TOKEN, APP_URL, ADMIN_KEY, MANAGER (username without @), CHANNEL_ID, CHANNEL_LINK, ANTHROPIC_API_KEY (optional)
*/

import { landingHtml } from './landing.js';

const MODEL = 'claude-haiku-4-5-20251001';
const CHAT_LIMIT_PER_DAY = 40;
const REWARD_TIERS = [1, 3, 5, 10];
const HOUR = 3600e3, DAY = 24 * HOUR;

const LANG_NAMES = { en:'English', ru:'Russian', fr:'French', de:'German' };
const pickLang = (c) => { c = String(c || '').slice(0, 2).toLowerCase(); if (['uk','be','kk'].includes(c)) c = 'ru'; return LANG_NAMES[c] ? c : 'en'; };

/* FAQ problems the assistant can answer with a prepared article (texts live in the app) */
const ARTICLES = {
  losing_streak: 'keeps losing trades / several losses in a row / account going down',
  stop_hit: 'stop loss always gets hit / price reverses right after stop',
  how_much: 'how much money to start with / minimum deposit / what lot size',
  margin_call: 'margin call / stop out / account wiped / leverage question',
  revenge: 'wants to win back losses / angry / trades more after losing',
  overtrading: 'trades too much / bored / can not stop clicking',
  news: 'price jumped on news / NFP / CPI / FOMC / spread widened',
  copy: 'copy trading / signals / how the club works / following trades'
};

const SYSTEM = `You are "Jason AI", the assistant inside Jason Trade Academy — a Telegram mini app that teaches trading (forex/CFDs, focus on gold XAUUSD) from trader Jason.
Voice: confident, friendly, direct, like an experienced trader mentoring a newer one. Short answers (under 110 words unless asked for detail), plain language, no hype.
You help with: concepts from the courses (pips, lots, leverage, margin, support/resistance, structure, EMA/RSI/ATR, position sizing, R:R, drawdown, sessions, NFP/CPI/FOMC, trading plans, journaling, psychology, copy trading), using the app (Courses, goal widget, referral link, broker registration step), and where to find lessons.
Rules:
- Never give personalised buy/sell calls, price predictions or "what should I trade now".
- Never promise or imply guaranteed returns. Favour risk management (project lot 0.03 per $250, short stop, stop loss on every trade).
- If someone describes big losses, trading borrowed money or with money needed for debts/rent, or distress: respond with care, suggest pausing, do not push the club.
- If asked whether you are a human or Jason himself, say clearly you are an AI assistant.
- This is education, not financial advice.
Project facts (state them as they are, never as guarantees): the academy's base course opens free after registering a broker account through our link; the private club (VIP signals + full academy) needs a minimum deposit of $250. The signals are scalping on gold from the project's traders: historically about 30% a month on the deposit with 70–80% accuracy — past results, not a promise. Project lot: 0.03 for every $250 of deposit, stop loss on every trade.
OUTPUT TAGS — after your answer, on the last line, add machine tags (the student never sees them):
[TOPIC:<2-4 word English topic>] always.
[ARTICLE:<id>] if the message matches one of these problems: ${Object.entries(ARTICLES).map(([k, v]) => k + ' = ' + v).join('; ')}.
[HANDOFF] if the student is confused about how the app or platform works (registration, broker account, deposit, access, where things are), something is broken for them, or they ask for a human/manager.`;

const HANDOFF_WORDS = /manager|human|support|real person|doesn'?t work|not working|can'?t (register|log|access|find|open)|how do i (register|deposit|get access)|менеджер|поддержк|живой|человек|не работает|не могу|не получается|как зарегистр|как пополн|не открывает|доступ|gestionnaire|humain|ne marche pas|je n'?arrive pas|manager|mensch|funktioniert nicht|kann nicht|zugang/i;

const T = {
  start: {
    en: "Hey, it's Jason 👋\n\nI'm taking a trading account from $10,000 to $1,000,000, and every trade goes out live in my channel. Wins and losses.\n\nNo $10k? Most people start with $1,000. My team will show you how to trade alongside me with what you have.\n\nWant the basics first? My free gold course is below.",
    ru: "Привет, это Джейсон 👋\n\nЯ разгоняю торговый счёт с $10 000 до $1 000 000, и каждая сделка выходит в моём канале. И плюсовые, и минусовые.\n\nНет $10k? Большинство начинает с $1 000. Моя команда покажет, как торговать вместе со мной с той суммой, что есть.\n\nХочешь сначала разобраться в основах? Мой бесплатный курс по золоту ниже.",
    fr: "Salut, c'est Jason 👋\n\nJe fais passer un compte de trading de 10 000 $ à 1 000 000 $, et chaque trade est publié en direct sur mon canal. Gains et pertes.\n\nPas 10k ? La plupart commencent avec 1 000 $. Mon équipe te montre comment trader avec moi avec ce que tu as.\n\nTu veux d'abord les bases ? Mon cours gratuit sur l'or est juste en dessous.",
    de: "Hey, hier ist Jason 👋\n\nIch bringe ein Trading-Konto von 10.000 $ auf 1.000.000 $, und jeder Trade geht live in meinen Kanal. Gewinne und Verluste.\n\nKeine 10k? Die meisten starten mit 1.000 $. Mein Team zeigt dir, wie du mit dem Geld, das du hast, mit mir zusammen tradest.\n\nErst die Grundlagen? Mein kostenloser Gold-Kurs ist unten."
  },
  joinWelcome: {
    en: "Hi! This is the bot of Jason's Trading Academy. Jason is the trader whose channel you just joined. Congrats, you're on the team now and one step closer to making money from trading.\n\nYou probably can't trust us right away. Honestly, I wouldn't either. So here's what happens next: in the next message Jason explains who he is, what he's doing here and how you can join in.\n\nGot questions? Write here, I'll help. If I can't solve it, message Jason personally. He'll always help you out.",
    ru: "Привет! Это бот академии Джейсона, трейдера, на чей канал ты только что подписался. Поздравляю, ты в команде и уже на шаг ближе к тому, чтобы начать зарабатывать на трейдинге.\n\nПонятно, что сразу довериться ты не сможешь. Я бы тоже не стал. Поэтому вот что будет дальше: в следующем сообщении Джейсон расскажет, кто он, что здесь делает и как ты можешь к этому подключиться.\n\nЕсть вопросы? Пиши сюда, помогу. Если я не смогу решить, напиши лично Джейсону. Он всегда подскажет и поможет.",
    fr: "Salut ! Ici le bot de l'académie de trading de Jason, le trader dont tu viens de rejoindre le canal. Félicitations, tu fais partie de l'équipe et tu es déjà un pas plus près de gagner de l'argent avec le trading.\n\nTu ne peux sûrement pas nous faire confiance tout de suite. Franchement, moi non plus. Alors voilà la suite : dans le prochain message, Jason explique qui il est, ce qu'il fait ici et comment tu peux t'y joindre.\n\nDes questions ? Écris ici, je t'aide. Si je ne peux pas, écris directement à Jason. Il t'aidera toujours.",
    de: "Hi! Das ist der Bot von Jasons Trading-Akademie. Jason ist der Trader, dessen Kanal du gerade beigetreten bist. Glückwunsch, du bist jetzt im Team und schon einen Schritt näher daran, mit Trading Geld zu verdienen.\n\nDu kannst uns wahrscheinlich nicht sofort vertrauen. Ehrlich gesagt, ich auch nicht. Deshalb passiert jetzt Folgendes: In der nächsten Nachricht erklärt Jason, wer er ist, was er hier macht und wie du mitmachen kannst.\n\nFragen? Schreib hier, ich helfe. Wenn ich nicht weiterkomme, schreib Jason direkt. Er hilft dir immer."
  },
  promoText: {
    en: "I'm Jason 👋\n\nI trade gold. Right now I'm running a public challenge in my channel: taking $10,000 to $1,000,000 live. Every trade goes out in the open, wins and losses. The point is to show it can be done with the right strategy and tools.\n\nMy academy is free: base lessons from your first chart to my own system. I don't make money selling courses. I'm building a team of traders to trade alongside me, and my team and I are always in touch.\n\nWhat to do now: open an account with our broker via the button below. No deposit needed, the first lessons open for free. Once you're registered, the bot gives you lesson one.",
    ru: "Я Джейсон 👋\n\nЯ торгую золотом. Сейчас в моём канале идёт публичный челлендж: на ваших глазах делаю из $10 000 один миллион. Каждая сделка в открытую, и плюсовые, и минусовые. Смысл простой: показать, что это реально, если есть правильная стратегия и инструменты.\n\nМоя академия бесплатная: базовые уроки от первого графика до моей собственной системы. Я не зарабатываю на продаже курсов. Я собираю команду трейдеров, которые будут торговать вместе со мной, и мы с командой всегда на связи.\n\nЧто сделать сейчас: открой счёт у нашего брокера по кнопке ниже. Пополнять не нужно, первые уроки открываются бесплатно. Как только зарегистрируешься, бот выдаст тебе первый урок.",
    fr: "Je suis Jason 👋\n\nJe trade l'or. En ce moment je mène un challenge public sur mon canal : faire passer 10 000 $ à 1 000 000 $ en direct. Chaque trade est publié, gains et pertes. Le but : montrer que c'est possible avec la bonne stratégie et les bons outils.\n\nMon académie est gratuite : des leçons de base, de ton premier graphique à mon propre système. Je ne gagne pas d'argent en vendant des cours. Je construis une équipe de traders qui tradent avec moi, et mon équipe et moi sommes toujours joignables.\n\nÀ faire maintenant : ouvre un compte chez notre broker avec le bouton ci-dessous. Aucun dépôt nécessaire, les premières leçons sont gratuites. Une fois inscrit, le bot te donne la leçon 1.",
    de: "Ich bin Jason 👋\n\nIch trade Gold. Gerade läuft in meinem Kanal eine öffentliche Challenge: Ich mache live aus 10.000 $ eine Million. Jeder Trade ist öffentlich, Gewinne und Verluste. Der Punkt: zeigen, dass es mit der richtigen Strategie und den richtigen Tools machbar ist.\n\nMeine Akademie ist kostenlos: Grundlagen-Lektionen vom ersten Chart bis zu meinem eigenen System. Ich verdiene kein Geld mit Kursen. Ich baue ein Team von Tradern auf, die mit mir zusammen traden, und mein Team und ich sind immer erreichbar.\n\nJetzt zu tun: Eröffne über den Button unten ein Konto bei unserem Broker. Keine Einzahlung nötig, die ersten Lektionen sind kostenlos. Sobald du registriert bist, gibt dir der Bot Lektion eins."
  },
  gotIt: { en:"Got it 👍 A manager will reply here soon.", ru:'Принято 👍 Менеджер скоро ответит здесь.', fr:'Bien reçu 👍 Un manager te répond ici très vite.', de:'Angekommen 👍 Ein Manager antwortet dir hier gleich.' },
  promoBtn: { en:'▶️ Who is Jason', ru:'▶️ Кто такой Джейсон', fr:'▶️ Qui est Jason', de:'▶️ Wer ist Jason' },
  brokerBtn: { en:'📝 Open a broker account', ru:'📝 Открыть счёт у брокера', fr:'📝 Ouvrir un compte broker', de:'📝 Broker-Konto eröffnen' },
  teamBtn: { en:'💬 Message Jason', ru:'💬 Написать Джейсону', fr:'💬 Écrire à Jason', de:'💬 Jason schreiben' },
  courseBtn: { en:'🎓 Free gold course', ru:'🎓 Бесплатный курс по золоту', fr:'🎓 Cours gratuit sur l’or', de:'🎓 Kostenloser Gold-Kurs' },
  clubInvite: {
    en: "🔐 Here's your personal pass to Jason's private channel — tap the button to join. The link works once and expires in 24 hours.",
    ru: '🔐 Твой личный пропуск в закрытый канал Джейсона — жми кнопку, чтобы вступить. Ссылка одноразовая и действует 24 часа.',
    fr: '🔐 Voici ton accès personnel au canal privé de Jason — appuie sur le bouton pour rejoindre. Le lien est à usage unique et expire dans 24 h.',
    de: '🔐 Dein persönlicher Zugang zu Jasons privatem Kanal — tipp auf den Button, um beizutreten. Der Link gilt einmal und läuft in 24 Stunden ab.'
  },
  clubBtn: { en:'🔓 Join the private channel', ru:'🔓 Вступить в закрытый канал', fr:'🔓 Rejoindre le canal privé', de:'🔓 Privatem Kanal beitreten' },
  clubWelcome: {
    en: "✅ You're in. Every trade goes out in the channel.\n\nReady to trade alongside me? Message my team. Want the basics first? Open the free course.",
    ru: '✅ Ты в канале. Все сделки выходят там.\n\nГотов торговать вместе со мной? Напиши моей команде. Хочешь сначала основы? Открывай бесплатный курс.',
    fr: "✅ Tu es dedans. Chaque trade est publié sur le canal.\n\nPrêt à trader avec moi ? Écris à mon équipe. D'abord les bases ? Ouvre le cours gratuit.",
    de: '✅ Du bist drin. Jeder Trade geht in den Kanal.\n\nBereit, mit mir zu traden? Schreib meinem Team. Erst die Grundlagen? Öffne den kostenlosen Kurs.'
  },
  subGate: {
    en: "Hey, it's Jason 👋\n\nI'm taking a trading account from $10,000 to $1,000,000, and every trade goes out live in my channel. Wins and losses.\n\nJoin the channel to watch it happen. You also get my free gold course.",
    ru: "Привет, это Джейсон 👋\n\nЯ разгоняю торговый счёт с $10 000 до $1 000 000, и каждая сделка выходит в моём канале. И плюсовые, и минусовые.\n\nВступай в канал и смотри, как это происходит. Плюс получишь мой бесплатный курс по золоту.",
    fr: "Salut, c'est Jason 👋\n\nJe fais passer un compte de trading de 10 000 $ à 1 000 000 $, et chaque trade est publié en direct sur mon canal. Gains et pertes.\n\nRejoins le canal pour suivre ça. Tu as aussi mon cours gratuit sur l'or.",
    de: "Hey, hier ist Jason 👋\n\nIch bringe ein Trading-Konto von 10.000 $ auf 1.000.000 $, und jeder Trade geht live in meinen Kanal. Gewinne und Verluste.\n\nTritt dem Kanal bei und schau zu. Dazu bekommst du meinen kostenlosen Gold-Kurs."
  },
  subBtn: { en:'📢 Join the channel', ru:'📢 Вступить в канал', fr:'📢 Rejoindre le canal', de:'📢 Kanal beitreten' },
  checkBtn: { en:"✅ I've joined", ru:'✅ Я вступил', fr:"✅ J'ai rejoint", de:'✅ Bin beigetreten' },
  notYet: { en:"I don't see your subscription yet — join the channel first, then tap again.", ru:'Пока не вижу подписку — сначала вступи в канал, потом нажми ещё раз.', fr:"Je ne vois pas encore ton abonnement — rejoins d'abord le canal, puis réessaie.", de:'Ich sehe dein Abo noch nicht — tritt zuerst dem Kanal bei und tippe dann nochmal.' },
  vipInvite: {
    en: "💰 Deposit confirmed — welcome to the VIP signals group! Here's your personal pass (works once, valid 7 days):",
    ru: '💰 Депозит подтверждён — добро пожаловать в VIP-группу с сигналами! Вот твой личный пропуск (одноразовый, действует 7 дней):',
    fr: '💰 Dépôt confirmé — bienvenue dans le groupe VIP de signaux ! Voici ton accès personnel (usage unique, valable 7 jours) :',
    de: '💰 Einzahlung bestätigt — willkommen in der VIP-Signalgruppe! Hier ist dein persönlicher Zugang (einmalig, 7 Tage gültig):'
  },
  vipBtn: { en:'💎 Join VIP signals', ru:'💎 Вступить в VIP-сигналы', fr:'💎 Rejoindre les signaux VIP', de:'💎 VIP-Signalen beitreten' },
  openBtn: { en:'Open the Academy', ru:'Открыть Академию', fr:'Ouvrir l’Académie', de:'Akademie öffnen' },
  contBtn: { en:'Continue learning', ru:'Продолжить обучение', fr:'Continuer', de:'Weiterlernen' },
  mgrBtn: { en:'Message the manager', ru:'Написать менеджеру', fr:'Écrire au manager', de:'Manager schreiben' },
  limit: {
    en: "That's my limit for today — back tomorrow. Meanwhile, the lessons in the Courses tab cover most questions.",
    ru: 'На сегодня мой лимит исчерпан — вернусь завтра. А пока большинство ответов есть в уроках во вкладке «Курсы».',
    fr: 'J’ai atteint ma limite pour aujourd’hui — à demain. En attendant, les leçons de l’onglet Cours répondent à la plupart des questions.',
    de: 'Mein Limit für heute ist erreicht — morgen wieder. Bis dahin beantworten die Lektionen im Tab Kurse die meisten Fragen.'
  },
  approved: {
    en: '✅ Your broker account is confirmed — the base course is open! 4 lessons are waiting for you in the app.',
    ru: '✅ Твой брокерский счёт подтверждён — базовый курс открыт! В приложении тебя ждут 4 урока.',
    fr: '✅ Ton compte broker est confirmé — le cours de base est ouvert ! 4 leçons t’attendent dans l’app.',
    de: '✅ Dein Brokerkonto ist bestätigt — der Basiskurs ist offen! 4 Lektionen warten in der App auf dich.'
  },
  supportReply: {
    en: '💬 Support replied:\n\n{t}',
    ru: '💬 Ответ поддержки:\n\n{t}',
    fr: '💬 Réponse du support :\n\n{t}',
    de: '💬 Antwort vom Support:\n\n{t}'
  },
  supportOpen: { en:'Open the chat', ru:'Открыть чат', fr:'Ouvrir le chat', de:'Chat öffnen' },
  supportHello: {
    en: "Hi! I'm your personal manager at Jason's academy 👋 Anything unclear — registration, the broker account, the lessons — write right here, I answer within minutes.",
    ru: 'Привет! Я твой персональный менеджер в академии Джейсона 👋 Если что-то непонятно — регистрация, счёт у брокера, уроки — пиши прямо сюда, отвечаю в течение нескольких минут.',
    fr: "Salut ! Je suis ton manager personnel à l'académie de Jason 👋 Une question — inscription, compte broker, leçons — écris ici, je réponds en quelques minutes.",
    de: 'Hi! Ich bin dein persönlicher Manager in Jasons Akademie 👋 Fragen zu Registrierung, Brokerkonto oder Lektionen — schreib einfach hier, ich antworte in wenigen Minuten.'
  },
  depositOk: {
    en: '🎉 Deposit confirmed — welcome to the private club! The full academy (20+ lessons) is now open in the app.',
    ru: '🎉 Депозит подтверждён — добро пожаловать в закрытый клуб! Полное обучение (20+ уроков) уже открыто в приложении.',
    fr: '🎉 Dépôt confirmé — bienvenue dans le club privé ! L’académie complète (20+ leçons) est ouverte dans l’app.',
    de: '🎉 Einzahlung bestätigt — willkommen im privaten Club! Die komplette Akademie (20+ Lektionen) ist jetzt in der App offen.'
  },
  depositNo: {
    en: "We couldn't confirm the deposit yet. Remember: the minimum for VIP signals is $250. Check the details or message support in the app — we'll sort it out.",
    ru: 'Пока не получилось подтвердить депозит. Напомним: минимум для VIP-сигналов — $250. Проверь данные или напиши в поддержку в приложении — разберёмся.',
    fr: "Nous n'avons pas encore pu confirmer le dépôt. Rappel : le minimum pour les signaux VIP est de 250 $. Vérifie les infos ou écris au support dans l'app.",
    de: 'Wir konnten die Einzahlung noch nicht bestätigen. Hinweis: Das Minimum für VIP-Signale sind 250 $. Prüf die Angaben oder schreib dem Support in der App.'
  },
  rejected: {
    en: "We couldn't confirm that account as registered through our link. Check the number or message the manager — we'll sort it out.",
    ru: 'Не получилось подтвердить, что счёт открыт по нашей ссылке. Проверь номер или напиши менеджеру — разберёмся.',
    fr: 'Nous n’avons pas pu confirmer que ce compte a été ouvert via notre lien. Vérifie le numéro ou écris au manager — on va régler ça.',
    de: 'Wir konnten nicht bestätigen, dass das Konto über unseren Link eröffnet wurde. Prüf die Nummer oder schreib dem Manager — wir klären das.'
  },
  refJoined: {
    en: '🎉 A friend you invited just got full access. Invited friends: {n}.',
    ru: '🎉 Приглашённый тобой друг получил полный доступ. Приглашено друзей: {n}.',
    fr: '🎉 Un ami que tu as invité vient d’obtenir l’accès complet. Amis invités : {n}.',
    de: '🎉 Ein eingeladener Freund hat gerade vollen Zugang bekommen. Eingeladene Freunde: {n}.'
  },
  catchHandoff: {
    en: 'Still stuck? Our manager will walk you through it personally — just message: @{m}',
    ru: 'Всё ещё не получается? Менеджер лично всё покажет — просто напиши: @{m}',
    fr: 'Toujours bloqué ? Notre manager va t’aider personnellement — écris-lui : @{m}',
    de: 'Hängst du noch fest? Unser Manager hilft dir persönlich — schreib einfach: @{m}'
  },
  catchGate: {
    en: 'You are one step away from all the courses: register with the broker via our link and send your account number in the app. Questions? @{m}',
    ru: 'Ты в одном шаге от всех курсов: зарегистрируйся у брокера по нашей ссылке и отправь номер счёта в приложении. Есть вопросы? @{m}',
    fr: 'Tu es à une étape de tous les cours : inscris-toi chez le broker via notre lien et envoie ton numéro de compte dans l’appli. Des questions ? @{m}',
    de: 'Du bist nur einen Schritt von allen Kursen entfernt: Registrier dich über unseren Link beim Broker und schick deine Kontonummer in der App. Fragen? @{m}'
  },
  nudges: {
    en: ["Your streak is waiting 🔥 One 4-minute lesson keeps it alive.", "Gold didn't stop moving while you were away. Pick up where you left off — next lesson is ready.", "Rule of the day: risk is decided before entry. Want to see why? Your next lesson covers it.", "Quick one: can you size a gold trade with a $6 stop on a $1,000 account? The calculator's in the app 👇"],
    ru: ["Твоя серия ждёт 🔥 Один урок на 4 минуты — и она жива.", "Золото не стояло, пока тебя не было. Продолжи с того места, где остановился, — следующий урок готов.", "Правило дня: риск решается до входа. Хочешь понять почему? Об этом твой следующий урок.", "Быстрый вопрос: сможешь посчитать лот по золоту со стопом $6 на счёте $1 000? Калькулятор в приложении 👇"],
    fr: ["Ta série t’attend 🔥 Une leçon de 4 minutes suffit à la garder.", "L’or n’a pas arrêté de bouger pendant ton absence. Reprends là où tu t’étais arrêté — la prochaine leçon est prête.", "Règle du jour : le risque se décide avant l’entrée. Tu veux savoir pourquoi ? C’est dans ta prochaine leçon.", "Question rapide : sais-tu dimensionner un trade sur l’or avec un stop de 6 $ sur un compte de 1 000 $ ? Le calculateur est dans l’appli 👇"],
    de: ["Deine Serie wartet 🔥 Eine 4-Minuten-Lektion hält sie am Leben.", "Gold hat sich weiterbewegt, während du weg warst. Mach da weiter, wo du aufgehört hast — die nächste Lektion ist bereit.", "Regel des Tages: Risiko wird vor dem Einstieg festgelegt. Warum? Das zeigt deine nächste Lektion.", "Kurze Frage: Kannst du einen Gold-Trade mit 6 $ Stop auf einem 1.000-$-Konto dimensionieren? Der Rechner ist in der App 👇"]
  }
};
const tt = (key, lang, vars) => { let s = (T[key][lang] || T[key].en); if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''); return s; };

/* Russian labels for the sales chat */
const RU = {
  exp: { none:'Нет опыта', demo:'Только демо', lt1:'Меньше года', gt1:'Больше года' },
  markets: { forex:'Форекс', gold:'Золото', crypto:'Крипта', stocks:'Акции', none:'Ничем' },
  problem: { knowledge:'Не хватает знаний', losses:'Сливаю / убытки', discipline:'Дисциплина и эмоции', time:'Нет времени', capital:'Мало капитала' },
  time: { lt30:'< 30 мин', h1:'~1 час', h2:'2+ часа' }
};

/* ---------------- helpers ---------------- */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-key, x-session', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const esc = (s) => String(s ?? '').replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]));
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

async function verifyInitData(initData, botToken) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash'); if (!hash) return null;
  params.delete('hash');
  const dataCheck = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const enc = new TextEncoder();
  const k1 = await crypto.subtle.importKey('raw', enc.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const secret = await crypto.subtle.sign('HMAC', k1, enc.encode(botToken));
  const k2 = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k2, enc.encode(dataCheck));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hex !== hash) return null;
  try { return JSON.parse(params.get('user')); } catch { return null; }
}

async function tg(env, method, body) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return {}; }
}

/* ---------------- storage ---------------- */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, username TEXT, lang TEXT, tz REAL, first_seen INTEGER, last_seen INTEGER, last_studied INTEGER, opens INTEGER DEFAULT 0, progress TEXT, sub INTEGER, sub_at INTEGER, chat_ok INTEGER DEFAULT 0, onboard TEXT, onboarded_at INTEGER, tier INTEGER, goal_target REAL, goal_text TEXT, broker_id TEXT, gate TEXT DEFAULT 'none', gate_at INTEGER, ref_by INTEGER, nudged_at INTEGER, nudges INTEGER DEFAULT 0, handoff_at INTEGER, handoff_catch INTEGER DEFAULT 0, gate_catch INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, amount REAL, note TEXT, at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, lang TEXT, text TEXT, reply TEXT, topic TEXT, article TEXT, handoff INTEGER DEFAULT 0, at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS rewards (user_id INTEGER, tier INTEGER, at INTEGER, PRIMARY KEY (user_id, tier))`,
  `CREATE INDEX IF NOT EXISTS idx_msg_topic ON messages(topic)`,
  `CREATE INDEX IF NOT EXISTS idx_users_ref ON users(ref_by)`,
  `CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id)`,
  `CREATE TABLE IF NOT EXISTS fb_clicks (cid TEXT PRIMARY KEY, fbc TEXT, fbp TEXT, ip TEXT, ua TEXT, url TEXT, utm TEXT, ts INTEGER, tg_id INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_fb_clicks_tg ON fb_clicks(tg_id, ts)`,
  // in-app support chat: student <-> manager (managers answer by replying in the sales chat or from the admin panel)
  `CREATE TABLE IF NOT EXISTS support (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, sender TEXT, text TEXT, by TEXT, at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_support_user ON support(user_id, id)`,
  `CREATE TABLE IF NOT EXISTS support_map (chat_id TEXT, msg_id INTEGER, user_id INTEGER, PRIMARY KEY (chat_id, msg_id))`,
  // response-time SLA: one open row per student waiting for an answer; closed rows become KPI records
  `CREATE TABLE IF NOT EXISTS support_sla (user_id INTEGER PRIMARY KEY, since INTEGER, reminded INTEGER DEFAULT 0, overdue INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS support_kpi (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, by TEXT, since INTEGER, answered_at INTEGER, secs INTEGER, ontime INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_support_kpi_at ON support_kpi(answered_at)`
];
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  for (const q of SCHEMA) await env.DB.prepare(q).run();
  for (const col of ['club_joined INTEGER', 'src TEXT', 'invite TEXT', 'invite_exp INTEGER', 'vip_at INTEGER', 'vip_joined INTEGER', 'gate_msg INTEGER', 'support_seen INTEGER DEFAULT 0', 'support_admin_seen INTEGER DEFAULT 0', 'greeted INTEGER DEFAULT 0', 'dep_claim_at INTEGER', 'dep_claim TEXT', 'dep_ok_at INTEGER', 'dep_status TEXT', 'broker_shot TEXT', 'promo_at INTEGER', 'flow TEXT', 'flow_step INTEGER DEFAULT 0', 'flow_next INTEGER', 'flow_start INTEGER', 'flow_prev TEXT', 'autopush_off INTEGER DEFAULT 0', 'last_touch INTEGER', 'broker_click INTEGER', 'await_acc INTEGER', 'traded_at INTEGER', 'vip_link TEXT', 'welcomed INTEGER DEFAULT 0', 'biz_last_msg INTEGER']) { try { await env.DB.prepare('ALTER TABLE users ADD COLUMN ' + col).run(); } catch (e) {} }
  try { await env.DB.prepare('ALTER TABLE fb_clicks ADD COLUMN join_link TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE support ADD COLUMN via TEXT').run(); } catch (e) {}
  schemaReady = true;
}
const getUser = (env, id) => env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
async function upsertUser(env, tgUser) {
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO users (id, name, username, lang, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, username = COALESCE(excluded.username, users.username), last_seen = excluded.last_seen`)
    .bind(tgUser.id, tgUser.first_name || tgUser.username || null, tgUser.username || null, pickLang(tgUser.language_code), now, now).run();
  return getUser(env, tgUser.id);
}
async function setting(env, key, value) {
  if (value === undefined) { const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first(); return r ? r.value : null; }
  if (value === null) return env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
  return env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
}
async function botUsername(env) {
  let u = await setting(env, 'bot_username');
  if (!u) { const r = await tg(env, 'getMe', {}); if (r.ok) { u = r.result.username; await setting(env, 'bot_username', u); } }
  return u;
}
async function refStats(env, id) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS invited, SUM(CASE WHEN gate = 'approved' THEN 1 ELSE 0 END) AS approved FROM users WHERE ref_by = ?`).bind(id).first();
  return { invited: r?.invited || 0, approved: r?.approved || 0 };
}
async function profile(env, u) {
  const ledger = (await env.DB.prepare('SELECT id, type, amount, note, at FROM ledger WHERE user_id = ? ORDER BY at ASC').bind(u.id).all()).results || [];
  const bu = await botUsername(env);
  const ref = await refStats(env, u.id);
  return {
    onboarded: !!u.onboarded_at, onboard: u.onboard ? JSON.parse(u.onboard) : null,
    tier: u.tier, goalTarget: u.goal_target, goalText: u.goal_text,
    gate: u.gate || 'none', brokerId: u.broker_id, brokerShot: !!u.broker_shot,
    deposit: u.dep_ok_at || u.vip_at ? 'confirmed' : (u.dep_status || 'none'),
    supportUnread: (await env.DB.prepare(`SELECT COUNT(*) AS n FROM support WHERE user_id = ? AND sender = 'manager' AND id > ?`).bind(u.id, u.support_seen || 0).first())?.n || 0,
    ledger,
    ref: { link: bu ? `https://t.me/${bu}?start=ref_${u.id}` : null, invited: ref.invited, approved: ref.approved, tiers: REWARD_TIERS }
  };
}
const userLine = (u) => `👤 <b>${esc(u.name || 'без имени')}</b>${u.username ? ' @' + esc(u.username) : ''} · id <code>${u.id}</code> · ${u.lang || '?'}`;
async function toSales(env, text, extra) {
  const chat = await setting(env, 'sales_chat');
  if (!chat) return null;
  return tg(env, 'sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(extra || {}) });
}
const openButton = (env, text) => ({ inline_keyboard: [[{ text, web_app: { url: env.APP_URL } }]] });
// team DM + academy: the main CTA is the manager's DM, the mini app is the extra
const teamRow = (env, lang) => env.MANAGER ? [[{ text: tt('teamBtn', lang), url: `https://t.me/${env.MANAGER}?text=${encodeURIComponent(DM_TEXT[lang] || DM_TEXT.en)}` }]] : [];
const welcomeKb = (env, lang) => ({ inline_keyboard: [...teamRow(env, lang), [{ text: tt('courseBtn', lang), web_app: { url: env.APP_URL } }]] });
const WEBHOOK_UPDATES = ['message', 'callback_query', 'my_chat_member', 'chat_member', 'chat_join_request', 'channel_post', 'business_connection', 'business_message', 'edited_business_message'];
const RESULTS_URL = 'https://zevs2018123-cloud.github.io/jt-pro-results/';
const PUBLIC_ORIGIN = 'https://jetsjaisontraider.com';
const REF_LINK_DEFAULT = 'https://direct.fxpro.partners/click?pid=8030&offer_id=149&l=1766563852';
// greeting from the bot; the button starts the bot (so it can keep writing) and shows the promo
async function greetKb(env, lang) {
  return { inline_keyboard: [[{ text: tt('promoBtn', lang), url: `https://t.me/${await botUsername(env)}?start=promo` }], ...teamRow(env, lang)] };
}
const promoKb = (env, lang) => ({ inline_keyboard: [
  [{ text: tt('brokerBtn', lang), url: env.REF_LINK || REF_LINK_DEFAULT }],
  [{ text: tt('openBtn', lang), web_app: { url: env.APP_URL } }],
  ...teamRow(env, lang)] });
// the promo video: a /setpromo override if one is set and works, else the file hosted with the mini app
// (sent by URL once, then reused by the file_id Telegram gives back)
const PROMO_URL = 'https://zevs2018123-cloud.github.io/ai-praktikum/jason/media/promo.mp4';
async function sendPromoVideo(env, chatId, caption, reply_markup) {
  const extra = { chat_id: chatId, supports_streaming: true, ...(caption ? { caption } : {}), ...(reply_markup ? { reply_markup } : {}) };
  const v = JSON.parse((await setting(env, 'promo_video')) || 'null');
  let r = null;
  if (v && v.file_id) {
    const method = v.type === 'video_note' ? 'sendVideoNote' : v.type === 'animation' ? 'sendAnimation' : 'sendVideo';
    const key = v.type === 'video_note' ? 'video_note' : v.type === 'animation' ? 'animation' : 'video';
    r = await tg(env, method, method === 'sendVideoNote' ? { chat_id: chatId, video_note: v.file_id } : { ...extra, [key]: v.file_id });
    if (r && r.ok) return method === 'sendVideoNote' ? null : r;
    await setting(env, 'promo_video', null);   // a broken /setpromo file is dropped, the hosted promo takes over
  }
  const cached = await setting(env, 'promo_file');
  if (cached) { r = await tg(env, 'sendVideo', { ...extra, video: cached }); if (r && r.ok) return r; }
  r = await tg(env, 'sendVideo', { ...extra, video: PROMO_URL });
  if (r && r.ok && r.result && r.result.video) await setting(env, 'promo_file', r.result.video.file_id);
  return r && r.ok ? r : null;
}
// promo: the video set with /setpromo (caption = promo text when it fits), else the text placeholder
async function sendPromo(env, chatId, userId, lang) {
  const v = JSON.parse((await setting(env, 'promo_video')) || 'null');
  const text = tt('promoText', lang), reply_markup = promoKb(env, lang);
  let r = text.length <= 1000 ? await sendPromoVideo(env, chatId, text, reply_markup) : null;
  if (!r && text.length > 1000) await sendPromoVideo(env, chatId);
  if (!r || !r.ok) r = await tg(env, 'sendMessage', { chat_id: chatId, text, reply_markup });
  if (userId) await env.DB.prepare('UPDATE users SET promo_at = COALESCE(promo_at, ?) WHERE id = ?').bind(Date.now(), userId).run();
  return r;
}
async function sendCircle(env, chatId) {
  const fid = await setting(env, 'welcome_circle');
  if (fid) await tg(env, 'sendVideoNote', { chat_id: chatId, video_note: fid });
}
// join-request link to the entry channel for the landing; one per ad click (name c_<cid>) so the join is attributed.
// Falls back to one shared link if Telegram refuses (rate limit).
async function joinLink(env, cid) {
  const chat = await setting(env, 'club_chat'); if (!chat) return null;
  if (cid) {
    const ex = await env.DB.prepare('SELECT join_link FROM fb_clicks WHERE cid = ?').bind(cid).first();
    if (ex && ex.join_link) return ex.join_link;
    const r = await tg(env, 'createChatInviteLink', { chat_id: chat, name: ('c_' + cid).slice(0, 32), creates_join_request: true, expire_date: Math.floor(Date.now() / 1000) + 7 * 86400 });
    if (r.ok) {
      await env.DB.prepare('INSERT INTO fb_clicks (cid, ts, join_link) VALUES (?, ?, ?) ON CONFLICT(cid) DO UPDATE SET join_link = excluded.join_link').bind(cid, Math.floor(Date.now() / 1000), r.result.invite_link).run();
      return r.result.invite_link;
    }
  }
  const shared = await setting(env, 'join_link_shared');
  if (shared && (await setting(env, 'join_link_chat')) === chat) return shared;
  const r = await tg(env, 'createChatInviteLink', { chat_id: chat, name: 'landing', creates_join_request: true });
  if (!r.ok) return null;
  await setting(env, 'join_link_shared', r.result.invite_link); await setting(env, 'join_link_chat', chat);
  return r.result.invite_link;
}
async function handleJoin(req, env, url) {
  if ((await setting(env, 'landing_mode')) === 'bot') return json({ url: null });
  const link = await joinLink(env, cleanCid(url.searchParams.get('cid')));
  return json({ url: link });
}
const mgrButton = (env, lang) => env.MANAGER ? { inline_keyboard: [[{ text: tt('mgrBtn', lang), url: `https://t.me/${env.MANAGER}` }]] } : undefined;

async function isSubscribed(env, userId) {
  const chat = (await setting(env, 'club_chat')) || env.CHANNEL_ID;
  if (!chat) return true;
  const r = await tg(env, 'getChatMember', { chat_id: chat, user_id: userId });
  if (!r.ok) return true; // fail open if Telegram can't answer
  return ['creator', 'administrator', 'member', 'restricted'].includes(r.result.status);
}

async function authed(req, env) {
  const body = await req.json().catch(() => ({}));
  const tgUser = await verifyInitData(body.initData, env.BOT_TOKEN);
  if (!tgUser) return { body, error: json({ error: 'bad initData' }, 401) };
  const u = await upsertUser(env, tgUser);
  return { body, tgUser, u };
}

/* ---------------- Meta Conversions API ----------------
   Funnel: landing → ViewContent, /start → CompleteRegistration, questionnaire → Lead,
   broker account sent → SubmitApplication, manager approved → Purchase (value = starting deposit). */
async function sha256(v) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(v).trim().toLowerCase()));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const cleanCid = v => String(v || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);

async function sendCapi(env, cid, eventName, { tgId, custom, eventId } = {}) {
  if (!env.PIXEL_ID || !env.CAPI_TOKEN) return null;
  try {
    const c = await env.DB.prepare('SELECT fbc, fbp, ip, ua, url FROM fb_clicks WHERE cid = ?').bind(cid).first();
    if (!c) return null;
    const user_data = {};
    if (c.fbc) user_data.fbc = c.fbc;
    if (c.fbp) user_data.fbp = c.fbp;
    if (c.ip) user_data.client_ip_address = c.ip;
    if (c.ua) user_data.client_user_agent = c.ua;
    if (tgId) user_data.external_id = [await sha256(tgId)];
    const event = { event_name: eventName, event_time: Math.floor(Date.now() / 1000), event_id: eventId || `${cid}_${eventName}`,
      action_source: 'website', event_source_url: c.url, user_data };
    if (custom) event.custom_data = custom;
    const body = { data: [event] };
    if (env.TEST_EVENT_CODE) body.test_event_code = env.TEST_EVENT_CODE;
    const r = await fetch(`https://graph.facebook.com/v21.0/${env.PIXEL_ID}/events?access_token=${env.CAPI_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const res = await r.json().catch(() => null);
    if (!r.ok) console.log('CAPI error', eventName, JSON.stringify(res));
    return res;
  } catch (e) { console.log('CAPI failed', eventName, String(e && e.message || e)); return null; }
}

// funnel step for a Telegram user who came from an ad (no-op otherwise)
async function capiByUser(env, tgId, eventName, custom) {
  if (!env.PIXEL_ID || !env.CAPI_TOKEN) return null;
  const row = await env.DB.prepare('SELECT cid FROM fb_clicks WHERE tg_id = ? ORDER BY ts DESC LIMIT 1').bind(tgId).first();
  return row ? sendCapi(env, row.cid, eventName, { tgId, custom }) : null;
}

async function handleTrack(req, env, ctx) {
  let d; try { d = JSON.parse(await req.text()); } catch { return json({ error: 'bad json' }, 400); } // sendBeacon = text/plain
  const cid = cleanCid(d.cid);
  if (!cid) return json({ error: 'no cid' }, 400);
  await env.DB.prepare('INSERT OR IGNORE INTO fb_clicks (cid, fbc, fbp, ip, ua, url, utm, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
    cid, d.fbc ? String(d.fbc).slice(0, 300) : null, d.fbp ? String(d.fbp).slice(0, 100) : null,
    req.headers.get('CF-Connecting-IP') || null, String(d.ua || req.headers.get('User-Agent') || '').slice(0, 400) || null,
    d.url ? String(d.url).slice(0, 1000) : null, JSON.stringify(d.utm || {}).slice(0, 500), Math.floor(Date.now() / 1000)).run();
  ctx.waitUntil(sendCapi(env, cid, 'ViewContent', { eventId: cid })); // dedup with the browser pixel
  return json({ ok: true });
}

/* ---------------- app routes ---------------- */
async function handleOpen(req, env) {
  const { body, u, error } = await authed(req, env); if (error) return error;
  const now = Date.now();
  const sets = [], vals = [];
  const set = (k, v) => { sets.push(k + ' = ?'); vals.push(v); };
  if (!body.progressOnly) set('opens', (u.opens || 0) + 1);
  if (body.studied) set('last_studied', now);
  if (body.progress) set('progress', JSON.stringify(body.progress));
  if (typeof body.tz === 'number') set('tz', body.tz);
  if (body.lang) set('lang', pickLang(body.lang));
  let sub = u.sub;
  if (body.recheck || u.sub !== 1 || !u.sub_at || now - u.sub_at > 600e3) { sub = (await isSubscribed(env, u.id)) ? 1 : 0; set('sub', sub); set('sub_at', now); }
  if (sets.length) await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, u.id).run();
  if (!u.greeted) {
    await env.DB.prepare(`INSERT INTO support (user_id, sender, text, by, at) VALUES (?, 'manager', ?, 'system', ?)`).bind(u.id, tt('supportHello', pickLang(body.lang || u.lang)), now).run();
    await env.DB.prepare('UPDATE users SET greeted = 1 WHERE id = ?').bind(u.id).run();
  }
  const videos = JSON.parse((await setting(env, 'videos')) || '{}');
  const channel = sub === 0 ? ((await clubInvite(env, u.id)) || env.CHANNEL_LINK || null) : (env.CHANNEL_LINK || null);
  return json({ access: sub !== 0, channel, me: await profile(env, { ...u, sub }), videos, manager: env.MANAGER || null });
}

async function handleOnboard(req, env) {
  const { body, u, error } = await authed(req, env); if (error) return error;
  const a = body.answers || {};
  const clean = { exp: String(a.exp || ''), markets: (Array.isArray(a.markets) ? a.markets : []).map(String).slice(0, 6), problem: String(a.problem || ''), time: String(a.time || '') };
  const tier = [250, 1000, 10000].includes(Number(body.tier)) ? Number(body.tier) : null;
  const target = Math.max(0, Math.min(1e9, Number(body.target) || 0)) || null;
  const goalText = String(body.goalText || '').slice(0, 200);
  const first = !u.onboarded_at;
  await env.DB.prepare('UPDATE users SET onboard = ?, onboarded_at = COALESCE(onboarded_at, ?), tier = ?, goal_target = ?, goal_text = ? WHERE id = ?')
    .bind(JSON.stringify(clean), Date.now(), tier, target, goalText, u.id).run();
  const ref = u.ref_by ? await getUser(env, u.ref_by) : null;
  await toSales(env, [
    first ? '🆕 <b>Новая анкета</b>' : '✏️ <b>Анкета обновлена</b>', userLine(u),
    `Опыт: ${RU.exp[clean.exp] || '—'}`,
    `Торговал: ${clean.markets.map(m => RU.markets[m] || m).join(', ') || '—'}`,
    `Главная проблема: ${RU.problem[clean.problem] || '—'}`,
    `Время в день: ${RU.time[clean.time] || '—'}`,
    `Стартовый депозит: ${tier ? money(tier) : '—'}`,
    `Цель: ${target ? money(target) : '—'}${goalText ? ' — ' + esc(goalText) : ''}`,
    ref ? `Пригласил: ${esc(ref.name || '')}${ref.username ? ' @' + esc(ref.username) : ''}` : ''
  ].filter(Boolean).join('\n'));
  if (first) await capiByUser(env, u.id, 'Lead');
  if (first && (!u.gate || u.gate === 'none') && (!u.flow || u.flow === 'W' || u.flow === 'R1')) await setFlow(env, u.id, 'R2');
  return json({ ok: true, me: await profile(env, await getUser(env, u.id)) });
}

/* a screenshot from the app (data:image/...;base64) → photo in the managers' chat; returns the Telegram file_id */
async function photoToSales(env, img, caption, kb) {
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(String(img || ''));
  if (!m || m[2].length > 7e6) return { error: 'bad image' };
  const sales = await setting(env, 'sales_chat'); if (!sales) return { fileId: null };
  const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
  const fd = new FormData();
  fd.append('chat_id', sales); fd.append('caption', caption.slice(0, 1000)); fd.append('parse_mode', 'HTML');
  if (kb) fd.append('reply_markup', JSON.stringify(kb));
  fd.append('photo', new Blob([bin], { type: m[1] }), 'proof.' + m[1].split('/')[1]);
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`, { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({}));
  if (!r.ok) { await toSales(env, caption + '\n\n⚠️ Скриншот не загрузился в Telegram — попросите ученика прислать номер счёта.', kb ? { reply_markup: kb } : {}); return { fileId: null }; }
  return { fileId: r.result.photo[r.result.photo.length - 1].file_id };
}

async function handleBroker(req, env) {
  const { body, u, error } = await authed(req, env); if (error) return error;
  const acc = String(body.accountId || '').replace(/[^\w-]/g, '').slice(0, 32);
  const img = String(body.image || '');
  if (acc.length < 4 && !img) return json({ error: 'bad account' }, 400);
  if (u.gate === 'approved') return json({ ok: true, me: await profile(env, u) });
  const kb = { inline_keyboard: [[{ text: '✅ Подтвердить', callback_data: `gate:approved:${u.id}` }, { text: '❌ Отклонить', callback_data: `gate:rejected:${u.id}` }], [{ text: '💰 Депозит внесён → выдать VIP', callback_data: `vip:${u.id}` }]] };
  const cap = ['🔐 <b>Запрос доступа к курсам</b>', userLine(u), acc.length >= 4 ? `Счёт у брокера: <code>${esc(acc)}</code>` : '📷 Прислал скриншот кабинета брокера', 'Проверь в партнёрском кабинете, что счёт открыт по нашей ссылке.'].join('\n');
  let shot = null;
  if (img) { const r = await photoToSales(env, img, cap, kb); if (r.error) return json({ error: r.error }, 400); shot = r.fileId || 'none'; }
  else await toSales(env, cap, { reply_markup: kb });
  await env.DB.prepare(`UPDATE users SET broker_id = ?, broker_shot = ?, gate = 'pending', gate_at = ? WHERE id = ?`).bind(acc.length >= 4 ? acc : (u.broker_id || null), shot || u.broker_shot || null, Date.now(), u.id).run();
  await crmLog(env, u.id, 'ученик', 'прислал ' + (acc.length >= 4 ? 'счёт ' + acc : '') + (acc.length >= 4 && img ? ' и ' : '') + (img ? 'скриншот кабинета брокера' : ''));
  if (u.gate !== 'pending') await capiByUser(env, u.id, 'SubmitApplication');
  await setFlow(env, u.id, null);
  return json({ ok: true, me: await profile(env, await getUser(env, u.id)) });
}

async function handleLedger(req, env) {
  const { body, u, error } = await authed(req, env); if (error) return error;
  if (body.deleteId) {
    await env.DB.prepare('DELETE FROM ledger WHERE id = ? AND user_id = ?').bind(Number(body.deleteId), u.id).run();
  } else {
    const type = ['deposit', 'withdrawal', 'balance'].includes(body.type) ? body.type : null;
    const amount = Number(body.amount);
    if (!type || !(amount >= 0) || amount > 1e9) return json({ error: 'bad entry' }, 400);
    await env.DB.prepare('INSERT INTO ledger (user_id, type, amount, note, at) VALUES (?, ?, ?, ?, ?)').bind(u.id, type, amount, String(body.note || '').slice(0, 80), Date.now()).run();
  }
  return json({ ok: true, me: await profile(env, u) });
}

async function setGate(env, id, status, by) {
  const u = await getUser(env, id); if (!u) return null;
  if (!['approved', 'rejected', 'pending', 'none'].includes(status)) return null;
  await env.DB.prepare('UPDATE users SET gate = ?, gate_at = ? WHERE id = ?').bind(status, Date.now(), id).run();
  if (status === 'approved' && u.gate !== 'approved') await setFlow(env, id, 'R3');
  if (status === 'rejected') await setFlow(env, id, 'R2');
  const lang = pickLang(u.lang);
  if (status === 'approved' && u.gate !== 'approved') {
    await tg(env, 'sendMessage', { chat_id: id, text: tt('approved', lang), reply_markup: openButton(env, tt('openBtn', lang)) });
    await capiByUser(env, id, 'Purchase', { value: u.tier || 250, currency: 'USD' });
    if (u.ref_by) {
      const r = await getUser(env, u.ref_by);
      const st = await refStats(env, u.ref_by);
      if (r) await tg(env, 'sendMessage', { chat_id: r.id, text: tt('refJoined', pickLang(r.lang), { n: st.approved }) });
      if (r && REWARD_TIERS.includes(st.approved)) await toSales(env, `🎁 <b>Реферальный приз</b>: ${userLine(r)}\nДостиг уровня <b>${st.approved}</b> подтверждённых друзей — выдать приз.`);
    }
  }
  if (status === 'rejected') await tg(env, 'sendMessage', { chat_id: id, text: tt('rejected', lang), reply_markup: mgrButton(env, lang) });
  return { ...u, gate: status, by };
}

/* ---------------- support chat ---------------- */
const supportMsgs = async (env, uid) => ((await env.DB.prepare('SELECT id, sender, text, by, at, via FROM support WHERE user_id = ? ORDER BY id DESC LIMIT 100').bind(uid).all()).results || []).reverse();
async function handleSupport(req, env) {
  const { body, u, error } = await authed(req, env); if (error) return error;
  const text = String(body.text || '').trim().slice(0, 1000);
  if (text) {
    const hour = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM support WHERE user_id = ? AND sender = 'user' AND at > ?`).bind(u.id, Date.now() - HOUR).first())?.n || 0;
    if (hour >= 30) return json({ error: 'rate', msgs: await supportMsgs(env, u.id) }, 429);
    await env.DB.prepare(`INSERT INTO support (user_id, sender, text, at, via) VALUES (?, 'user', ?, ?, 'app')`).bind(u.id, text, Date.now()).run();
    await env.DB.prepare('INSERT OR IGNORE INTO support_sla (user_id, since) VALUES (?, ?)').bind(u.id, Date.now()).run();
    const gate = { none: 'счёт не отправлен', pending: `${u.broker_id ? 'счёт ' + esc(u.broker_id) : 'скриншот счёта'} на проверке`, approved: 'доступ открыт', rejected: 'счёт отклонён' }[u.gate || 'none'] || '';
    const r = await toSales(env, ['🆘 <b>Поддержка</b>', userLine(u), gate ? 'Статус: ' + gate : '', '', esc(text), '', '↩️ <i>Ответьте реплаем на это сообщение — ответ придёт ученику в приложение и в бот.</i>'].filter((x, i) => x || i === 3 || i === 5).join('\n'));
    if (r && r.ok) await env.DB.prepare('INSERT OR REPLACE INTO support_map (chat_id, msg_id, user_id) VALUES (?, ?, ?)').bind(String(r.result.chat.id), r.result.message_id, u.id).run();
  }
  const msgs = await supportMsgs(env, u.id);
  const lastMgr = msgs.filter(m => m.sender === 'manager').pop();
  if (lastMgr && lastMgr.id > (u.support_seen || 0)) await env.DB.prepare('UPDATE users SET support_seen = ? WHERE id = ?').bind(lastMgr.id, u.id).run();
  return json({ ok: true, msgs, online: !!(await setting(env, 'sales_chat')) });
}
/* ---- one inbox for the app chat, the bot chat and Jason's work account (Telegram Business) ---- */
const VIA_LABEL = { app: 'чат в приложении', bot: 'чат бота', jason: 'аккаунт Джейсона' };
function msgPayload(m) {
  // what a Telegram message carries: text for the inbox + the media to show the managers
  const cap = (m.caption || '').trim();
  const media = m.photo ? { kind: 'photo', file_id: m.photo[m.photo.length - 1].file_id, label: '📷 фото' }
    : m.video ? { kind: 'video', file_id: m.video.file_id, label: '🎬 видео' }
    : m.voice ? { kind: 'voice', file_id: m.voice.file_id, label: '🎙 голосовое' }
    : m.video_note ? { kind: 'video_note', file_id: m.video_note.file_id, label: '⏺ кружок' }
    : m.audio ? { kind: 'audio', file_id: m.audio.file_id, label: '🎵 аудио' }
    : m.document ? { kind: 'document', file_id: m.document.file_id, label: '📎 ' + (m.document.file_name || 'файл') }
    : m.sticker ? { kind: 'sticker', file_id: m.sticker.file_id, label: (m.sticker.emoji || '') + ' стикер' } : null;
  const text = (m.text || '').trim() || [media && media.label, cap].filter(Boolean).join(' ') || '';
  return { text: text.slice(0, 2000), media };
}
async function sendMediaTo(env, chatId, media, extra) {
  const method = { photo: 'sendPhoto', video: 'sendVideo', voice: 'sendVoice', video_note: 'sendVideoNote', audio: 'sendAudio', document: 'sendDocument', sticker: 'sendSticker' }[media.kind];
  return method ? tg(env, method, { chat_id: chatId, [media.kind]: media.file_id, ...(extra || {}) }) : null;
}
async function inboundSupport(env, u, text, via, media) {
  if (!text) return { ok: false };
  const hour = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM support WHERE user_id = ? AND sender = 'user' AND at > ?`).bind(u.id, Date.now() - HOUR).first())?.n || 0;
  if (hour >= 30) return { ok: false, rate: true };
  await env.DB.prepare(`INSERT INTO support (user_id, sender, text, at, via) VALUES (?, 'user', ?, ?, ?)`).bind(u.id, text, Date.now(), via).run();
  await env.DB.prepare('INSERT OR IGNORE INTO support_sla (user_id, since) VALUES (?, ?)').bind(u.id, Date.now()).run();
  const gate = { none: 'счёт не отправлен', pending: `${u.broker_id ? 'счёт ' + esc(u.broker_id) : 'скриншот счёта'} на проверке`, approved: 'доступ открыт', rejected: 'счёт отклонён' }[u.gate || 'none'] || '';
  const head = via === 'jason' ? '💬 <b>Написали в аккаунт Джейсона</b>' : via === 'bot' ? '💬 <b>Написали в бот</b>' : '🆘 <b>Поддержка (приложение)</b>';
  const hint = via === 'jason' ? '↩️ <i>Ответьте реплаем или в CRM — ответ уйдёт от аккаунта Джейсона.</i>' : '↩️ <i>Ответьте реплаем или в CRM — ответ придёт в бот.</i>';
  const r = await toSales(env, [head, userLine(u), gate ? 'Статус: ' + gate : '', '', esc(text), '', hint].filter((x, i) => x || i === 3 || i === 5).join('\n'));
  const map = (res) => res && res.ok ? env.DB.prepare('INSERT OR REPLACE INTO support_map (chat_id, msg_id, user_id) VALUES (?, ?, ?)').bind(String(res.result.chat.id), res.result.message_id, u.id).run() : null;
  await map(r);
  if (media && r && r.ok) await map(await sendMediaTo(env, r.result.chat.id, media, { reply_to_message_id: r.result.message_id }));
  return { ok: true };
}
async function bizConn(env) { return JSON.parse((await setting(env, 'biz_conn')) || 'null'); }
// the channel the manager's answer goes back through = where the person wrote last
async function replyVia(env, uid) {
  const last = await env.DB.prepare(`SELECT via FROM support WHERE user_id = ? AND sender = 'user' ORDER BY id DESC LIMIT 1`).bind(uid).first();
  return (last && last.via) || 'app';
}
async function supportReply(env, uid, text, by, forceVia) {
  const u = await getUser(env, uid); if (!u) return { ok: false, error: 'no user' };
  text = String(text || '').trim().slice(0, 2000); if (!text) return { ok: false, error: 'empty' };
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO support (user_id, sender, text, by, at) VALUES (?, 'manager', ?, ?, ?)`).bind(uid, text, String(by || '').slice(0, 64), now).run();
  const sla = await env.DB.prepare('SELECT * FROM support_sla WHERE user_id = ?').bind(uid).first();
  if (sla) {
    const secs = Math.round((now - sla.since) / 1000), limit = (await slaCfg(env)).minutes * 60;
    await env.DB.prepare('INSERT INTO support_kpi (user_id, by, since, answered_at, secs, ontime) VALUES (?, ?, ?, ?, ?, ?)').bind(uid, String(by || '?').slice(0, 64), sla.since, now, secs, secs <= limit ? 1 : 0).run();
    await env.DB.prepare('DELETE FROM support_sla WHERE user_id = ?').bind(uid).run();
  }
  const lang = pickLang(u.lang), via = forceVia || await replyVia(env, uid);
  let r = null;
  await env.DB.prepare('UPDATE support SET via = ? WHERE id = (SELECT MAX(id) FROM support WHERE user_id = ? AND sender = ?)').bind(via, uid, 'manager').run();
  if (via === 'jason') {
    // a conversation from Jason's DM is answered only from Jason's DM, never from the bot
    const bc = await bizConn(env);
    let why = '';
    if (!bc || !bc.enabled) why = 'аккаунт Джейсона не подключён к боту';
    else if (!bc.can_reply) why = 'боту не дали право отвечать (Telegram для бизнеса → Чат-боты → «Отвечать на сообщения»)';
    else {
      // read the client's messages first, like a person would, then answer
      if (u.biz_last_msg && bc.can_read !== false) await tg(env, 'readBusinessMessage', { business_connection_id: bc.id, chat_id: uid, message_id: u.biz_last_msg });
      r = await tg(env, 'sendMessage', { business_connection_id: bc.id, chat_id: uid, text }); if (!r || !r.ok) why = (r && r.description) || 'Telegram не принял сообщение'; }
    if (why) await toSales(env, `❗ Ответ ${userLine(u)} не ушёл в личку Джейсона: ${esc(why)}.\nНапишите ему прямо из аккаунта Джейсона:\n\n${esc(text)}`);
    return { ok: true, delivered: !why, via, error: why || undefined };
  }
  if (via === 'bot') r = await tg(env, 'sendMessage', { chat_id: uid, text });
  if (!r || !r.ok) r = await tg(env, 'sendMessage', { chat_id: uid, text: tt('supportReply', lang, { t: text }), reply_markup: openButton(env, tt('supportOpen', lang)) });
  if (r && r.ok) await setFlow(env, uid, 'R6', { prev: u.flow || null });
  return { ok: true, delivered: !!(r && r.ok), via };
}

/* ---------------- support SLA (response-time KPI) ----------------
   Settings (CRM → Настройки): minutes limit, reminder minute, where alerts go, working hours. */
async function slaCfg(env) {
  const c = JSON.parse((await setting(env, 'sla_cfg')) || '{}');
  return { minutes: c.minutes || 10, remind: c.remind || 7, target: c.target || 'sales', chat: c.chat || null, hours: c.hours || null, tz: c.tz ?? 3 };
}
function slaWorkingNow(cfg, t) {
  if (!cfg.hours) return true;                       // 24/7
  const [a, b] = String(cfg.hours).split('-').map(Number);
  const h = (new Date(t).getUTCHours() + Math.round(cfg.tz) + 48) % 24;
  return a <= b ? h >= a && h < b : h >= a || h < b;
}
async function slaAlert(env, cfg, uid, text) {
  const chat = cfg.target === 'chat' && cfg.chat ? cfg.chat : await setting(env, 'sales_chat');
  if (!chat) return;
  const r = await tg(env, 'sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true });
  // a reply to the alert also goes to the student
  if (r && r.ok) await env.DB.prepare('INSERT OR REPLACE INTO support_map (chat_id, msg_id, user_id) VALUES (?, ?, ?)').bind(String(r.result.chat.id), r.result.message_id, uid).run();
}
async function slaTick(env) {
  const cfg = await slaCfg(env), now = Date.now();
  if (!slaWorkingNow(cfg, now)) return;
  const rows = (await env.DB.prepare('SELECT s.*, u.name, u.username, u.id AS uid, u.lang FROM support_sla s JOIN users u ON u.id = s.user_id WHERE s.overdue = 0').all()).results || [];
  for (const r of rows) {
    const mins = (now - r.since) / 60000;
    const last = await env.DB.prepare(`SELECT text FROM support WHERE user_id = ? AND sender = 'user' ORDER BY id DESC LIMIT 1`).bind(r.user_id).first();
    const quote = last ? '\n\n«' + esc(String(last.text).slice(0, 300)) + '»' : '';
    if (mins >= cfg.minutes) {
      await env.DB.prepare('UPDATE support_sla SET overdue = 1, reminded = 1 WHERE user_id = ?').bind(r.user_id).run();
      await slaAlert(env, cfg, r.user_id, `🔴 <b>Просрочен ответ (${cfg.minutes} мин)</b>\n${userLine({ ...r, id: r.uid })}${quote}\n\n↩️ <i>Ответьте реплаем — ответ уйдёт ученику.</i>`);
    } else if (!r.reminded && mins >= cfg.remind) {
      await env.DB.prepare('UPDATE support_sla SET reminded = 1 WHERE user_id = ?').bind(r.user_id).run();
      await slaAlert(env, cfg, r.user_id, `⏰ <b>Осталось ${Math.max(1, Math.round(cfg.minutes - mins))} мин на ответ</b>\n${userLine({ ...r, id: r.uid })}${quote}\n\n↩️ <i>Ответьте реплаем — ответ уйдёт ученику.</i>`);
    }
  }
}

/* ---------------- deposit: student proof → manager confirms → club + full academy ---------------- */
async function handleDeposit(req, env) {
  const { body, u, error } = await authed(req, env); if (error) return error;
  if (u.dep_ok_at || u.vip_at) return json({ ok: true, me: await profile(env, u) });
  const acc = String(body.accountId || '').replace(/[^\w-]/g, '').slice(0, 32);
  const img = String(body.image || '');
  if (!acc && !img) return json({ error: 'need proof' }, 400);
  const kb = { inline_keyboard: [[{ text: '💰 Депозит подтверждён → клуб + полный курс', callback_data: `dep:ok:${u.id}` }], [{ text: '❌ Не подтверждён', callback_data: `dep:no:${u.id}` }]] };
  const cap = ['💰 <b>Ученик сообщил о депозите</b>', userLine(u), u.broker_id ? 'Счёт (вход): <code>' + esc(u.broker_id) + '</code>' : '', acc ? 'Счёт пополнения: <code>' + esc(acc) + '</code>' : '', 'Проверьте пополнение в партнёрском кабинете: <b>минимум $250</b> (лот 0.03 на каждые $250).'].filter(Boolean).join('\n');
  let fileId = null;
  if (img) { const r = await photoToSales(env, img, cap, kb); if (r.error) return json({ error: r.error }, 400); fileId = r.fileId; }
  else await toSales(env, cap, { reply_markup: kb });
  await env.DB.prepare(`UPDATE users SET dep_claim_at = ?, dep_claim = ?, dep_status = 'pending' WHERE id = ?`).bind(Date.now(), JSON.stringify({ acc: acc || null, photo: fileId, hasImage: !!img }), u.id).run();
  await crmLog(env, u.id, 'ученик', 'сообщил о депозите' + (acc ? ', счёт ' + acc : '') + (img ? ', скриншот' : ''));
  await setFlow(env, u.id, null);
  return json({ ok: true, me: await profile(env, await getUser(env, u.id)) });
}
async function confirmDeposit(env, id, ok, by) {
  const u = await getUser(env, id); if (!u) return { ok: false, error: 'user' };
  const lang = pickLang(u.lang);
  if (!ok) {
    await env.DB.prepare(`UPDATE users SET dep_status = 'rejected' WHERE id = ?`).bind(id).run();
    await tg(env, 'sendMessage', { chat_id: id, text: tt('depositNo', lang), reply_markup: openButton(env, tt('supportOpen', lang)) });
    await crmLog(env, id, by, 'депозит не подтверждён');
    return { ok: true };
  }
  const first = !u.dep_ok_at;
  await env.DB.prepare(`UPDATE users SET dep_ok_at = COALESCE(dep_ok_at, ?), dep_status = 'confirmed' WHERE id = ?`).bind(Date.now(), id).run();
  const c = await crmRow(env, id); if (!c.stage || c.stage === 'отказ') { c.stage = 'депозит'; await crmSave(env, c); }
  if (first) {
    await tg(env, 'sendMessage', { chat_id: id, text: tt('depositOk', lang), reply_markup: openButton(env, tt('openBtn', lang)) });
    await capiByUser(env, id, 'Purchase', { value: c.amount || u.tier || 250, currency: 'USD' });
  }
  const vip = await grantVip(env, id, by);   // personal invite to the club, if the VIP channel is connected
  await setFlow(env, id, vip.ok ? 'R4' : null);
  await crmLog(env, id, by, 'депозит подтверждён' + (vip.ok ? ', выдан пропуск в клуб' : ''));
  return { ok: true, vip: vip.ok, vipError: vip.ok ? null : vip.error };
}

/* ---------------- chat ---------------- */
function parseTags(text) {
  const out = { topic: null, article: null, handoff: false };
  let clean = String(text || '');
  clean = clean.replace(/\[TOPIC:\s*([^\]]+)\]/i, (_, t) => { out.topic = t.trim().toLowerCase().slice(0, 40); return ''; });
  clean = clean.replace(/\[ARTICLE:\s*([a-z_]+)\]/i, (_, a) => { if (ARTICLES[a.toLowerCase()]) out.article = a.toLowerCase(); return ''; });
  clean = clean.replace(/\[HANDOFF\]/i, () => { out.handoff = true; return ''; });
  out.text = clean.replace(/\[[A-Z]+[^\]]*\]/g, '').trim();
  return out;
}

async function handleChat(req, env) {
  const { body, u, tgUser, error } = await authed(req, env);
  if (error) return json({ reply: 'Open the academy from Telegram to chat with me.' });
  const msg = String(body.message || '').slice(0, 1500);
  const lang = pickLang(body.lang || u.lang);
  if (!msg) return json({ reply: '' });
  const day = new Date().toISOString().slice(0, 10);
  const used = (await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND at > ?').bind(u.id, Date.parse(day)).first())?.n || 0;
  if (used >= CHAT_LIMIT_PER_DAY) return json({ reply: tt('limit', lang) });

  if (body.chip && ARTICLES[body.chip]) {
    await env.DB.prepare('INSERT INTO messages (user_id, lang, text, reply, topic, article, handoff, at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)')
      .bind(u.id, lang, msg, '', body.chip.replace(/_/g, ' '), body.chip, Date.now()).run();
    return json({ reply: '', article: body.chip, handoff: null });
  }
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8).map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (history.length && history[0].role !== 'user') history.shift();
  const messages = [...history, { role: 'user', content: msg }];
  const ctx = [
    tgUser.first_name ? `Student's name: ${tgUser.first_name}.` : '',
    `Student status: onboarding ${u.onboarded_at ? 'done' : 'not done'}, broker registration ${u.gate || 'none'}.`,
    `The app is set to ${LANG_NAMES[lang]}. Reply in ${LANG_NAMES[lang]} unless the student clearly writes in another language.`
  ].join('\n');
  const system = SYSTEM + '\n' + ctx;

  let raw = null;
  try {
    if (env.ANTHROPIC_API_KEY) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 500, system, messages })
      });
      const data = await r.json().catch(() => null);
      raw = data && data.content && data.content[0] && data.content[0].text;
    } else if (env.AI) {
      const out = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'system', content: system }, ...messages], max_tokens: 450 });
      raw = out && out.response;
    }
  } catch { raw = null; }

  const p = parseTags(raw);
  if (!p.handoff && HANDOFF_WORDS.test(msg) && /(app|bot|приложен|бот|регистр|register|account|счёт|счет|доступ|access|deposit|пополн|manager|менеджер|support|поддержк|human|человек|compte|konto|appli)/i.test(msg)) p.handoff = true;
  const reply = p.text || '';
  await env.DB.prepare('INSERT INTO messages (user_id, lang, text, reply, topic, article, handoff, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(u.id, lang, msg, reply.slice(0, 2000), p.topic || 'other', p.article, p.handoff ? 1 : 0, Date.now()).run();

  let handoff = null;
  if (p.handoff && env.MANAGER) {
    handoff = { username: env.MANAGER };
    if (!u.handoff_at || Date.now() - u.handoff_at > 6 * HOUR) {
      await env.DB.prepare('UPDATE users SET handoff_at = ?, handoff_catch = 0 WHERE id = ?').bind(Date.now(), u.id).run();
      await toSales(env, ['🆘 <b>Нужна помощь менеджера</b>', userLine(u), `Статус: анкета ${u.onboarded_at ? '✅' : '—'}, доступ: ${u.gate || 'none'}`, `Вопрос: «${esc(msg.slice(0, 400))}»`].join('\n'));
    }
  }
  return json({ reply: reply || (handoff ? '' : "Couldn't answer that one — try rephrasing."), article: p.article, handoff });
}

/* ---------------- bot webhook ---------------- */
async function clubInvite(env, userId) {
  const chat = await setting(env, 'club_chat');
  if (!chat) return null;
  const u = await getUser(env, userId);
  if (u && u.invite && u.invite_exp > Date.now() + 4 * HOUR) return u.invite;
  const r = await tg(env, 'createChatInviteLink', { chat_id: chat, name: ('u' + userId).slice(0, 32), member_limit: 1, expire_date: Math.floor(Date.now() / 1000) + 86400 });
  if (!r.ok) return null;
  await env.DB.prepare('UPDATE users SET invite = ?, invite_exp = ? WHERE id = ?').bind(r.result.invite_link, Date.now() + DAY, userId).run();
  return r.result.invite_link;
}
async function grantVip(env, id, by) {
  const u = await getUser(env, id); if (!u) return { ok: false, error: 'user' };
  const chat = await setting(env, 'vip_chat'); if (!chat) return { ok: false, error: 'vip_not_connected' };
  const r = await tg(env, 'createChatInviteLink', { chat_id: chat, name: ('vip' + id).slice(0, 32), member_limit: 1, expire_date: Math.floor(Date.now() / 1000) + 7 * 86400 });
  if (!r.ok) return { ok: false, error: 'invite_failed' };
  const lang = pickLang(u.lang);
  await tg(env, 'sendMessage', { chat_id: id, text: tt('vipInvite', lang), reply_markup: { inline_keyboard: [[{ text: tt('vipBtn', lang), url: r.result.invite_link }]] } });
  await env.DB.prepare('UPDATE users SET vip_at = ?, vip_link = ? WHERE id = ?').bind(Date.now(), r.result.invite_link, id).run();
  await toSales(env, `💎 VIP-доступ выдан: ${userLine(u)} (выдал: ${esc(by || '—')})`);
  return { ok: true };
}
async function sendSubGate(env, chatId, userId, lang) {
  // one gate message per chat: a repeated /start replaces the old one instead of stacking duplicates
  const prev = await env.DB.prepare('SELECT gate_msg FROM users WHERE id = ?').bind(userId).first();
  if (prev && prev.gate_msg) await tg(env, 'deleteMessage', { chat_id: chatId, message_id: prev.gate_msg });
  const link = (await clubInvite(env, userId)) || env.CHANNEL_LINK;
  const row = link ? [[{ text: tt('subBtn', lang), url: link }]] : [];
  if (!prev || !prev.gate_msg) await sendCircle(env, chatId);
  const r = await tg(env, 'sendMessage', { chat_id: chatId, text: tt('subGate', lang), reply_markup: { inline_keyboard: [...row, [{ text: tt('checkBtn', lang), callback_data: 'subchk' }], ...teamRow(env, lang)] } });
  if (r && r.ok) await env.DB.prepare('UPDATE users SET gate_msg = ? WHERE id = ?').bind(r.result.message_id, userId).run();
  return r;
}
// Turn the subscription-gate message into the "You're in" message in place (keeps the chat clean).
// Falls back to a new message if the gate message is gone or can't be edited.
async function showClubWelcome(env, chatId, userId, lang, msgId) {
  if (msgId) await tg(env, 'deleteMessage', { chat_id: chatId, message_id: msgId });
  await env.DB.prepare('UPDATE users SET gate_msg = NULL WHERE id = ?').bind(userId).run();
  const u = await getUser(env, userId);
  if (u && !u.welcomed) await startWelcome(env, u, chatId, PUBLIC_ORIGIN);
  return { ok: true };
}

/* ================= Bot touch grid (W welcome + R1–R7 reactivation) =================
   One scenario per user (users.flow / flow_step / flow_next / flow_start). runFlows() runs every minute
   from the scheduler, sends due steps (10:00–21:00 client time, paused while a live dialog is going on),
   and every client action is pushed to the managers' group. Texts: EN + RU (FR/DE fall back to EN).
   Content slots (/slot … in the managers' group) feed the touches; a touch whose attachment slot is empty is skipped. */
const DM_TEXT = { en: 'Hi Jason! I want to trade with you', ru: 'Привет, Джейсон! Хочу торговать вместе с тобой' };
const FL_T = {
  w1: {
    en: "Hey! 👋\n\nI see you just joined my channel. Welcome!\n\nThis is my main channel. Here I run an open challenge: turning $10,000 into a million, and every trade goes out to the channel, win or loss.\n\nBut I've got something more valuable for you: free access to my academy and my X100 system, where the goal is to grow your deposit 100x step by step. There I show how I trade gold and help you get into trades together with me, even with a small deposit.\n\nTo get access, tap the button below 👇 or just type \"yes\".",
    ru: "Привет! 👋\n\nВижу, ты только что подписался на мой канал. Добро пожаловать!\n\nЭто мой основной канал. Здесь я в открытую веду челлендж: делаю из $10 000 один миллион, и каждая сделка выходит в канал, плюсовая или минусовая.\n\nНо у меня для тебя есть кое-что ценнее: бесплатный доступ в мою академию и систему X100, где цель — шаг за шагом сделать 100 иксов к своему депозиту. Там я показываю, как торгую золотом, и помогаю зайти в сделки вместе со мной, даже с небольшим депозитом.\n\nЧтобы забрать доступ, жми кнопку ниже 👇 или просто напиши «да»."
  },
  w2: {
    en: "Great! Glad you didn't put it off 🤝\n\nI'll send you how to get into the academy in the next message, but first a quick intro.\n\nA bit about me:\n— trading for more than 5 years\n— running a public challenge right now: $10,000 → $1,000,000\n— the challenge account since the start: {BALANCE}\n\nHere are all the accounts our signals run on, live, every trade visible: {MONITORING}",
    ru: "Отлично! Рад, что не стал откладывать 🤝\n\nСейчас пришлю, как зайти в академию. Это придёт следующим сообщением, а пока хочу коротко познакомиться.\n\nКоротко обо мне:\n— торгую уже более 5 лет\n— сейчас веду публичный челлендж $10 000 → $1 000 000\n— с начала челленджа счёт: {BALANCE}\n\nЗдесь все счета, по которым идут сигналы, в реальном времени, каждая сделка видна: {MONITORING}"
  },
  w3: {
    en: "To get into the academy and trade together with me, do one of two things:\n\n1️⃣ Open an account with my broker using the button below. No need to fund it yet, the lessons open for free.\n2️⃣ Or message me directly if your deposit is over $10,000: we'll go through how to start with your amount and I'll add you to the VIP group.",
    ru: "Чтобы попасть в академию и торговать вместе со мной, сделай одно из двух:\n\n1️⃣ Открой счёт у моего брокера по кнопке ниже. Пополнять пока не нужно, уроки откроются бесплатно.\n2️⃣ Или напиши мне в личку, если твой депозит больше $10 000: разберём, как зайти именно с твоей суммой, и добавлю тебя в VIP-группу."
  },
  w4: {
    en: "Safety comes first in the academy.\n\nYour money stays in your own account with a regulated broker. I don't manage it and have no access to it. You withdraw whenever you want.\n\nAnd everything I post is backed by reviews from people who are already inside.\n\n👉 See for yourself 👆",
    ru: "Безопасность — главное в академии.\n\nТвои деньги лежат на твоём счёте у регулируемого брокера. Я ими не управляю и доступа к ним у меня нет. Выводишь когда хочешь.\n\nА всё, что я публикую, подтверждают отзывы ребят, которые уже внутри.\n\n👉 Убедись сам 👆"
  },
  r1_1: { en: "Here's how we closed today's gold session 👇\nThis is what goes out in the channel every day: entry, stop, take profit, step by step.\nWant to know how to start with your amount? Message me.",
          ru: "Вот как сегодня закрыли сессию по золоту 👇\nЭто то, что выходит в канале каждый день: вход, стоп, тейк, всё по шагам.\nХочешь понять, как зайти с твоей суммой? Напиши мне." },
  r1_2: { en: "People often ask me why I give all this away for free when others sell the same for $500–1000 a month.\n\nHonest answer: I get a commission from the broker on trading volume. You pay me nothing. If you blow your account and leave, I earn nothing. If you're in profit and trade for years, we both earn.\n\nThat's why I don't sell courses, I build a team.",
          ru: "Меня часто спрашивают: зачем я даю всё это бесплатно, если другие продают такое за $500–1000 в месяц.\n\nОтвечаю честно. Я получаю комиссию от брокера за торговый оборот. Ты мне ничего не платишь. Если ты сольёшь счёт и уйдёшь, я ничего не заработаю. Если ты в плюсе и торгуешь годами, зарабатываем оба.\n\nПоэтому я не продаю курсы, а собираю команду." },
  r1_3: { en: "Just look at what people who are already inside are saying 👇\nWant the same? Message me, I'll walk you through it.",
          ru: "Просто взгляни, что пишут ребята, которые уже внутри 👇\nЗахочешь так же, напиши мне, проведу по шагам." },
  r1_4: { en: "People often tell me: \"I have a job, a family, no time for charts.\"\n\nThat's normal. Trading with me isn't hours at the screen. 2–5 trades a day, and for each one you see right away where to enter, where the stop is and where we take profit. Open, repeat, 3–5 minutes from your phone.\n\nThe market is closed on weekends, so you rest in peace.",
          ru: "Мне часто пишут: «у меня работа, семья, нет времени на графики».\n\nЭто нормально. Трейдинг со мной не про часы у монитора. 2–5 сделок в день, по каждой сразу видно, где вход, где стоп и где забираем прибыль. Открыл, повторил, 3–5 минут с телефона.\n\nНа выходных рынок закрыт, отдыхаешь спокойно." },
  r1_5: { en: "{CASE}\n\nNo luck involved: following the signals, risking 1–2%, 1–2 trades a day.\nIf you want to start the same way, message me and I'll show you how he started.",
          ru: "{CASE}\n\nБез везения: по сигналам, с риском 1–2%, по 1–2 сделки в день.\nЕсли хочешь начать так же, напиши, покажу, как он заходил." },
  r1_7: { en: "Let me ask straight: is this still on for you, or not the right time?\nThe challenge this week: {WEEK}. All trades are open: {MONITORING}\nIf you're interested, we'll start on a demo, no strings attached. If not now, tap \"Later\" and I won't bother you.",
          ru: "Скажу прямо: тема ещё живая или сейчас не до этого?\nЧеллендж за неделю: {WEEK}, все сделки открыты: {MONITORING}\nЕсли интересно, начнём с демо, ни к чему не обязывает. Если не сейчас, нажми «Позже», я не буду дёргать." },
  r1_8: { en: "This is the last time I write about this, I don't like to push.\nThe challenge goes on, results are in the channel every day. When you're ready, message me, I'm here. Good luck 🤝",
          ru: "Последний раз пишу по этой теме, навязываться не люблю.\nЧеллендж идёт, результаты каждый день в канале. Когда будешь готов, напиши, я на связи. Удачи 🤝" },
  r2_1: { en: "I see you've started registering 👍 It usually takes 5 minutes. If you got stuck somewhere (verification, documents, no code), message me and I'll walk you through it.\nOnce the account is open, send me its number and I'll open the first lessons.",
          ru: "Вижу, ты начал регистрацию 👍 Обычно это 5 минут. Если где-то застрял (верификация, документы, не приходит код), напиши, проведу по шагам.\nКак откроешь счёт, пришли его номер мне, и я открою первые уроки." },
  r2_2: { en: "What stopped you? Pick one and I'll sort it out right away 👇", ru: "Что остановило? Выбери, разберу сразу 👇" },
  r2_3: { en: "That's how it went in the channel today. Reminder: you don't need to fund the account to get into the academy. Open an account through the link, send the number, get the lessons.",
          ru: "Сегодня в канале вот так. Напомню: для входа в академию пополнять счёт не нужно. Открыл счёт по ссылке, прислал номер, получил уроки." },
  r2_4: { en: "Why this broker: it's regulated, the money stays in your account, withdrawals any time. And only through our link can I see that you're with me and open the academy and support for you.",
          ru: "Почему именно этот брокер: он регулируемый, деньги хранятся на твоём счёте, вывод в любой момент. И только по нашей ссылке я вижу, что ты со мной, и могу открыть тебе академию и сопровождение." },
  r2_5: { en: "Last reminder about registration. The link works and your place in the academy is waiting. When you're ready, message me.",
          ru: "Последнее напоминание по регистрации. Ссылка рабочая, место в академии за тобой. Когда будешь готов, напиши." },
  r3_1: { en: "Your 4 lessons are already open. Waiting for you in the academy 🎓", ru: "Твои 4 урока уже открыты. Жду тебя в академии 🎓" },
  r3_2: { en: "To trade together with me on the signals you need a working account. Minimum $250, and it's not a payment to me: the money stays in your account, you trade it and withdraw whenever you want.\nPeople who are still looking around start with $250. With $1,000 it's more comfortable to keep risk at 1–2%.",
          ru: "Чтобы торговать вместе со мной по сигналам, нужен рабочий счёт. Минимум $250, и это не оплата мне: деньги лежат на твоём счёте, ты ими торгуешь и выводишь когда хочешь.\nС $250 начинают те, кто пока присматривается. С $1 000 работать комфортнее по риску 1–2%." },
  r3_3: { en: "This is what happened in the VIP group today. Inside: the same breakdown of every trade and a curator who walks you into your first trade.",
          ru: "Вот что сегодня было в VIP-группе. Внутри тот же разбор каждой сделки и куратор, который проведёт тебя в первую сделку." },
  r3_5: { en: "Scared to start with real money? Your first trade is the minimum lot, with a curator next to you. It's more careful than it seems.",
          ru: "Боишься начинать с реальными деньгами? Первая сделка с минимальным лотом, куратор рядом. Это осторожнее, чем кажется." },
  r3_6: { en: "What's holding you back right now: the amount, the payment method or the format itself? Tell me honestly and I'll sort it out.",
          ru: "Что сейчас держит: сумма, способ оплаты или сам формат? Скажи честно, разберу." },
  r3_7: { en: "Last reminder: your account is open and the academy is waiting. When you're ready to fund it, message me and I'll connect you to VIP in 10 minutes.",
          ru: "Последнее напоминание: счёт открыт, академия ждёт. Когда будешь готов пополнить, напиши, подключу к VIP за 10 минут." },
  r4_1: { en: "Your VIP group pass hasn't been used yet. Today's signals are inside, come in 👇", ru: "Твой пропуск в VIP-группу ещё не использован. Внутри сигналы на сегодня, заходи 👇" },
  r4_2: { en: "The pass is valid for 6 more days. If the link doesn't open, message me and I'll send a new one.", ru: "Пропуск действует ещё 6 дней. Если ссылка не открывается, напиши, пришлю новую." },
  r5_1: { en: "Welcome 🤝 One rule: you trade only on the signals and with 1–2% risk per trade. Make your first trade with the minimum lot. The terminal guide is in the academy.",
          ru: "Добро пожаловать 🤝 Правило одно: торгуешь только по сигналам и с риском 1–2% на сделку. Первую сделку делай минимальным лотом. Гайд по терминалу в академии." },
  r5_2: { en: "Haven't made your first trade yet? That's normal. Message me and we'll go through the next signal together, on your account.",
          ru: "Ещё не зашёл в первую сделку? Это нормально. Напиши, разберём следующий сигнал вместе, на твоём счёте." },
  r5_3: { en: "How's it going? The goal isn't to copy forever, it's to understand why the entry is right here. If you want a breakdown of your trades, message me.",
          ru: "Как идёт? Цель не вечно копировать, а понимать, почему вход именно здесь. Если хочешь разбор своих сделок, напиши." },
  r6_1: { en: "Did you manage to sort it out? If you still have questions, ask, I'll help.", ru: "Получилось разобраться? Если остались вопросы, спрашивай, помогу." },
  r6_2: { en: "Morning 👋 If you've made up your mind, message me and we'll pick up where we left off.", ru: "Доброе 👋 Если надумал, напиши, продолжим с того места, где остановились." },
  r7_1: { en: "Hi! A month ago you looked at the academy. Since then the challenge has gone {MONTH}. If it's relevant again, message me and we'll pick up where you stopped.",
          ru: "Привет! Месяц назад ты смотрел академию. За это время челлендж прошёл {MONTH}. Если тема снова актуальна, напиши, начнём с того места, где ты остановился." },
  r7_2: { en: "A quick update from the challenge. The door is open 🤝", ru: "Короткий апдейт по челленджу. Дверь открыта 🤝" },
  // replies to answer buttons
  a_yes: { en: "Great! Jason's team will message you shortly. Want it faster? Write first 👇", ru: "Отлично! Команда Джейсона напишет тебе в ближайшее время. Хочешь быстрее? Напиши сам 👇" },
  a_later: { en: "Got it, I won't bother you. When you're ready, just message me 🤝", ru: "Понял, не буду дёргать. Когда будешь готов, просто напиши 🤝" },
  a_stuck: { en: "Here's how to register in 4 steps:\n1. Tap \"Open an account\" and fill in email and password.\n2. Confirm the email / phone code.\n3. Complete verification (ID + address), usually takes a few minutes.\n4. Send me the account number here.\n\nA manager will join within 15 minutes.",
             ru: "Регистрация в 4 шага:\n1. Жми «Открыть счёт», укажи почту и пароль.\n2. Подтверди код из почты / СМС.\n3. Пройди верификацию (документ + адрес), обычно несколько минут.\n4. Пришли мне номер счёта сюда.\n\nМенеджер подключится в течение 15 минут." },
  a_sendacc: { en: "Send the account number in the next message (digits only) and I'll pass it for review.", ru: "Пришли номер счёта следующим сообщением (только цифры), и я отправлю его на проверку." },
  a_accok: { en: "✅ Got it! The account is under review, usually up to 1 hour. I'll message you as soon as the lessons are open.", ru: "✅ Принял! Счёт на проверке, обычно до 1 часа. Напишу, как только уроки откроются." },
  a_notime: { en: "OK, I'll remind you tomorrow 👍", ru: "Ок, напомню завтра 👍" },
  a_paid: { en: "Great! Send a screenshot of the deposit or the account number in the academy, and I'll connect you to VIP 👇", ru: "Отлично! Пришли скрин пополнения или номер счёта в академии, и я подключу тебя к VIP 👇" },
  a_payfail: { en: "No need to change the broker. Three ways that usually work:\n• a card in your local currency\n• crypto (USDT via an exchange)\n• P2P\nTell me which one suits you, a manager will walk you through it.",
               ru: "Брокера менять не нужно. Три способа, которые обычно проходят:\n• карта в локальной валюте\n• крипта (USDT через биржу)\n• P2P\nНапиши, какой удобнее, менеджер проведёт по шагам." },
  a_why: { en: "Tell me in a couple of words what exactly is holding you back, I'll sort it out right now.", ru: "Напиши парой слов, что конкретно держит, разберу прямо сейчас." },
  a_traded: { en: "🔥 Nice! Send a screenshot of the trade, I'll check that everything is right.", ru: "🔥 Красавчик! Скинь скрин сделки, гляну, всё ли ровно." },
  a_help: { en: "A manager will message you within 15 minutes. You can also write the question right here.", ru: "Менеджер напишет тебе в течение 15 минут. Можешь сразу написать вопрос сюда." }
};
const FL_B = {
  get: { en: '🎁 Get access', ru: '🎁 Получить доступ' }, dm: { en: '💬 Message Jason', ru: '💬 Написать Джейсону' },
  acc: { en: '📝 Open an account', ru: '📝 Открыть счёт' }, app: { en: '🎓 Open the Academy', ru: '🎓 Открыть Академию' },
  yes: { en: 'Yes, tell me', ru: 'Да, расскажи' }, start: { en: "Let's start", ru: 'Давай начнём' }, later: { en: 'Later', ru: 'Позже' },
  stuck: { en: 'Stuck on registration', ru: 'Застрял на регистрации' }, sendacc: { en: 'Send account number', ru: 'Прислать номер счёта' },
  dontget: { en: "Don't get how to register", ru: 'Не понял, как зарегистрироваться' }, doubt: { en: 'Not sure about the broker', ru: 'Сомневаюсь в брокере' },
  notime: { en: 'No time right now', ru: 'Нет времени сейчас' }, lesson: { en: '🎓 Open the lesson', ru: '🎓 Открыть урок' },
  paid: { en: 'I funded it', ru: 'Пополнил' }, payfail: { en: "Payment doesn't go through", ru: 'Не проходит оплата' },
  sum: { en: 'Amount', ru: 'Сумма' }, pay: { en: 'Payment', ru: 'Оплата' }, unsure: { en: 'Not sure', ru: 'Сомневаюсь' },
  vip: { en: '💎 Join VIP', ru: '💎 Вступить в VIP' }, traded: { en: 'Made a trade ✅', ru: 'Зашёл в сделку ✅' }, help: { en: 'Need help', ru: 'Нужна помощь' }
};
const fl = (k, lang) => (FL_T[k][lang] || FL_T[k].en);
const flb = (k, lang) => (FL_B[k][lang] || FL_B[k].en);
const FL_ACTION_RU = { yes: '🔥 нажал «Да, расскажи»', start: '🔥 нажал «Давай начнём»', later: 'нажал «Позже» (пауза 30 дней)', stuck: '⚠️ застрял на регистрации', dontget: '⚠️ не понял, как зарегистрироваться',
  doubt: 'сомневается в брокере', notime: 'нет времени (напомним завтра)', sendacc: 'хочет прислать номер счёта', paid: '💰 говорит, что пополнил', payfail: '⚠️ не проходит оплата',
  sum: 'держит сумма', pay: 'держит способ оплаты', unsure: 'сомневается в формате', traded: '✅ зашёл в первую сделку', help: '⚠️ просит помощь в VIP' };

/* schedule helpers: a step runs `after` ms after the previous one, or on day D of the scenario at local hour H */
const MIN = 60e3;
function userTz(u) { if (typeof u.tz === 'number' && !isNaN(u.tz)) return u.tz; return pickLang(u.lang) === 'ru' ? 3 : 1; }
function atLocal(start, tz, day, hour) {
  const d = new Date(start + tz * HOUR); d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - tz * HOUR + (day - 1) * DAY + hour * HOUR;
}
function inQuiet(t, tz) { const h = new Date(t + tz * HOUR).getUTCHours(); return h < 10 || h >= 21; }
function nextDaytime(t, tz) {
  if (!inQuiet(t, tz)) return t;
  const loc = new Date(t + tz * HOUR); const h = loc.getUTCHours();
  loc.setUTCHours(10, 0, 0, 0); let r = loc.getTime() - tz * HOUR; if (h >= 21) r += DAY;
  return r;
}
// flow definitions. att: slot that must exist (photo/text), else the step is skipped
const FLOWS = {
  W: [{ k: 'w4', after: 30 * MIN, att: 'review', opt: true, kb: ['dm'] }],
  R1: [{ k: 'r1_1', after: 3 * HOUR, att: 'result', kb: ['dm', 'yes'] }, { k: 'r1_2', day: 2, hour: 10, kb: ['dm'] }, { k: 'r1_3', day: 2, hour: 13, att: 'review', kb: ['dm', 'yes'] },
       { k: 'r1_4', day: 2, hour: 18, kb: ['dm'] }, { k: 'r1_5', day: 3, hour: 12, att: 'case', kb: ['dm'] }, { k: 'r1_7', day: 9, hour: 12, att: 'week', kb: ['start', 'later'] },
       { k: 'r1_8', day: 14, hour: 12, att: 'result', kb: ['dm'], final: true }],
  R2: [{ k: 'r2_1', after: 30 * MIN, kb: ['stuck', 'sendacc', 'dm'] }, { k: 'r2_2', day: 2, hour: 10, kb: ['dontget', 'doubt', 'notime', 'later'] }, { k: 'r2_3', day: 3, hour: 12, att: 'result', kb: ['acc', 'dm'] },
       { k: 'r2_4', day: 6, hour: 12, kb: ['acc', 'later'] }, { k: 'r2_5', day: 10, hour: 12, kb: ['acc', 'dm'], final: true }],
  R3: [{ k: 'r3_1', day: 2, hour: 12, kb: ['lesson'], cond: 'noLesson' }, { k: 'r3_2', day: 3, hour: 12, kb: ['paid', 'payfail', 'dm'] }, { k: 'r3_3', day: 4, hour: 12, att: 'result', kb: ['paid', 'dm'] },
       { k: 'r3_5', day: 7, hour: 12, att: 'review', kb: ['paid', 'dm'] }, { k: 'r3_6', day: 10, hour: 12, kb: ['sum', 'pay', 'unsure', 'later'] }, { k: 'r3_7', day: 15, hour: 12, kb: ['dm'], final: true }],
  R4: [{ k: 'r4_1', after: 2 * HOUR, kb: ['vip'], cond: 'notInVip' }, { k: 'r4_2', after: 22 * HOUR, kb: ['vip', 'dm'], cond: 'notInVip', final: true }],
  R5: [{ k: 'r5_1', after: 1 * HOUR, kb: ['app', 'traded', 'help'] }, { k: 'r5_2', day: 3, hour: 12, kb: ['traded', 'help'], cond: 'notTraded' }, { k: 'r5_3', day: 10, hour: 12, kb: ['dm'], final: true, noCold: true }],
  R6: [{ k: 'r6_1', after: 3 * HOUR, kb: ['dm'] }, { k: 'r6_2', day: 2, hour: 10, att: 'result', kb: ['dm'], resume: true }],
  R7: [{ k: 'r7_1', after: 30 * DAY, kb: ['dm'], need: 'month' }, { k: 'r7_2', after: 45 * DAY, att: 'result', kb: ['dm'], final: true, noCold: true }]
};
async function slots(env) { return JSON.parse((await setting(env, 'slots')) || '{}'); }
async function dmUrl(env, lang) { return env.MANAGER ? `https://t.me/${env.MANAGER}?text=${encodeURIComponent(DM_TEXT[lang] || DM_TEXT.en)}` : null; }
async function flowKb(env, u, keys, lang, origin) {
  const rows = [];
  for (const k of keys) {
    if (k === 'dm') { const d = await dmUrl(env, lang); if (d) rows.push([{ text: flb('dm', lang), url: d }]); }
    else if (k === 'acc') rows.push([{ text: flb('acc', lang), url: `${origin || ''}/r/broker?u=${u.id}` }]);
    else if (k === 'app' || k === 'lesson') rows.push([{ text: flb(k, lang), web_app: { url: env.APP_URL } }]);
    else if (k === 'vip') { if (u.vip_link) rows.push([{ text: flb('vip', lang), url: u.vip_link }]); }
    else rows.push([{ text: flb(k, lang), callback_data: 'fl:' + k }]);
  }
  return { inline_keyboard: rows };
}
function fillSlots(text, s) {
  const map = { BALANCE: s.balance && s.balance.text, MONITORING: (s.monitoring && s.monitoring.text) || RESULTS_URL, WEEK: s.week && s.week.text, MONTH: s.month && s.month.text,
    CASE: s.cases && s.cases.length ? s.cases[(Date.now() / DAY | 0) % s.cases.length].text : null };
  // a line whose slot is empty is dropped instead of showing a placeholder
  return text.split('\n').filter(l => { const m = l.match(/\{(\w+)\}/g); return !m || m.every(x => map[x.slice(1, -1)]); })
    .map(l => l.replace(/\{(\w+)\}/g, (_, k) => map[k])).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function slotMedia(s, att) {
  if (att === 'result') return s.result && s.result.photo ? s.result : null;
  if (att === 'week') return s.week && (s.week.photo || s.week.text) ? s.week : null;
  if (att === 'review') return s.reviews && s.reviews.length ? s.reviews[(Date.now() / HOUR | 0) % s.reviews.length] : null;
  if (att === 'case') return s.cases && s.cases.length ? s.cases[(Date.now() / DAY | 0) % s.cases.length] : null;
  return null;
}
async function sendTouch(env, u, k, keys, att, origin, opt) {
  const lang = pickLang(u.lang), s = await slots(env);
  const media = att ? slotMedia(s, att) : null;
  let text = fillSlots(fl(k, lang), s);
  if (opt && !media) text = text.split('\n\n').slice(0, -1).join('\n\n'); // optional attachment missing → drop the "see it 👆" line
  const reply_markup = await flowKb(env, u, keys, lang, origin);
  let r;
  if (media && media.photo) {
    if (text.length <= 1000) r = await tg(env, 'sendPhoto', { chat_id: u.id, photo: media.photo, caption: text, reply_markup });
    else { await tg(env, 'sendPhoto', { chat_id: u.id, photo: media.photo, caption: (media.caption || '').slice(0, 1000) }); r = await tg(env, 'sendMessage', { chat_id: u.id, text, reply_markup, disable_web_page_preview: true }); }
  } else r = await tg(env, 'sendMessage', { chat_id: u.id, text, reply_markup, disable_web_page_preview: true });
  if (r && r.ok === false && r.error_code === 403) await env.DB.prepare('UPDATE users SET chat_ok = 0, flow = NULL WHERE id = ?').bind(u.id).run();
  return r;
}
async function setFlow(env, uid, flow, opts = {}) {
  const now = Date.now(), u = await getUser(env, uid); if (!u) return;
  if (!flow) { await env.DB.prepare('UPDATE users SET flow = NULL, flow_step = 0, flow_next = NULL WHERE id = ?').bind(uid).run(); return; }
  const start = opts.start || now, steps = FLOWS[flow], st = steps[0], tz = userTz(u);
  const next = st.after != null ? start + st.after : atLocal(start, tz, st.day, st.hour);
  await env.DB.prepare('UPDATE users SET flow = ?, flow_step = 0, flow_start = ?, flow_next = ?, flow_prev = ? WHERE id = ?')
    .bind(flow, start, next, opts.prev || null, uid).run();
}
function condOk(cond, u) {
  if (!cond) return true;
  if (cond === 'noLesson') { try { return !(JSON.parse(u.progress || '{}').lessons > 0); } catch { return true; } }
  if (cond === 'notInVip') return !u.vip_joined;
  if (cond === 'notTraded') return !u.traded_at;
  return true;
}
async function lastSupport(env, uid, sender) {
  const r = await env.DB.prepare('SELECT at FROM support WHERE user_id = ? AND sender = ? ORDER BY id DESC LIMIT 1').bind(uid, sender).first();
  return r ? r.at : 0;
}
// stage a user should be in when a dialog pause / R6 ends
function stageFlow(u) {
  if (u.vip_joined) return u.traded_at ? null : 'R5';
  if (u.dep_ok_at || u.dep_status === 'pending') return u.vip_link && !u.vip_joined ? 'R4' : null;
  if (u.gate === 'approved') return 'R3';
  if (u.gate === 'pending') return null;
  if (u.broker_click || u.onboarded_at) return 'R2';
  return 'R1';
}
async function runFlows(env, origin) {
  const now = Date.now();
  const rows = (await env.DB.prepare('SELECT * FROM users WHERE flow IS NOT NULL AND flow_next <= ? AND chat_ok = 1 AND COALESCE(autopush_off, 0) = 0 LIMIT 200').bind(now).all()).results || [];
  for (const u of rows) {
    const steps = FLOWS[u.flow]; const i = u.flow_step || 0; const st = steps && steps[i];
    if (!st) { await setFlow(env, u.id, null); continue; }
    const tz = userTz(u);
    // live dialog → wait (R6 itself is started by the manager's reply, so it ignores the manager pause)
    const lu = await lastSupport(env, u.id, 'user'), lm = await lastSupport(env, u.id, 'manager');
    let until = lu + DAY; if (u.flow !== 'R6') until = Math.max(until, lm + 12 * HOUR);
    if (u.flow === 'R6' && lu > (u.flow_start || 0)) { await setFlow(env, u.id, null); continue; }
    if (until > now && lu + lm > 0) { await env.DB.prepare('UPDATE users SET flow_next = ? WHERE id = ?').bind(nextDaytime(until, tz), u.id).run(); continue; }
    if (inQuiet(now, tz)) { await env.DB.prepare('UPDATE users SET flow_next = ? WHERE id = ?').bind(nextDaytime(now, tz), u.id).run(); continue; }
    const s = await slots(env);
    const skip = !condOk(st.cond, u) || (st.att && !st.opt && !slotMedia(s, st.att)) || (st.need && !(s[st.need] && s[st.need].text));
    if (!skip) {
      await sendTouch(env, u, st.k, st.kb, st.att, origin, st.opt);
      await env.DB.prepare('UPDATE users SET last_touch = ? WHERE id = ?').bind(now, u.id).run();
    }
    // advance
    const nx = steps[i + 1];
    if (!nx) {
      if (u.flow === 'W') { await setFlow(env, u.id, (await getUser(env, u.id)).broker_click ? 'R2' : 'R1', { start: now }); continue; }
      if (st.resume) { const fu = await getUser(env, u.id); const f = stageFlow(fu); if (f) await setFlow(env, u.id, f, { start: now }); else await setFlow(env, u.id, null); continue; }
      if (st.final && !st.noCold) { await setFlow(env, u.id, 'R7', { start: now }); continue; }
      await setFlow(env, u.id, null); continue;
    }
    const next = nx.after != null ? now + nx.after : Math.max(atLocal(u.flow_start, tz, nx.day, nx.hour), now + 2 * HOUR);
    await env.DB.prepare('UPDATE users SET flow_step = ?, flow_next = ? WHERE id = ?').bind(i + 1, next, u.id).run();
  }
}
async function opPush(env, u, what) { await toSales(env, `🔔 ${userLine(u)}\n${what}`); }
// W2 + W3 right after "Get access" / "yes" / /start; W4 and the rest go through the scheduler
async function startWelcome(env, u, chatId, origin) {
  const lang = pickLang(u.lang), s = await slots(env);
  await tg(env, 'sendMessage', { chat_id: chatId, text: fillSlots(fl('w2', lang), s), disable_web_page_preview: true });
  const v = JSON.parse((await setting(env, 'promo_video')) || 'null');
  const kb = await flowKb(env, u, ['acc', 'app', 'dm'], lang, origin), text = fl('w3', lang);
  let r = null;
  r = await sendPromoVideo(env, chatId, text, kb);
  if (!r || !r.ok) await tg(env, 'sendMessage', { chat_id: chatId, text, reply_markup: kb });
  await env.DB.prepare('UPDATE users SET promo_at = COALESCE(promo_at, ?), welcomed = 1 WHERE id = ?').bind(Date.now(), u.id).run();
  await setFlow(env, u.id, 'W');
  await opPush(env, u, '▶️ получил приветствие (W2–W3)');
}
async function submitBrokerFromBot(env, u, acc) {
  const kb = { inline_keyboard: [[{ text: '✅ Подтвердить', callback_data: `gate:approved:${u.id}` }, { text: '❌ Отклонить', callback_data: `gate:rejected:${u.id}` }], [{ text: '💰 Депозит внесён → выдать VIP', callback_data: `vip:${u.id}` }]] };
  await toSales(env, ['🔐 <b>Запрос доступа к курсам (из бота)</b>', userLine(u), `Счёт у брокера: <code>${esc(acc)}</code>`, 'Проверь в партнёрском кабинете, что счёт открыт по нашей ссылке.'].join('\n'), { reply_markup: kb });
  await env.DB.prepare(`UPDATE users SET broker_id = ?, gate = 'pending', gate_at = ? WHERE id = ?`).bind(acc, Date.now(), u.id).run();
  await crmLog(env, u.id, 'ученик', 'прислал счёт ' + acc + ' в бот');
  if (u.gate !== 'pending') await capiByUser(env, u.id, 'SubmitApplication');
  await setFlow(env, u.id, null);
}
async function flowCallback(env, cq, origin) {
  const k = cq.data.slice(3), u = await upsertUser(env, cq.from), lang = pickLang(u.lang || cq.from.language_code), now = Date.now();
  await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id });
  await opPush(env, u, FL_ACTION_RU[k] || ('нажал ' + k));
  const say = async (key, keys) => tg(env, 'sendMessage', { chat_id: u.id, text: fl(key, lang), reply_markup: keys ? await flowKb(env, u, keys, lang, origin) : undefined });
  if (k === 'yes' || k === 'start') { await say('a_yes', ['dm']); await setFlow(env, u.id, null); }
  else if (k === 'later' ) { await say('a_later'); await setFlow(env, u.id, 'R7', { start: now }); }
  else if (k === 'stuck' || k === 'dontget') { await say('a_stuck', ['acc', 'sendacc']); await env.DB.prepare('UPDATE users SET flow_next = ? WHERE id = ?').bind(now + DAY, u.id).run(); }
  else if (k === 'sendacc') { await say('a_sendacc'); await env.DB.prepare('UPDATE users SET await_acc = ? WHERE id = ?').bind(now, u.id).run(); }
  else if (k === 'doubt') { await say('r2_4', ['acc', 'dm']); }
  else if (k === 'notime') { await say('a_notime'); await env.DB.prepare('UPDATE users SET flow_next = ? WHERE id = ?').bind(now + DAY, u.id).run(); }
  else if (k === 'paid') { await say('a_paid', ['app']); }
  else if (k === 'payfail' || k === 'pay') { await say('a_payfail', ['dm']); }
  else if (k === 'sum' || k === 'unsure') { await say('a_why', ['dm']); }
  else if (k === 'traded') { await env.DB.prepare('UPDATE users SET traded_at = COALESCE(traded_at, ?) WHERE id = ?').bind(now, u.id).run(); await say('a_traded'); if (u.flow === 'R5') await setFlow(env, u.id, null); }
  else if (k === 'help') { await say('a_help', ['dm']); }
  return new Response('ok');
}
// /slot commands in the managers' group (reply to a photo, or text after the command)
async function slotCommand(env, m, text) {
  const cmd = text.split(/\s+/)[0].replace(/@\w+$/, '').toLowerCase(), arg = text.slice(text.split(/\s+/)[0].length).trim();
  const rm = m.reply_to_message || {}, photo = rm.photo ? rm.photo[rm.photo.length - 1].file_id : null, cap = (arg || rm.caption || rm.text || '').trim();
  const s = await slots(env); let msg = null;
  if (cmd === '/slots') {
    const ok = (x) => x ? '✅' : '—';
    msg = `Слоты касаний:\n✅ мониторинг — ${s.monitoring ? s.monitoring.text : 'сайт статистики (по умолчанию)'} · сменить: /set_monitoring <ссылка>\n${ok(s.balance)} баланс — /set_balance <текст>\n${ok(s.week)} итог недели — ответить на скрин: /slot_week <итог>\n${ok(s.month)} итог месяца — /set_month <текст>\n${ok(s.result)} результат дня — ответить на скрин: /slot_result\n${(s.reviews || []).length} отзывов — ответить на скрин: /slot_review (/clear_reviews)\n${(s.cases || []).length} кейсов — ответить на скрин: /slot_case <история> (/clear_cases)`;
  } else if (cmd === '/set_monitoring' && arg) { s.monitoring = { text: arg }; msg = '✅ Мониторинг сохранён'; }
  else if (cmd === '/set_balance' && arg) { s.balance = { text: arg }; msg = '✅ Баланс сохранён'; }
  else if (cmd === '/set_month' && arg) { s.month = { text: arg }; msg = '✅ Итог месяца сохранён'; }
  else if (cmd === '/slot_week' && (photo || cap)) { s.week = { photo, text: cap || (s.week && s.week.text) }; msg = '✅ Итог недели сохранён'; }
  else if (cmd === '/slot_result' && photo) { s.result = { photo, caption: cap, at: Date.now() }; msg = '✅ Результат дня сохранён'; }
  else if (cmd === '/slot_review' && photo) { s.reviews = (s.reviews || []).concat([{ photo, caption: cap }]).slice(-8); msg = `✅ Отзыв добавлен (в ротации ${s.reviews.length})`; }
  else if (cmd === '/slot_case' && (photo || cap)) { s.cases = (s.cases || []).concat([{ photo, text: cap }]).slice(-4); msg = `✅ Кейс добавлен (в ротации ${s.cases.length})`; }
  else if (cmd === '/clear_reviews') { s.reviews = []; msg = 'Отзывы очищены'; }
  else if (cmd === '/clear_cases') { s.cases = []; msg = 'Кейсы очищены'; }
  else msg = 'Не понял команду. Список: /slots';
  if (cmd !== '/slots') await setting(env, 'slots', JSON.stringify(s));
  await tg(env, 'sendMessage', { chat_id: m.chat.id, text: msg });
}

async function handleWebhook(req, env) {
  const upd = await req.json().catch(() => ({}));
  // Jason's work account connected to the bot (Telegram Business): its chats land in the CRM inbox
  if (upd.business_connection) {
    const bc = upd.business_connection;
    const canReply = bc.rights ? !!bc.rights.can_reply : !!bc.can_reply;
    const canRead = bc.rights ? !!bc.rights.can_read_messages : canReply;
    if (bc.is_enabled) {
      await setting(env, 'biz_conn', JSON.stringify({ id: bc.id, user_id: bc.user.id, username: bc.user.username || '', name: bc.user.first_name || '', can_reply: canReply, can_read: canRead, enabled: true }));
      await toSales(env, `🔗 Аккаунт ${bc.user.username ? '@' + esc(bc.user.username) : esc(bc.user.first_name || '')} подключён к боту: переписка с ним теперь падает сюда и в CRM.` + (canReply ? '' : '\n⚠️ Боту не дали права отвечать — включите «Отвечать на сообщения» в Настройки → Telegram для бизнеса → Чат-боты.') + (canRead ? '' : '\n⚠️ Боту не дали права читать — включите «Читать сообщения», иначе перед ответом сообщения клиента не будут отмечаться прочитанными.'));
    } else {
      await setting(env, 'biz_conn', null);
      await toSales(env, `⚠️ Аккаунт ${bc.user.username ? '@' + esc(bc.user.username) : ''} отключён от бота — переписка в CRM больше не приходит.`);
    }
    return new Response('ok');
  }
  if (upd.business_message) {
    const bm = upd.business_message, bc = await bizConn(env);
    if (!bc || bm.business_connection_id !== bc.id || bm.chat.type !== 'private') return new Response('ok');
    const p = msgPayload(bm);
    if (bm.from && bm.from.id === bc.user_id) {
      // a manager wrote straight from Jason's account → keep the CRM history complete, close the SLA timer
      if (p.text) {
        await env.DB.prepare(`INSERT INTO support (user_id, sender, text, by, at, via) VALUES (?, 'manager', ?, ?, ?, 'jason')`).bind(bm.chat.id, p.text, 'аккаунт Джейсона', Date.now()).run();
        await env.DB.prepare('DELETE FROM support_sla WHERE user_id = ?').bind(bm.chat.id).run();
      }
      return new Response('ok');
    }
    const existed = await getUser(env, bm.from.id);
    const u = await upsertUser(env, bm.from);
    if (!existed) await env.DB.prepare('UPDATE users SET src = ? WHERE id = ?').bind('jason_dm', u.id).run();
    await env.DB.prepare('UPDATE users SET biz_last_msg = ? WHERE id = ?').bind(bm.message_id, u.id).run();
    await inboundSupport(env, await getUser(env, u.id), p.text, 'jason', p.media);
    return new Response('ok');
  }
  if (upd.edited_business_message || upd.deleted_business_messages) return new Response('ok');
  // bot was made admin of a channel/group → remember it as the private club (unless it's the managers' chat)
  if (upd.my_chat_member) {
    const mc = upd.my_chat_member, st = mc.new_chat_member && mc.new_chat_member.status;
    const salesChat = await setting(env, 'sales_chat');
    if (String(mc.chat.id) !== String(salesChat) && mc.chat.type === 'channel') {
      if (st === 'administrator' && !(await setting(env, 'club_chat')) && (await setting(env, 'vip_chat')) !== String(mc.chat.id)) {
        await setting(env, 'club_chat', String(mc.chat.id)); await setting(env, 'club_title', mc.chat.title || '');
        const canInvite = mc.new_chat_member.can_invite_users !== false;
        await toSales(env, `📢 Бот назначен админом канала «${esc(mc.chat.title || '')}» (<code>${mc.chat.id}</code>). Теперь каждый, кто нажмёт Start, получит личную одноразовую ссылку в этот канал.` + (canInvite ? '' : '\n⚠️ У бота нет права «Пригласительные ссылки» — включите его в настройках админа.'));
      } else if (['left', 'kicked', 'member'].includes(st) && (await setting(env, 'vip_chat')) === String(mc.chat.id)) {
        await setting(env, 'vip_chat', null);
        await toSales(env, `⚠️ Бота убрали из админов VIP-канала «${esc(mc.chat.title || '')}» — выдача VIP-ссылок выключена.`);
      } else if (['left', 'kicked', 'member'].includes(st) && (await setting(env, 'club_chat')) === String(mc.chat.id)) {
        await setting(env, 'club_chat', null);
        await toSales(env, `⚠️ Бота убрали из админов канала «${esc(mc.chat.title || '')}» — автодобавление в канал выключено.`);
      }
    }
    return new Response('ok');
  }
  // any post in a channel where the bot is admin connects it as the club (if none connected yet)
  if (upd.channel_post) {
    const ch = upd.channel_post.chat;
    const cur = await setting(env, 'club_chat');
    if ((!cur || cur === String(ch.id)) && (await setting(env, 'vip_chat')) !== String(ch.id)) {
      if (!cur) { await setting(env, 'club_chat', String(ch.id)); await setting(env, 'club_title', ch.title || ''); await toSales(env, `📢 Подключён закрытый канал «${esc(ch.title || '')}» (<code>${ch.id}</code>) — по первому посту.`); }
    }
    return new Response('ok');
  }
  // someone joined the club channel → mark it
  if (upd.chat_member) {
    const cm = upd.chat_member;
    if (String(cm.chat.id) === (await setting(env, 'vip_chat')) && cm.new_chat_member.status === 'member' && !['member', 'administrator', 'creator'].includes(cm.old_chat_member.status)) {
      await env.DB.prepare('UPDATE users SET vip_joined = ? WHERE id = ?').bind(Date.now(), cm.new_chat_member.user.id).run();
      const vu = await getUser(env, cm.new_chat_member.user.id);
      if (vu) { await setFlow(env, vu.id, 'R5'); await opPush(env, vu, '💎 вступил в VIP-группу'); }
      return new Response('ok');
    }
    if (String(cm.chat.id) === (await setting(env, 'club_chat')) && ['member', 'administrator', 'creator'].includes(cm.new_chat_member.status) && !['member', 'administrator', 'creator'].includes(cm.old_chat_member.status)) {
      await upsertUser(env, cm.new_chat_member.user);
      const u = await getUser(env, cm.new_chat_member.user.id);
      await env.DB.prepare('UPDATE users SET club_joined = ?, sub = 1, sub_at = ? WHERE id = ?').bind(Date.now(), Date.now(), cm.new_chat_member.user.id).run();
      if (u && u.chat_ok && (u.gate_msg || !u.sub)) await showClubWelcome(env, u.id, u.id, pickLang(u.lang), u.gate_msg);
    }
    return new Response('ok');
  }
  // join requests to the club (e.g. a "request to join" link on the landing) → approve instantly
  if (upd.chat_join_request) {
    const jr = upd.chat_join_request;
    if (String(jr.chat.id) === (await setting(env, 'club_chat'))) {
      const existed = await getUser(env, jr.from.id);
      const u = await upsertUser(env, jr.from), lang = pickLang(u.lang || jr.from.language_code);
      const name = (jr.invite_link && jr.invite_link.name) || '';
      const cm = /^c_([a-z0-9]{4,30})$/i.exec(name);
      if (!existed) await env.DB.prepare('UPDATE users SET src = ? WHERE id = ?').bind(cm ? 'meta_ads' : (name === 'landing' ? 'landing' : 'channel'), u.id).run();
      // mark as subscribed before approving so the chat_member update doesn't send a second welcome
      await env.DB.prepare('UPDATE users SET sub = 1, sub_at = ?, club_joined = COALESCE(club_joined, ?) WHERE id = ?').bind(Date.now(), Date.now(), u.id).run();
      // the bot may DM the requester only until the request is processed → welcome first, approve after
      const dm = jr.user_chat_id || jr.from.id;
      await sendCircle(env, dm);
      await tg(env, 'sendMessage', { chat_id: dm, text: fl('w1', lang), reply_markup: { inline_keyboard: [[{ text: flb('get', lang), url: `https://t.me/${await botUsername(env)}?start=w2` }]] } });
      await tg(env, 'approveChatJoinRequest', { chat_id: jr.chat.id, user_id: jr.from.id });
      if (cm) {
        const cid = cleanCid(cm[1]);
        const r = await env.DB.prepare('UPDATE fb_clicks SET tg_id = ? WHERE cid = ? AND tg_id IS NULL').bind(jr.from.id, cid).run();
        if (r.meta && r.meta.changes) await sendCapi(env, cid, 'CompleteRegistration', { tgId: jr.from.id });
      }
    }
    return new Response('ok');
  }
  if (upd.callback_query) {
    const cq = upd.callback_query;
    const salesChat = await setting(env, 'sales_chat');
    if (/^setch:(club|vip)$/.test(cq.data || '')) {
      const pc = JSON.parse((await setting(env, 'pending_ch')) || 'null');
      const me = pc ? await tg(env, 'getChatMember', { chat_id: pc.id, user_id: cq.from.id }) : null;
      if (!pc || !me.ok || !['creator', 'administrator'].includes(me.result.status)) { await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Перешлите пост из канала ещё раз', show_alert: true }); return new Response('ok'); }
      const role = cq.data.split(':')[1], other = role === 'club' ? 'vip' : 'club';
      await setting(env, role + '_chat', pc.id); await setting(env, role + '_title', pc.title);
      if ((await setting(env, other + '_chat')) === pc.id) { await setting(env, other + '_chat', null); await setting(env, other + '_title', null); }
      await setting(env, 'pending_ch', null);
      const label = role === 'club' ? 'канал для входа (подписка перед академией)' : 'VIP-канал (выдаётся после депозита)';
      await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id });
      await tg(env, 'editMessageText', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: `✅ «${pc.title}» подключён как ${label}.` });
      await toSales(env, `📢 «${esc(pc.title)}» (<code>${pc.id}</code>) подключён как ${label}.`);
      return new Response('ok');
    }
    if (/^fl:\w+$/.test(cq.data || '')) return await flowCallback(env, cq, PUBLIC_ORIGIN);
    if (cq.data === 'subchk') {
      const u = await upsertUser(env, cq.from), lang = pickLang(u.lang || cq.from.language_code);
      if (await isSubscribed(env, cq.from.id)) {
        await env.DB.prepare('UPDATE users SET sub = 1, sub_at = ?, club_joined = COALESCE(club_joined, ?) WHERE id = ?').bind(Date.now(), Date.now(), u.id).run();
        await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id });
        await showClubWelcome(env, cq.from.id, u.id, lang, cq.message && cq.message.message_id);
      } else {
        await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: tt('notYet', lang), show_alert: true });
      }
      return new Response('ok');
    }
    const m = /^gate:(approved|rejected):(\d+)$/.exec(cq.data || '');
    if (m && String(cq.message?.chat?.id) === String(salesChat)) {
      const res = await setGate(env, Number(m[2]), m[1], cq.from.username || cq.from.first_name);
      await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: res ? (m[1] === 'approved' ? 'Подтверждено' : 'Отклонено') : 'Юзер не найден' });
      if (res) await tg(env, 'editMessageText', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, parse_mode: 'HTML',
        text: esc(cq.message.text || '') + `\n\n${m[1] === 'approved' ? '✅ Подтвердил' : '❌ Отклонил'}: ${esc(cq.from.username ? '@' + cq.from.username : cq.from.first_name)}`,
        reply_markup: { inline_keyboard: m[1] === 'approved' ? [[{ text: '💰 Депозит внесён → выдать VIP', callback_data: `vip:${m[2]}` }]] : [] } });
    } else if (/^dep:(ok|no):\d+$/.test(cq.data || '') && String(cq.message?.chat?.id) === String(salesChat)) {
      const [, act, uid] = cq.data.split(':'); const by = cq.from.username ? '@' + cq.from.username : cq.from.first_name;
      const r = await confirmDeposit(env, Number(uid), act === 'ok', by);
      await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, show_alert: act === 'ok' && !r.vip, text: act === 'ok' ? (r.vip ? 'Подтверждено: клуб и полный курс открыты' : 'Курс открыт. VIP-ссылку не выдать: ' + (r.vipError === 'vip_not_connected' ? 'VIP-канал не подключён' : r.vipError)) : 'Отклонено' });
      await tg(env, 'editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
      await toSales(env, `${act === 'ok' ? '✅ Депозит подтвердил' : '❌ Депозит отклонил'}: ${esc(by)} — id <code>${uid}</code>`);
    } else if (/^vip:\d+$/.test(cq.data || '') && String(cq.message?.chat?.id) === String(salesChat)) {
      const by = cq.from.username ? '@' + cq.from.username : cq.from.first_name;
      const r = await grantVip(env, Number(cq.data.split(':')[1]), by);
      await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, show_alert: !r.ok, text: r.ok ? 'VIP-ссылка отправлена' : (r.error === 'vip_not_connected' ? 'VIP-канал не подключён: перешлите боту пост из VIP-канала' : 'Не получилось: ' + r.error) });
      if (r.ok) await tg(env, 'editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
    } else {
      await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id });
    }
    return new Response('ok');
  }
  const m = upd.message;
  // fallback: forward any post from the private channel to the bot → it becomes the club channel
  const fwd = m && m.chat && m.chat.type === 'private' && ((m.forward_origin && m.forward_origin.type === 'channel' && m.forward_origin.chat) || m.forward_from_chat);
  if (fwd) {
    const botId = Number(String(env.BOT_TOKEN).split(':')[0]);
    const r = await tg(env, 'getChatMember', { chat_id: fwd.id, user_id: botId });
    if (r.ok && r.result.status === 'administrator') {
      const me = await tg(env, 'getChatMember', { chat_id: fwd.id, user_id: m.from.id });
      if (!me.ok || !['creator', 'administrator'].includes(me.result.status)) { await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Подключать каналы может только админ этого канала.' }); return new Response('ok'); }
      if (r.result.can_invite_users === false) { await tg(env, 'sendMessage', { chat_id: m.chat.id, text: `⚠️ Канал «${fwd.title || ''}» найден, но у бота нет права «Пригласительные ссылки». Включите его и перешлите пост ещё раз.` }); return new Response('ok'); }
      await setting(env, 'pending_ch', JSON.stringify({ id: String(fwd.id), title: fwd.title || '' }));
      const club = await setting(env, 'club_title'), vip = await setting(env, 'vip_title');
      await tg(env, 'sendMessage', { chat_id: m.chat.id, text: `Канал «${fwd.title || ''}» найден ✅\nДля чего его подключить?\n\nСейчас:\n• Вход (подписка перед академией): ${club ? '«' + club + '»' : '—'}\n• VIP после депозита: ${vip ? '«' + vip + '»' : '—'}`,
        reply_markup: { inline_keyboard: [[{ text: '📢 Вход — подписка', callback_data: 'setch:club' }], [{ text: '💎 VIP — после депозита', callback_data: 'setch:vip' }]] } });
    } else {
      await tg(env, 'sendMessage', { chat_id: m.chat.id, text: `Бот не админ в канале «${fwd.title || ''}». Сделайте его администратором с правом «Пригласительные ссылки» и перешлите пост снова.` });
    }
    return new Response('ok');
  }
  if (m && m.chat && m.chat.type === 'private' && m.from && !m.from.is_bot && !(m.text || '').trim().startsWith('/')) {
    const p = msgPayload(m);
    const t0 = (m.text || '').trim();
    if (t0) {
      const pre = await getUser(env, m.from.id);
      if ((!pre || !pre.welcomed) && /^(да|yes|ja|oui|si|sí|da|ок|ok|го|давай)[.!👍 ]*$/i.test(t0)) {
        const uu = await upsertUser(env, m.from);
        await env.DB.prepare('UPDATE users SET chat_ok = 1 WHERE id = ?').bind(uu.id).run();
        await startWelcome(env, await getUser(env, uu.id), m.chat.id, PUBLIC_ORIGIN);
        await opPush(env, uu, '✍️ написал «' + esc(t0) + '» → запустил бота');
        return new Response('ok');
      }
      if (pre && pre.gate !== 'approved' && pre.gate !== 'pending' && /^\d{5,12}$/.test(t0.replace(/\s/g, ''))) {
        await submitBrokerFromBot(env, pre, t0.replace(/\s/g, ''));
        await tg(env, 'sendMessage', { chat_id: m.chat.id, text: fl('a_accok', pickLang(pre.lang)) });
        return new Response('ok');
      }
    }
    if (p.text) {
      const existed = await getUser(env, m.from.id);
      const u = await upsertUser(env, m.from);
      if (!existed) await env.DB.prepare('UPDATE users SET src = ? WHERE id = ?').bind('bot_dm', u.id).run();
      await env.DB.prepare('UPDATE users SET chat_ok = 1 WHERE id = ?').bind(u.id).run();
      const prev = await env.DB.prepare(`SELECT at FROM support WHERE user_id = ? AND sender = 'user' ORDER BY id DESC LIMIT 1`).bind(u.id).first();
      const res = await inboundSupport(env, await getUser(env, u.id), p.text, 'bot', p.media);
      if (res.ok && (!prev || Date.now() - prev.at > 30 * 60e3)) await tg(env, 'sendMessage', { chat_id: m.chat.id, text: tt('gotIt', pickLang(u.lang || m.from.language_code)) });
    }
    return new Response('ok');
  }
  if (!m || !m.text) return new Response('ok');
  const text = m.text.trim();
  if (m.reply_to_message && m.chat.type !== 'private' && String(m.chat.id) === String(await setting(env, 'sales_chat'))) {
    const link = await env.DB.prepare('SELECT user_id FROM support_map WHERE chat_id = ? AND msg_id = ?').bind(String(m.chat.id), m.reply_to_message.message_id).first();
    if (link && !text.startsWith('/')) {
      const rt = m.reply_to_message.text || m.reply_to_message.caption || '';
      const forced = /аккаунт Джейсона/.test(rt) ? 'jason' : /Написали в бот/.test(rt) ? 'bot' : null;
      const r = await supportReply(env, link.user_id, text, m.from.username ? '@' + m.from.username : m.from.first_name, forced);
      await tg(env, 'setMessageReaction', { chat_id: m.chat.id, message_id: m.message_id, reaction: [{ type: 'emoji', emoji: r.delivered ? '👍' : '👀' }] });
      return new Response('ok');
    }
  }
  if (/^\/setcircle(@\w+)?$/.test(text) && m.chat.type !== 'private' && String(m.chat.id) === String(await setting(env, 'sales_chat'))) {
    const vn = m.reply_to_message && m.reply_to_message.video_note;
    if (vn) { await setting(env, 'welcome_circle', vn.file_id); await tg(env, 'sendMessage', { chat_id: m.chat.id, text: '✅ Кружок сохранён: бот будет отправлять его первым сообщением новым людям.' }); }
    else await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Ответьте командой /setcircle на кружок (видеосообщение), который бот должен отправлять новым людям. Убрать: /nocircle' });
    return new Response('ok');
  }
  if (/^\/(slots|set_monitoring|set_balance|set_month|slot_week|slot_result|slot_review|slot_case|clear_reviews|clear_cases)(@\w+)?\b/.test(text) && m.chat.type !== 'private' && String(m.chat.id) === String(await setting(env, 'sales_chat'))) {
    await slotCommand(env, m, text); return new Response('ok');
  }
  if (/^\/setpromo(@\w+)?$/.test(text) && m.chat.type !== 'private' && String(m.chat.id) === String(await setting(env, 'sales_chat'))) {
    const rm = m.reply_to_message || {};
    const v = rm.video ? { type: 'video', file_id: rm.video.file_id } : rm.video_note ? { type: 'video_note', file_id: rm.video_note.file_id } : rm.animation ? { type: 'animation', file_id: rm.animation.file_id } : rm.document && /^video\//.test(rm.document.mime_type || '') ? { type: 'video', file_id: rm.document.file_id } : null;
    if (v) { await setting(env, 'promo_video', JSON.stringify(v)); await tg(env, 'sendMessage', { chat_id: m.chat.id, text: '✅ Промо-ролик сохранён: бот отправляет его вторым сообщением, текст промо идёт подписью.' }); }
    else await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Ответьте командой /setpromo на видео с промо-роликом. Убрать и вернуть текстовую заглушку: /nopromo' });
    return new Response('ok');
  }
  // /reset @username|id — wipe one person from the base and start the funnel for them from W1 (testing)
  if (/^\/reset(@\w+)?\s+\S+/.test(text) && m.chat.type !== 'private' && String(m.chat.id) === String(await setting(env, 'sales_chat'))) {
    const who = text.split(/\s+/)[1].replace(/^@/, '');
    const u = /^\d+$/.test(who) ? await getUser(env, Number(who)) : await env.DB.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').bind(who).first();
    if (!u) { await tg(env, 'sendMessage', { chat_id: m.chat.id, text: `Не нашёл ${who} в базе. Можно указать id: /reset 123456` }); return new Response('ok'); }
    const lang = pickLang(u.lang);
    let n = 0;
    for (const t of ['ledger', 'messages', 'rewards', 'support', 'support_map', 'support_sla', 'support_kpi', 'crm', 'crm_log']) {
      try { const r = await env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(u.id).run(); n += (r.meta && r.meta.changes) || 0; } catch (e) {}
    }
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(u.id).run();
    await sendCircle(env, u.id);
    const r = await tg(env, 'sendMessage', { chat_id: u.id, text: fl('w1', lang), reply_markup: { inline_keyboard: [[{ text: flb('get', lang), url: `https://t.me/${await botUsername(env)}?start=w2` }]] } });
    await tg(env, 'sendMessage', { chat_id: m.chat.id, text: `🧹 ${u.username ? '@' + u.username : u.id} удалён из базы (анкета, переписка, CRM, касания).\n` + (r && r.ok ? '▶️ Воронка запущена с начала: первое сообщение (W1) отправлено, дальше всё как у нового человека.' : '⚠️ Первое сообщение не ушло: ' + ((r && r.description) || 'бот не может написать') + '. Пусть человек нажмёт /start в боте.') });
    return new Response('ok');
  }
  if (/^\/nopromo(@\w+)?$/.test(text) && m.chat.type !== 'private' && String(m.chat.id) === String(await setting(env, 'sales_chat'))) {
    await setting(env, 'promo_video', null); await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Промо-ролик убран, бот шлёт текстовую заглушку.' });
    return new Response('ok');
  }
  if (/^\/nocircle(@\w+)?$/.test(text) && m.chat.type !== 'private' && String(m.chat.id) === String(await setting(env, 'sales_chat'))) {
    await setting(env, 'welcome_circle', null); await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Кружок убран.' });
    return new Response('ok');
  }
  if (/^\/setsales(@\w+)?$/.test(text) && m.chat.type !== 'private') {
    const cur = await setting(env, 'sales_chat');
    if (!cur) { await setting(env, 'sales_chat', String(m.chat.id)); await tg(env, 'sendMessage', { chat_id: m.chat.id, text: '✅ Этот чат подключён: сюда будут приходить анкеты, запросы доступа и обращения к менеджеру.' }); }
    else if (cur !== String(m.chat.id)) await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Чат для заявок уже назначен. Сбросить можно в админке.' });
    else await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Этот чат уже подключён ✅' });
    return new Response('ok');
  }
  if (text.startsWith('/start') && m.chat.type === 'private') {
    await ensureSchema(env);
    const existed = await getUser(env, m.from.id);
    const u = await upsertUser(env, m.from);
    const refM = /ref_(\d+)/.exec(text);
    if (refM && !existed && Number(refM[1]) !== m.from.id && await getUser(env, Number(refM[1]))) {
      await env.DB.prepare('UPDATE users SET ref_by = ? WHERE id = ?').bind(Number(refM[1]), u.id).run();
    }
    const srcM = /src_([\w-]{1,32})/.exec(text);
    const tagM = /^\/start\s+([a-z][\w-]{0,31})$/i.exec(text);
    const tag = srcM ? srcM[1] : (tagM && !/^(ref|fb)_/i.test(tagM[1]) ? tagM[1] : null);
    if (tag && !existed) await env.DB.prepare('UPDATE users SET src = ? WHERE id = ?').bind(tag.toLowerCase(), u.id).run();
    const fbM = /fb_([a-z0-9]{4,32})/i.exec(text);
    if (fbM) {
      const cid = cleanCid(fbM[1]);
      if (!existed) await env.DB.prepare('UPDATE users SET src = ? WHERE id = ?').bind('meta_ads', u.id).run();
      const r = await env.DB.prepare('UPDATE fb_clicks SET tg_id = ? WHERE cid = ? AND tg_id IS NULL').bind(m.from.id, cid).run();
      if (r.meta && r.meta.changes) await sendCapi(env, cid, 'CompleteRegistration', { tgId: m.from.id });
    }
    await env.DB.prepare('UPDATE users SET chat_ok = 1 WHERE id = ?').bind(u.id).run();
    const lang = pickLang(u.lang || m.from.language_code);
    if (!(await isSubscribed(env, u.id))) {
      await env.DB.prepare('UPDATE users SET sub = 0, sub_at = ? WHERE id = ?').bind(Date.now(), u.id).run();
      await sendSubGate(env, m.chat.id, u.id, lang);
    } else {
      if (!u.sub) await env.DB.prepare('UPDATE users SET sub = 1, sub_at = ? WHERE id = ?').bind(Date.now(), u.id).run();
      const fu = await getUser(env, u.id);
      if (!fu.welcomed) await startWelcome(env, fu, m.chat.id, PUBLIC_ORIGIN);
      else await tg(env, 'sendMessage', { chat_id: m.chat.id, text: fl('w3', lang), reply_markup: await flowKb(env, fu, ['acc', 'app', 'dm'], lang, PUBLIC_ORIGIN) });
    }
  }
  return new Response('ok');
}

/* ---------------- cron ---------------- */
async function cron(env) {
  await ensureSchema(env);
  const now = Date.now();
  const users = (await env.DB.prepare('SELECT * FROM users WHERE chat_ok = 1 AND flow IS NULL').all()).results || [];
  for (const u of users) {
    const lang = pickLang(u.lang);
    const localHour = (new Date().getUTCHours() + Math.round(u.tz || 0) + 48) % 24;
    const daytime = localHour >= 10 && localHour <= 20;
    let sent = null;
    if (env.MANAGER && u.handoff_at && !u.handoff_catch && now - u.handoff_at > HOUR) {
      sent = await tg(env, 'sendMessage', { chat_id: u.id, text: tt('catchHandoff', lang, { m: env.MANAGER }), reply_markup: mgrButton(env, lang) });
      await env.DB.prepare('UPDATE users SET handoff_catch = 1 WHERE id = ?').bind(u.id).run();
    } else if (false && daytime && u.onboarded_at && (u.gate === 'none' || !u.gate) && !u.gate_catch && now - u.onboarded_at > 6 * HOUR) { // replaced by scenario R2
      const kb = { inline_keyboard: [[{ text: tt('openBtn', lang), web_app: { url: env.APP_URL } }], ...(env.MANAGER ? [[{ text: tt('mgrBtn', lang), url: `https://t.me/${env.MANAGER}` }]] : [])] };
      sent = await tg(env, 'sendMessage', { chat_id: u.id, text: tt('catchGate', lang, { m: env.MANAGER || '' }), reply_markup: kb });
      await env.DB.prepare('UPDATE users SET gate_catch = 1 WHERE id = ?').bind(u.id).run();
    } else if (daytime && u.gate === 'approved') {
      const lastActive = u.last_studied || u.last_seen || u.first_seen || now;
      if (now - lastActive < 2 * DAY) continue;
      if (u.nudged_at && now - u.nudged_at < 3 * DAY) continue;
      if ((u.nudges || 0) >= 6 && now - lastActive > 30 * DAY) continue;
      sent = await tg(env, 'sendMessage', { chat_id: u.id, text: T.nudges[lang][(u.nudges || 0) % 4], reply_markup: openButton(env, tt('contBtn', lang)) });
      await env.DB.prepare('UPDATE users SET nudged_at = ?, nudges = ? WHERE id = ?').bind(now, (u.nudges || 0) + 1, u.id).run();
    }
    if (sent && sent.ok === false && sent.error_code === 403) await env.DB.prepare('UPDATE users SET chat_ok = 0 WHERE id = ?').bind(u.id).run();
  }
}

/* ---------------- admin ---------------- */

/* ================= Team CRM (admin panel based on LeadCenter) =================
   Staff accounts (one owner + invited team with per-tab access), sessions, funnel by channel,
   CRM cards over the users table, ad spend, team kanban. All under /admin/*. */
const CRM_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT UNIQUE, name TEXT, role TEXT, tabs TEXT, salt TEXT, hash TEXT, invite TEXT, created_at INTEGER, last_login INTEGER)`,
  `CREATE TABLE IF NOT EXISTS staff_sessions (token TEXT PRIMARY KEY, staff_id INTEGER, until INTEGER)`,
  `CREATE TABLE IF NOT EXISTS crm (user_id INTEGER PRIMARY KEY, stage TEXT, amount REAL, quals TEXT, notes TEXT, task_text TEXT, task_due TEXT, task_done INTEGER DEFAULT 0, src_override TEXT, updated_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS crm_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, who TEXT, what TEXT, at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_crm_log_user ON crm_log(user_id, id)`,
  `CREATE TABLE IF NOT EXISTS spend (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, channel TEXT, amount REAL, note TEXT, who TEXT, at INTEGER)`
];
let crmReady = false;
async function ensureCrm(env) { if (crmReady) return; for (const q of CRM_SCHEMA) await env.DB.prepare(q).run(); crmReady = true; }

const CRM_TABS = ['funnel', 'crm', 'tasks', 'content', 'team', 'settings'];
const MEMBER_TABS = ['funnel', 'crm', 'tasks', 'content'];           // what an owner can hand out; team/settings stay owner-only
const STAGES = ['старт', 'подписался', 'прошёл анкету', 'прислал счёт', 'счёт подтверждён', 'депозит', 'в VIP', 'отказ'];
const MANUAL_STAGES = ['депозит', 'отказ'];
const QUALS = ['горячий', 'опытный', 'новичок', 'крупный депозит', 'нужна помощь'];
const CHANNELS = [
  { key: 'fb', name: 'Facebook · реклама', paid: true }, { key: 'ig', name: 'Instagram' }, { key: 'th', name: 'Threads' },
  { key: 'x', name: 'X' }, { key: 'yt', name: 'YouTube' }, { key: 'ref', name: 'Рефералы' }, { key: 'direct', name: 'Без метки' }
];
function channelOf(src, refBy) {
  const s = String(src || '').toLowerCase();
  if (s === 'meta_ads' || s === 'fb' || s.startsWith('fb_') || s.startsWith('fb-')) return 'fb';
  for (const k of ['ig', 'th', 'x', 'yt']) if (s === k || s.startsWith(k + '_') || s.startsWith(k + '-')) return k;
  if (refBy) return 'ref';
  return 'direct';
}
function autoStage(u) {
  if (u.vip_joined) return 'в VIP';
  if (u.vip_at || u.dep_ok_at) return 'депозит';
  if (u.gate === 'approved') return 'счёт подтверждён';
  if (u.gate === 'pending' || u.gate === 'rejected') return 'прислал счёт';
  if (u.onboarded_at) return 'прошёл анкету';
  if (u.sub || u.club_joined) return 'подписался';
  return 'старт';
}
function stageOf(u, c) {
  const auto = autoStage(u), man = c && c.stage;
  if (man === 'отказ') return 'отказ';
  if (man && STAGES.indexOf(man) > STAGES.indexOf(auto)) return man;
  return auto;
}
const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
async function pwHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 20000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function staffPublic(s) {
  if (!s) return null;
  const owner = s.role === 'owner';
  return { id: s.id, login: s.login, name: s.name || s.login, role: s.role, owner,
    tabs: owner ? CRM_TABS : ['funnel', ...JSON.parse(s.tabs || '[]').filter(t => MEMBER_TABS.includes(t) && t !== 'funnel')] };
}
async function newSession(env, staffId) {
  const token = randHex(32);
  await env.DB.prepare('INSERT INTO staff_sessions (token, staff_id, until) VALUES (?, ?, ?)').bind(token, staffId, Date.now() + 30 * DAY).run();
  await env.DB.prepare('UPDATE staff SET last_login = ? WHERE id = ?').bind(Date.now(), staffId).run();
  return token;
}
const adminPageUrl = (env) => String(env.APP_URL || '').replace(/\/?$/, '/') + 'admin.html';

/* public auth endpoints (no session yet) */
async function crmAuth(p, req, env, body, fail) {
  const ownerCount = (await env.DB.prepare(`SELECT COUNT(*) n FROM staff WHERE role = 'owner' AND hash IS NOT NULL`).first()).n;
  if (p === 'auth-state') return json({ hasOwner: ownerCount > 0 });
  const login = String(body.login || '').trim().toLowerCase().slice(0, 40), pw = String(body.password || '');
  if (p === 'setup') {
    if (ownerCount > 0) return json({ error: 'owner already exists' }, 400);
    if (!env.ADMIN_KEY || body.adminKey !== env.ADMIN_KEY) { await fail(); return json({ error: 'Неверный ADMIN_KEY' }, 401); }
    if (!/^[a-z0-9._-]{3,40}$/.test(login) || pw.length < 8) return json({ error: 'Логин 3+ символа (латиница, цифры), пароль 8+ символов' }, 400);
    const salt = randHex(16);
    const r = await env.DB.prepare(`INSERT INTO staff (login, name, role, tabs, salt, hash, created_at) VALUES (?, ?, 'owner', '[]', ?, ?, ?)`)
      .bind(login, String(body.name || login).slice(0, 60), salt, await pwHash(pw, salt), Date.now()).run();
    return json({ ok: true, token: await newSession(env, r.meta.last_row_id) });
  }
  if (p === 'login') {
    const s = await env.DB.prepare('SELECT * FROM staff WHERE login = ? AND hash IS NOT NULL').bind(login).first();
    if (!s || (await pwHash(pw, s.salt)) !== s.hash) { await fail(); return json({ error: 'Неверный логин или пароль' }, 401); }
    return json({ ok: true, token: await newSession(env, s.id) });
  }
  if (p === 'invite-info') {
    const s = await env.DB.prepare('SELECT name FROM staff WHERE invite = ?').bind(String(body.token || url_q(req, 'token'))).first();
    return s ? json({ ok: true, name: s.name }) : json({ error: 'Ссылка недействительна' }, 404);
  }
  if (p === 'invite-accept') {
    const s = await env.DB.prepare('SELECT * FROM staff WHERE invite = ?').bind(String(body.token || '')).first();
    if (!s) { await fail(); return json({ error: 'Ссылка недействительна' }, 404); }
    if (!/^[a-z0-9._-]{3,40}$/.test(login) || pw.length < 8) return json({ error: 'Логин 3+ символа (латиница, цифры), пароль 8+ символов' }, 400);
    const taken = await env.DB.prepare('SELECT id FROM staff WHERE login = ? AND id != ?').bind(login, s.id).first();
    if (taken) return json({ error: 'Логин занят' }, 400);
    const salt = randHex(16);
    await env.DB.prepare('UPDATE staff SET login = ?, salt = ?, hash = ?, invite = NULL WHERE id = ?').bind(login, salt, await pwHash(pw, salt), s.id).run();
    return json({ ok: true, token: await newSession(env, s.id) });
  }
  return null;
}
const url_q = (req, k) => new URL(req.url).searchParams.get(k) || '';

/* which tab each admin endpoint belongs to */
const PERM = {
  me: null, logout: null,
  funnel: 'funnel', spend: 'funnel', stats: 'funnel',
  crm: 'crm', 'crm-card': 'crm', 'crm-update': 'crm', users: 'crm', user: 'crm', messages: 'crm', gate: 'crm', vip: 'crm',
  'support-threads': 'crm', 'support-thread': 'crm', 'support-reply': 'crm', 'flow-stop': 'crm',
  tasks: 'tasks',
  videos: 'content', topics: 'content', rewards: 'content', reward: 'content',
  staff: 'team',
  'setup-webhook': 'settings', 'sales-reset': 'settings', settings: 'settings', 'sla-settings': 'settings',
  kpi: 'crm', deposit: 'crm', 'deposit-photo': 'crm'
};

async function crmLog(env, uid, who, what) {
  try { await env.DB.prepare('INSERT INTO crm_log (user_id, who, what, at) VALUES (?, ?, ?, ?)').bind(uid, String(who || '?').slice(0, 60), String(what).slice(0, 300), Date.now()).run(); } catch (e) {}   // table appears with the CRM schema
}
async function crmRow(env, uid) {
  return (await env.DB.prepare('SELECT * FROM crm WHERE user_id = ?').bind(uid).first()) || { user_id: uid, stage: null, amount: 0, quals: '[]', notes: '[]', task_text: null, task_due: null, task_done: 0, src_override: null };
}
async function crmSave(env, c) {
  await env.DB.prepare(`INSERT OR REPLACE INTO crm (user_id, stage, amount, quals, notes, task_text, task_due, task_done, src_override, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(c.user_id, c.stage || null, Number(c.amount) || 0, c.quals || '[]', c.notes || '[]', c.task_text || null, c.task_due || null, c.task_done ? 1 : 0, c.src_override || null, Date.now()).run();
}

/* staff-only endpoints */
async function crmApi(p, req, env, url, body, me, all) {
  const who = me.name || me.login;
  if (p === 'me') return json({ me, config: { stages: STAGES, manualStages: MANUAL_STAGES, quals: QUALS, channels: CHANNELS, memberTabs: MEMBER_TABS, adminUrl: adminPageUrl(env) } });
  if (p === 'logout') { await env.DB.prepare('DELETE FROM staff_sessions WHERE token = ?').bind(req.headers.get('x-session') || '').run(); return json({ ok: true }); }

  if (p === 'funnel') {
    const now = Date.now(), days = Math.max(1, Math.min(3650, Number(url.searchParams.get('days')) || 7));
    let since = now - days * DAY, until = now + 60e3;
    const from = url.searchParams.get('start'), to = url.searchParams.get('end');
    if (from && to) { since = Date.parse(from + 'T00:00:00Z'); until = Date.parse(to + 'T00:00:00Z') + DAY; }
    const span = until - since, prevSince = since - span;
    const us = await all(`SELECT u.id, u.first_seen, u.src, u.ref_by, u.sub, u.club_joined, u.opens, u.onboarded_at, u.gate, u.vip_at, u.vip_joined, u.tier, u.dep_ok_at,
      c.stage AS c_stage, c.amount AS c_amount, c.quals AS c_quals, c.src_override AS c_src FROM users u LEFT JOIN crm c ON c.user_id = u.id WHERE u.first_seen >= ? AND u.first_seen < ?`, prevSince, until);
    const STEP = [['starts', 'Старт бота'], ['sub', 'Подписались на канал'], ['app', 'Открыли академию'], ['onb', 'Прошли анкету'],
      ['acc', 'Прислали счёт'], ['ok', 'Счёт подтверждён'], ['dep', 'Депозит'], ['vip', 'В VIP']];
    const count = (ls) => {
      const c = { starts: ls.length, sub: 0, app: 0, onb: 0, acc: 0, ok: 0, dep: 0, vip: 0, refused: 0, qual: 0, revenue: 0 };
      for (const u of ls) {
        const st = stageOf(u, { stage: u.c_stage }), i = STAGES.indexOf(st);
        if (u.sub || u.club_joined || i >= 1 && st !== 'отказ') c.sub++;
        if (u.opens > 0 || u.onboarded_at) c.app++;
        if (u.onboarded_at) c.onb++;
        if (u.gate && u.gate !== 'none') c.acc++;
        if (u.gate === 'approved') c.ok++;
        if (st === 'депозит' || st === 'в VIP') { c.dep++; c.revenue += Number(u.c_amount) || 0; }
        if (u.vip_joined) c.vip++;
        if (st === 'отказ') c.refused++;
        if (JSON.parse(u.c_quals || '[]').length) c.qual++;
      }
      return c;
    };
    const cur = us.filter(u => u.first_seen >= since), prv = us.filter(u => u.first_seen < since);
    const fromD = new Date(since).toISOString().slice(0, 10), toD = new Date(until - 1).toISOString().slice(0, 10);
    const sp = await all('SELECT channel, SUM(amount) s FROM spend WHERE date >= ? AND date <= ? GROUP BY channel', fromD, toD);
    const spendBy = Object.fromEntries(sp.map(r => [r.channel, r.s]));
    const channels = CHANNELS.map(ch => {
      const c = count(cur.filter(u => channelOf(u.c_src || u.src, u.ref_by) === ch.key));
      const s = Math.round(spendBy[ch.key] || 0);
      return { ...ch, ...c, spend: s, cps: s && c.starts ? Math.round(s / c.starts * 100) / 100 : null, cpa: s && c.ok ? Math.round(s / c.ok) : null };
    });
    const bySource = {};
    for (const u of cur) { const k = u.c_src || u.src || 'без метки'; (bySource[k] = bySource[k] || []).push(u); }
    const total = count(cur);
    return json({ from: fromD, to: toD, days: Math.round(span / DAY), total, prev: count(prv), spend: Object.values(spendBy).reduce((a, b) => a + b, 0),
      steps: STEP.map(([k, n]) => ({ key: k, name: n, n: total[k] })), channels,
      bySource: Object.entries(bySource).map(([k, ls]) => ({ source: k, channel: channelOf(k === 'без метки' ? '' : k, ls[0].ref_by), ...count(ls) })).sort((a, b) => b.starts - a.starts).slice(0, 100) });
  }
  if (p === 'spend') {
    if (body.delete) await env.DB.prepare('DELETE FROM spend WHERE id = ?').bind(Number(body.delete)).run();
    else if (body.amount != null) {
      const ch = CHANNELS.some(c => c.key === body.channel) ? body.channel : 'fb';
      await env.DB.prepare('INSERT INTO spend (date, channel, amount, note, who, at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(String(body.date || new Date().toISOString()).slice(0, 10), ch, Number(body.amount) || 0, String(body.note || '').slice(0, 120), who, Date.now()).run();
    }
    return json({ rows: await all('SELECT * FROM spend ORDER BY date DESC, id DESC LIMIT 300') });
  }

  if (p === 'crm') {
    const rows = await all(`SELECT u.id, u.name, u.username, u.lang, u.src, u.ref_by, u.first_seen, u.last_seen, u.sub, u.club_joined, u.opens, u.onboarded_at,
        u.gate, u.gate_at, u.broker_id, u.tier, u.vip_at, u.vip_joined, u.goal_text, u.dep_status, u.dep_ok_at, u.dep_claim_at,
        (SELECT since FROM support_sla x WHERE x.user_id = u.id) AS sla_since,
        c.stage AS c_stage, c.amount AS c_amount, c.quals AS c_quals, c.task_text, c.task_due, c.task_done, c.src_override,
        s.sender AS sup_sender, s.text AS sup_text, s.at AS sup_at,
        (SELECT COUNT(*) FROM support x WHERE x.user_id = u.id AND x.sender = 'user' AND x.id > COALESCE(u.support_admin_seen, 0)) AS sup_unread
      FROM users u LEFT JOIN crm c ON c.user_id = u.id
      LEFT JOIN support s ON s.id = (SELECT MAX(id) FROM support WHERE user_id = u.id)
      ORDER BY COALESCE(s.at, u.last_seen, u.first_seen) DESC LIMIT 3000`);
    const today = new Date().toISOString().slice(0, 10);
    return json({ leads: rows.map(u => ({
      id: u.id, name: u.name || '—', username: u.username || '', lang: u.lang, source: u.src_override || u.src || '', channel: channelOf(u.src_override || u.src, u.ref_by),
      first_seen: u.first_seen, last_seen: u.last_seen, gate: u.gate || 'none', broker_id: u.broker_id, tier: u.tier, goal: u.goal_text,
      stage: stageOf(u, { stage: u.c_stage }), manual_stage: u.c_stage || '', amount: u.c_amount || 0, quals: JSON.parse(u.c_quals || '[]'),
      task: u.task_text || '', task_due: u.task_due || '', task_done: !!u.task_done, task_overdue: !!(u.task_text && !u.task_done && u.task_due && u.task_due < today),
      deposit: u.dep_ok_at || u.vip_at ? 'confirmed' : (u.dep_status || 'none'), sla_since: u.sla_since || null,
      waiting: u.sup_sender === 'user', last_text: u.sup_text ? String(u.sup_text).slice(0, 90) : '', last_at: u.sup_at || u.last_seen || u.first_seen, unread: u.sup_unread || 0
    })) });
  }
  if (p === 'crm-card') {
    const id = Number(url.searchParams.get('id') || body.id);
    const u = await getUser(env, id); if (!u) return json({ error: 'not found' }, 404);
    const c = await crmRow(env, id);
    const support = await supportMsgs(env, id);
    if (support.length) await env.DB.prepare('UPDATE users SET support_admin_seen = ? WHERE id = ?').bind(support[support.length - 1].id, id).run();
    return json({ user: { ...u, onboard: u.onboard ? JSON.parse(u.onboard) : null }, stage: stageOf(u, c), auto_stage: autoStage(u), channel: channelOf(c.src_override || u.src, u.ref_by),
      crm: { ...c, quals: JSON.parse(c.quals || '[]'), notes: JSON.parse(c.notes || '[]') }, support,
      ai: await all('SELECT text, reply, topic, at FROM messages WHERE user_id = ? ORDER BY at DESC LIMIT 40', id),
      ledger: await all('SELECT type, amount, at FROM ledger WHERE user_id = ? ORDER BY at', id),
      referrals: await all('SELECT id, name, username, gate FROM users WHERE ref_by = ?', id),
      log: await all('SELECT who, what, at FROM crm_log WHERE user_id = ? ORDER BY id DESC LIMIT 60', id) });
  }
  if (p === 'crm-update') {
    const id = Number(body.id); const u = await getUser(env, id); if (!u) return json({ error: 'not found' }, 404);
    const c = await crmRow(env, id);
    if ('stage' in body) {
      const st = MANUAL_STAGES.includes(body.stage) ? body.stage : null;
      if ((c.stage || null) !== st) { await crmLog(env, id, who, `этап: ${c.stage || 'авто'} → ${st || 'авто'}`); c.stage = st; }
    }
    if ('amount' in body) { c.amount = Math.max(0, Number(body.amount) || 0); await crmLog(env, id, who, `сумма депозита: $${c.amount}`); }
    if ('quals' in body) {
      const q = (Array.isArray(body.quals) ? body.quals : []).filter(x => QUALS.includes(x));
      if (JSON.stringify(q) !== c.quals) { c.quals = JSON.stringify(q); await crmLog(env, id, who, `квалификация: ${q.join(', ') || 'снята'}`); }
    }
    if (body.note) { const n = JSON.parse(c.notes || '[]'); n.push({ at: Date.now(), who, text: String(body.note).slice(0, 2000) }); c.notes = JSON.stringify(n.slice(-200)); }
    if ('task' in body) {
      if (body.task === null) { c.task_text = null; c.task_due = null; c.task_done = 0; await crmLog(env, id, who, 'задача снята'); }
      else { c.task_text = String(body.task || '').slice(0, 200); c.task_due = String(body.due || '').slice(0, 10) || null; c.task_done = 0; await crmLog(env, id, who, `задача${c.task_due ? ' на ' + c.task_due : ''}: ${c.task_text}`); }
    }
    if (body.taskDone) { c.task_done = 1; await crmLog(env, id, who, `задача выполнена: ${c.task_text || ''}`); }
    if ('source' in body) { c.src_override = String(body.source || '').trim().slice(0, 40) || null; await crmLog(env, id, who, `источник: ${c.src_override || 'сброшен'}`); }
    await crmSave(env, c);
    return json({ ok: true });
  }

  if (p === 'tasks') {
    if (req.method === 'POST' && Array.isArray(body.columns)) await setting(env, 'team_tasks', JSON.stringify({ columns: body.columns.slice(0, 8) }));
    const t = JSON.parse((await setting(env, 'team_tasks')) || 'null') || { columns: ['Бэклог', 'В работе', 'На проверке', 'Готово'].map(name => ({ name, cards: [] })) };
    return json(t);
  }

  if (p === 'staff') {
    const pub = (s) => ({ id: s.id, login: s.hash ? s.login : null, name: s.name, role: s.role, tabs: JSON.parse(s.tabs || '[]'), invited: !s.hash,
      invite_link: s.invite ? adminPageUrl(env) + '#invite=' + s.invite : null, last_login: s.last_login, created_at: s.created_at });
    const tabsOf = (t) => JSON.stringify((Array.isArray(t) ? t : []).filter(x => MEMBER_TABS.includes(x)));
    if (body.action === 'add') {
      await env.DB.prepare(`INSERT INTO staff (login, name, role, tabs, invite, created_at) VALUES (?, ?, 'member', ?, ?, ?)`)
        .bind('invite-' + randHex(6), String(body.name || 'Сотрудник').slice(0, 60), tabsOf(body.tabs), randHex(16), Date.now()).run();
    }
    if (body.action === 'update') await env.DB.prepare(`UPDATE staff SET name = ?, tabs = ? WHERE id = ? AND role != 'owner'`).bind(String(body.name || '').slice(0, 60), tabsOf(body.tabs), Number(body.id)).run();
    if (body.action === 'remove') {
      await env.DB.prepare(`DELETE FROM staff_sessions WHERE staff_id = ?`).bind(Number(body.id)).run();
      await env.DB.prepare(`DELETE FROM staff WHERE id = ? AND role != 'owner'`).bind(Number(body.id)).run();
    }
    if (body.action === 'reinvite') await env.DB.prepare(`UPDATE staff SET invite = ?, hash = NULL, salt = NULL WHERE id = ? AND role != 'owner'`).bind(randHex(16), Number(body.id)).run();
    if (body.action === 'password') {
      const pw = String(body.password || ''); if (pw.length < 8) return json({ error: 'Пароль 8+ символов' }, 400);
      const salt = randHex(16);
      await env.DB.prepare('UPDATE staff SET salt = ?, hash = ? WHERE id = ?').bind(salt, await pwHash(pw, salt), me.id).run();
    }
    return json({ staff: (await all('SELECT * FROM staff ORDER BY id')).map(pub) });
  }
  if (p === 'kpi') {
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get('days')) || 7)), since = Date.now() - days * DAY;
    const cfg = await slaCfg(env);
    const rows = await all(`SELECT by, COUNT(*) n, AVG(secs) avg, SUM(ontime) ontime, MAX(secs) worst FROM support_kpi WHERE answered_at >= ? GROUP BY by ORDER BY n DESC`, since);
    const tot = await env.DB.prepare('SELECT COUNT(*) n, AVG(secs) avg, SUM(ontime) ontime FROM support_kpi WHERE answered_at >= ?').bind(since).first();
    const waiting = await all('SELECT s.user_id, s.since, s.overdue, u.name, u.username FROM support_sla s JOIN users u ON u.id = s.user_id ORDER BY s.since');
    return json({ days, cfg, managers: rows.map(r => ({ by: r.by, n: r.n, avg: Math.round(r.avg || 0), ontime: r.ontime || 0, pct: r.n ? Math.round(100 * (r.ontime || 0) / r.n) : 0, worst: r.worst || 0 })),
      total: { n: tot.n || 0, avg: Math.round(tot.avg || 0), pct: tot.n ? Math.round(100 * (tot.ontime || 0) / tot.n) : 0 }, waiting });
  }
  if (p === 'deposit') return json(await confirmDeposit(env, Number(body.id), !!body.ok, me.name));
  if (p === 'deposit-photo') {
    const u = await getUser(env, Number(url.searchParams.get('id')));
    const fid = !u ? null : url.searchParams.get('kind') === 'broker' ? u.broker_shot : (u.dep_claim ? JSON.parse(u.dep_claim).photo : null);
    if (!fid || fid === 'none') return json({ error: 'no photo' }, 404);
    const f = await tg(env, 'getFile', { file_id: fid }); if (!f.ok) return json({ error: 'file' }, 404);
    const img = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${f.result.file_path}`);
    return new Response(img.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600', ...CORS } });
  }
  if (p === 'sla-settings') {
    if (req.method === 'POST') {
      const c = { minutes: Math.max(1, Math.min(240, Number(body.minutes) || 10)), remind: Math.max(0, Math.min(239, Number(body.remind) || 7)),
        target: body.target === 'chat' ? 'chat' : 'sales', chat: String(body.chat || '').trim().slice(0, 32) || null,
        hours: /^\d{1,2}-\d{1,2}$/.test(String(body.hours || '')) ? body.hours : null, tz: Number.isFinite(Number(body.tz)) ? Number(body.tz) : 3 };
      await setting(env, 'sla_cfg', JSON.stringify(c));
    }
    return json(await slaCfg(env));
  }
  if (p === 'settings') {
    const wi = (await tg(env, 'getWebhookInfo', {})).result || {};
    return json({ salesChat: !!(await setting(env, 'sales_chat')), club: await setting(env, 'club_title'), vip: await setting(env, 'vip_title'),
      manager: env.MANAGER || null, bot: await botUsername(env), webhook: { ok: !!wi.url, pending: wi.pending_update_count || 0, lastError: wi.last_error_message || null },
      pixel: !!env.PIXEL_ID, capi: !!env.CAPI_TOKEN, appUrl: env.APP_URL });
  }
  return null;
}

async function admin(req, env, url) {
  // brute-force guard: max 10 wrong keys per IP per 15 minutes
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_fails (ip TEXT, at INTEGER)').run();
  const since = Date.now() - 15 * 60e3;
  const fails = (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_fails WHERE ip = ? AND at > ?').bind(ip, since).first())?.n || 0;
  if (fails >= 10) return json({ error: 'Слишком много попыток — подождите 15 минут' }, 429);
  const fail = () => env.DB.prepare('INSERT INTO admin_fails (ip, at) VALUES (?, ?)').bind(ip, Date.now()).run();
  await ensureCrm(env);
  const p = url.pathname.replace('/admin/', '');
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const all = async (q, ...b) => (await env.DB.prepare(q).bind(...b).all()).results || [];
  const pub = await crmAuth(p, req, env, body, fail); if (pub) return pub;
  // who is calling: a staff session (team CRM) or the legacy ADMIN_KEY (= owner)
  let me = null;
  const tok = req.headers.get('x-session');
  if (tok) {
    const s = await env.DB.prepare('SELECT st.* FROM staff_sessions ss JOIN staff st ON st.id = ss.staff_id WHERE ss.token = ? AND ss.until > ?').bind(tok, Date.now()).first();
    me = staffPublic(s);
  } else if (env.ADMIN_KEY && req.headers.get('x-admin-key') === env.ADMIN_KEY) {
    me = { id: 0, login: 'admin-key', name: 'Администратор', role: 'owner', owner: true, tabs: CRM_TABS };
  }
  if (!me) { if (!tok) await fail(); return json({ error: 'unauthorized' }, 401); }
  const need = PERM[p];
  if (need === undefined && !me.owner) return json({ error: 'forbidden' }, 403);
  if (need && !me.tabs.includes(need)) return json({ error: 'Нет доступа к этому разделу' }, 403);
  const crmRes = await crmApi(p, req, env, url, body, me, all); if (crmRes) return crmRes;
  if (p === 'stats') {
    const week = Date.now() - 7 * DAY;
    const one = async (q, ...b) => (await env.DB.prepare(q).bind(...b).first()) || {};
    return json({
      users: (await one('SELECT COUNT(*) n FROM users')).n,
      active7: (await one('SELECT COUNT(*) n FROM users WHERE last_seen > ?', week)).n,
      studied7: (await one('SELECT COUNT(*) n FROM users WHERE last_studied > ?', week)).n,
      onboarded: (await one('SELECT COUNT(*) n FROM users WHERE onboarded_at IS NOT NULL')).n,
      pending: (await one(`SELECT COUNT(*) n FROM users WHERE gate = 'pending'`)).n,
      approved: (await one(`SELECT COUNT(*) n FROM users WHERE gate = 'approved'`)).n,
      referred: (await one('SELECT COUNT(*) n FROM users WHERE ref_by IS NOT NULL')).n,
      messages7: (await one('SELECT COUNT(*) n FROM messages WHERE at > ?', week)).n,
      handoffs7: (await one('SELECT COUNT(*) n FROM messages WHERE handoff = 1 AND at > ?', week)).n,
      byLang: await all('SELECT lang, COUNT(*) n FROM users GROUP BY lang'),
      byTier: await all('SELECT tier, COUNT(*) n FROM users WHERE tier IS NOT NULL GROUP BY tier'),
      salesChat: !!(await setting(env, 'sales_chat')),
      club: (await setting(env, 'club_title')) && (await setting(env, 'club_chat')) ? await setting(env, 'club_title') : null,
      clubJoined: (await one('SELECT COUNT(*) n FROM users WHERE club_joined IS NOT NULL')).n,
      vip: await setting(env, 'vip_chat') ? await setting(env, 'vip_title') : null,
      vipGiven: (await one('SELECT COUNT(*) n FROM users WHERE vip_at IS NOT NULL')).n,
      vipJoined: (await one('SELECT COUNT(*) n FROM users WHERE vip_joined IS NOT NULL')).n,
      bySrc: await all("SELECT COALESCE(src, '—') AS src, COUNT(*) n, SUM(CASE WHEN club_joined IS NOT NULL THEN 1 ELSE 0 END) club, SUM(CASE WHEN onboarded_at IS NOT NULL THEN 1 ELSE 0 END) onb, SUM(CASE WHEN gate = 'approved' THEN 1 ELSE 0 END) ok FROM users GROUP BY src ORDER BY n DESC"),
      manager: env.MANAGER || null
    });
  }
  if (p === 'users') {
    const rows = await all(`SELECT u.*, (SELECT COUNT(*) FROM users r WHERE r.ref_by = u.id) AS invited,
      (SELECT COUNT(*) FROM users r WHERE r.ref_by = u.id AND r.gate = 'approved') AS invited_ok,
      (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS msgs FROM users u ORDER BY u.last_seen DESC LIMIT 2000`);
    return json({ users: rows });
  }
  if (p === 'user') {
    const id = Number(url.searchParams.get('id'));
    const u = await getUser(env, id); if (!u) return json({ error: 'not found' }, 404);
    return json({ user: u, ledger: await all('SELECT * FROM ledger WHERE user_id = ? ORDER BY at', id), messages: await all('SELECT * FROM messages WHERE user_id = ? ORDER BY at DESC LIMIT 100', id),
      referrals: await all('SELECT id, name, username, gate, first_seen FROM users WHERE ref_by = ?', id), rewards: await all('SELECT * FROM rewards WHERE user_id = ?', id) });
  }
  if (p === 'topics') {
    const since = Date.now() - (Number(url.searchParams.get('days')) || 30) * DAY;
    return json({ topics: await all(`SELECT topic, COUNT(*) n, COUNT(DISTINCT user_id) users, SUM(handoff) handoffs, MAX(at) last FROM messages WHERE at > ? GROUP BY topic ORDER BY n DESC LIMIT 200`, since),
      articles: await all('SELECT article, COUNT(*) n FROM messages WHERE article IS NOT NULL AND at > ? GROUP BY article ORDER BY n DESC', since) });
  }
  if (p === 'messages') {
    const topic = url.searchParams.get('topic'), q = url.searchParams.get('q');
    let sql = 'SELECT m.*, u.name, u.username FROM messages m LEFT JOIN users u ON u.id = m.user_id WHERE 1=1', b = [];
    if (topic) { sql += ' AND m.topic = ?'; b.push(topic); }
    if (q) { sql += ' AND m.text LIKE ?'; b.push('%' + q + '%'); }
    if (url.searchParams.get('handoff')) sql += ' AND m.handoff = 1';
    sql += ' ORDER BY m.at DESC LIMIT 300';
    return json({ messages: await all(sql, ...b) });
  }
  if (p === 'support-threads') {
    return json({ threads: await all(`SELECT s.user_id, u.name, u.username, u.gate, u.broker_id,
        MAX(s.id) AS last_id, MAX(s.at) AS last_at,
        (SELECT text FROM support WHERE user_id = s.user_id ORDER BY id DESC LIMIT 1) AS last_text,
        (SELECT sender FROM support WHERE user_id = s.user_id ORDER BY id DESC LIMIT 1) AS last_sender,
        SUM(CASE WHEN s.sender = 'user' AND s.id > COALESCE(u.support_admin_seen, 0) THEN 1 ELSE 0 END) AS unread
      FROM support s LEFT JOIN users u ON u.id = s.user_id GROUP BY s.user_id ORDER BY last_at DESC LIMIT 200`) });
  }
  if (p === 'support-thread') {
    const id = Number(url.searchParams.get('id') || body.id);
    const msgs = await supportMsgs(env, id);
    if (msgs.length) await env.DB.prepare('UPDATE users SET support_admin_seen = ? WHERE id = ?').bind(msgs[msgs.length - 1].id, id).run();
    return json({ user: await getUser(env, id), msgs });
  }
  if (p === 'flow-stop') { const id = Number(body.id), off = body.off ? 1 : 0; await env.DB.prepare('UPDATE users SET autopush_off = ? WHERE id = ?').bind(off, id).run(); await crmLog(env, id, me.name, off ? 'остановил(а) автокасания' : 'включил(а) автокасания'); return json({ ok: true }); }
  if (p === 'support-reply') { const r = await supportReply(env, Number(body.id), body.text, me.name); if (r.ok) await crmLog(env, Number(body.id), me.name, 'ответил(а) в поддержке'); return json(r); }
  if (p === 'vip') { const r = await grantVip(env, Number(body.id), me.name); if (r.ok) await crmLog(env, Number(body.id), me.name, 'выдал(а) VIP-ссылку'); return json(r); }
  if (p === 'gate') { const r = await setGate(env, Number(body.id), String(body.status), me.name); if (r) await crmLog(env, Number(body.id), me.name, 'счёт: ' + ({ approved: 'подтверждён', rejected: 'отклонён', pending: 'на проверке', none: 'сброшен' }[body.status] || body.status)); return json({ ok: !!r }); }
  if (p === 'videos') {
    if (req.method === 'POST') { await setting(env, 'videos', JSON.stringify(body.videos || {})); }
    return json({ videos: JSON.parse((await setting(env, 'videos')) || '{}') });
  }
  if (p === 'reward') {
    if (body.undo) await env.DB.prepare('DELETE FROM rewards WHERE user_id = ? AND tier = ?').bind(Number(body.id), Number(body.tier)).run();
    else await env.DB.prepare('INSERT OR IGNORE INTO rewards (user_id, tier, at) VALUES (?, ?, ?)').bind(Number(body.id), Number(body.tier), Date.now()).run();
    return json({ ok: true });
  }
  if (p === 'setup-webhook') {
    const r = await tg(env, 'setWebhook', { url: url.origin + '/webhook', allowed_updates: WEBHOOK_UPDATES });
    return json({ ok: !!r.ok, r });
  }
  if (p === 'sales-reset') { await setting(env, 'sales_chat', null); return json({ ok: true }); }
  if (p === 'rewards') return json({ rewards: await all('SELECT * FROM rewards') });
  return json({ error: 'unknown' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    // ad landing on the custom domain (jetsjaisontraider.com); workers.dev keeps the API banner
    if (req.method === 'GET' && url.pathname === '/' && !url.hostname.endsWith('.workers.dev')) {
      return new Response(landingHtml({ pixelId: env.PIXEL_ID, bot: env.BOT_USERNAME || 'JasonProTreid_bot' }),
        { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    try {
      await ensureSchema(env);
      if (req.method === 'POST') {
        if (url.pathname === '/open') return await handleOpen(req, env);
        if (url.pathname === '/onboard') return await handleOnboard(req, env);
        if (url.pathname === '/broker') return await handleBroker(req, env);
        if (url.pathname === '/ledger') return await handleLedger(req, env);
        if (url.pathname === '/chat') return await handleChat(req, env);
        if (url.pathname === '/support') return await handleSupport(req, env);
        if (url.pathname === '/deposit') return await handleDeposit(req, env);
        if (url.pathname === '/webhook') return await handleWebhook(req, env);
        if (url.pathname === '/track') return await handleTrack(req, env, ctx);
      }
      if (req.method === 'GET' && url.pathname === '/join') return await handleJoin(req, env, url);
      if (req.method === 'GET' && url.pathname === '/r/broker') {
        const uid = Number(url.searchParams.get('u')) || 0, bu = uid ? await getUser(env, uid) : null;
        if (bu) {
          await env.DB.prepare('UPDATE users SET broker_click = COALESCE(broker_click, ?) WHERE id = ?').bind(Date.now(), uid).run();
          if (!bu.broker_click) await opPush(env, bu, '📝 перешёл по ссылке брокера');
          if ((!bu.gate || bu.gate === 'none') && (!bu.flow || bu.flow === 'W' || bu.flow === 'R1')) await setFlow(env, uid, 'R2');
        }
        return Response.redirect(env.REF_LINK || REF_LINK_DEFAULT, 302);
      }
      if (url.pathname.startsWith('/admin/')) return await admin(req, env, url);
      if (url.pathname === '/status') {
        const wi = await tg(env, 'getWebhookInfo', {});
        let w = wi.result || {};
        // self-heal: make sure Telegram sends every update type the worker handles (business chats included)
        if (w.url && WEBHOOK_UPDATES.some(t => !(w.allowed_updates || []).includes(t))) {
          await tg(env, 'setWebhook', { url: w.url, allowed_updates: WEBHOOK_UPDATES });
          w = (await tg(env, 'getWebhookInfo', {})).result || w;
        }
        return json({ version: 'v2.21', clubConnected: !!(await setting(env, 'club_chat')), clubTitle: await setting(env, 'club_title'), vipConnected: !!(await setting(env, 'vip_chat')), vipTitle: await setting(env, 'vip_title'), jasonAccount: ((b) => b ? (b.username ? '@' + b.username : b.name) + (b.can_reply ? '' : ' (no reply right)') : null)(await bizConn(env)), salesChat: !!(await setting(env, 'sales_chat')),
          webhook: { ok: !!w.url, pending: w.pending_update_count, lastError: w.last_error_message || null, lastErrorAgoMin: w.last_error_date ? Math.round((Date.now() / 1000 - w.last_error_date) / 60) : null, allowed: w.allowed_updates || null } });
      }
    } catch (e) { return json({ error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
    return new Response('Jason Academy API v2', { status: 200, headers: CORS });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await ensureSchema(env);
      await slaTick(env);
      await runFlows(env, PUBLIC_ORIGIN);
      if (event.cron === '0 * * * *' || new Date(event.scheduledTime || Date.now()).getUTCMinutes() === 0 && event.cron !== '* * * * *') await cron(env);
    })());
  }
};
