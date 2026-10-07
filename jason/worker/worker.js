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
You help with: concepts from the courses (pips, lots, leverage, margin, support/resistance, structure, EMA/RSI/ATR, position sizing, R:R, drawdown, sessions, NFP/CPI/FOMC, trading plans, journaling, psychology, copy trading), using the app (Courses, Tools calculators, goal widget, referral link, broker registration step), and where to find lessons.
Rules:
- Never give personalised buy/sell calls, price predictions or "what should I trade now".
- Never promise or imply guaranteed returns. Favour risk management (0.5–2% risk per trade, stop loss on every trade).
- If someone describes big losses, trading borrowed money or with money needed for debts/rent, or distress: respond with care, suggest pausing, do not push the club.
- If asked whether you are a human or Jason himself, say clearly you are an AI assistant.
- This is education, not financial advice.
OUTPUT TAGS — after your answer, on the last line, add machine tags (the student never sees them):
[TOPIC:<2-4 word English topic>] always.
[ARTICLE:<id>] if the message matches one of these problems: ${Object.entries(ARTICLES).map(([k, v]) => k + ' = ' + v).join('; ')}.
[HANDOFF] if the student is confused about how the app or platform works (registration, broker account, deposit, access, where things are), something is broken for them, or they ask for a human/manager.`;

const HANDOFF_WORDS = /manager|human|support|real person|doesn'?t work|not working|can'?t (register|log|access|find|open)|how do i (register|deposit|get access)|менеджер|поддержк|живой|человек|не работает|не могу|не получается|как зарегистр|как пополн|не открывает|доступ|gestionnaire|humain|ne marche pas|je n'?arrive pas|manager|mensch|funktioniert nicht|kann nicht|zugang/i;

const T = {
  start: {
    en: "Welcome to Jason Trade Academy 📈\n\n10 short courses — from your first chart to trading gold — with quizzes, streaks and a position-size calculator.\n\nRisk first. Tap below to start.",
    ru: "Добро пожаловать в Jason Trade Academy 📈\n\n10 коротких курсов — от первого графика до торговли золотом — с квизами, сериями и калькулятором размера позиции.\n\nРиск прежде всего. Жми ниже, чтобы начать.",
    fr: "Bienvenue à la Jason Trade Academy 📈\n\n10 cours courts — de ton premier graphique au trading de l’or — avec quiz, séries et calculateur de taille de position.\n\nLe risque d’abord. Appuie ci-dessous pour commencer.",
    de: "Willkommen in der Jason Trade Academy 📈\n\n10 kurze Kurse — vom ersten Chart bis zum Goldhandel — mit Quizzen, Serien und Positionsgrößen-Rechner.\n\nRisiko zuerst. Tippe unten, um zu starten."
  },
  clubInvite: {
    en: "🔐 Here's your personal pass to Jason's private channel — tap the button to join. The link works once and expires in 24 hours.",
    ru: '🔐 Твой личный пропуск в закрытый канал Джейсона — жми кнопку, чтобы вступить. Ссылка одноразовая и действует 24 часа.',
    fr: '🔐 Voici ton accès personnel au canal privé de Jason — appuie sur le bouton pour rejoindre. Le lien est à usage unique et expire dans 24 h.',
    de: '🔐 Dein persönlicher Zugang zu Jasons privatem Kanal — tipp auf den Button, um beizutreten. Der Link gilt einmal und läuft in 24 Stunden ab.'
  },
  clubBtn: { en:'🔓 Join the private channel', ru:'🔓 Вступить в закрытый канал', fr:'🔓 Rejoindre le canal privé', de:'🔓 Privatem Kanal beitreten' },
  clubWelcome: {
    en: "✅ You're in! As promised — here's your access to my academy. Tap below 👇",
    ru: '✅ Ты в канале! Как и обещал — вот доступ к моей академии. Жми ниже 👇',
    fr: '✅ Tu es dedans ! Comme promis — voici ton accès à mon académie. Appuie ci-dessous 👇',
    de: '✅ Du bist drin! Wie versprochen — hier ist dein Zugang zu meiner Akademie. Tipp unten 👇'
  },
  subGate: {
    en: "Hey! 👋 I'm Jason.\n\nSubscribe to my private channel — and I'll give you access to my trading academy: 10 courses, quizzes and calculators, all free.\n\n1️⃣ Tap «Subscribe»\n2️⃣ Come back and tap «I've subscribed»",
    ru: "Привет! 👋 Я Джейсон.\n\nПодпишись на мой закрытый канал — и я дам тебе доступ к своей академии трейдинга: 10 курсов, квизы и калькуляторы, всё бесплатно.\n\n1️⃣ Жми «Подписаться»\n2️⃣ Вернись и нажми «Я подписался»",
    fr: "Salut ! 👋 C'est Jason.\n\nAbonne-toi à mon canal privé — et je te donne accès à mon académie de trading : 10 cours, quiz et calculateurs, tout gratuit.\n\n1️⃣ Appuie sur « S'abonner »\n2️⃣ Reviens et appuie sur « Je suis abonné »",
    de: "Hey! 👋 Ich bin Jason.\n\nAbonniere meinen privaten Kanal — und ich gebe dir Zugang zu meiner Trading-Akademie: 10 Kurse, Quizze und Rechner, alles kostenlos.\n\n1️⃣ Tippe auf «Abonnieren»\n2️⃣ Komm zurück und tippe auf «Ich habe abonniert»"
  },
  subBtn: { en:'📢 Subscribe', ru:'📢 Подписаться', fr:"📢 S'abonner", de:'📢 Abonnieren' },
  checkBtn: { en:"✅ I've subscribed", ru:'✅ Я подписался', fr:'✅ Je suis abonné', de:'✅ Ich habe abonniert' },
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
    en: '✅ Your broker account is confirmed — the academy is open! Your first lesson is waiting. The next ones unlock as you go.',
    ru: '✅ Твой брокерский счёт подтверждён — академия открыта! Первый урок уже ждёт, следующие открываются по мере прохождения.',
    fr: '✅ Ton compte broker est confirmé — l’académie est ouverte ! Ta première leçon t’attend, les suivantes se débloquent au fil du parcours.',
    de: '✅ Dein Brokerkonto ist bestätigt — die Akademie ist offen! Deine erste Lektion wartet, die nächsten schalten sich nach und nach frei.'
  },
  supportReply: {
    en: '💬 Support replied:\n\n{t}',
    ru: '💬 Ответ поддержки:\n\n{t}',
    fr: '💬 Réponse du support :\n\n{t}',
    de: '💬 Antwort vom Support:\n\n{t}'
  },
  supportOpen: { en:'Open the chat', ru:'Открыть чат', fr:'Ouvrir le chat', de:'Chat öffnen' },
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
  `CREATE TABLE IF NOT EXISTS support_map (chat_id TEXT, msg_id INTEGER, user_id INTEGER, PRIMARY KEY (chat_id, msg_id))`
];
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  for (const q of SCHEMA) await env.DB.prepare(q).run();
  for (const col of ['club_joined INTEGER', 'src TEXT', 'invite TEXT', 'invite_exp INTEGER', 'vip_at INTEGER', 'vip_joined INTEGER', 'gate_msg INTEGER', 'support_seen INTEGER DEFAULT 0', 'support_admin_seen INTEGER DEFAULT 0']) { try { await env.DB.prepare('ALTER TABLE users ADD COLUMN ' + col).run(); } catch (e) {} }
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
    gate: u.gate || 'none', brokerId: u.broker_id,
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
  return json({ ok: true, me: await profile(env, await getUser(env, u.id)) });
}

async function handleBroker(req, env) {
  const { body, u, error } = await authed(req, env); if (error) return error;
  const acc = String(body.accountId || '').replace(/[^\w-]/g, '').slice(0, 32);
  if (acc.length < 4) return json({ error: 'bad account' }, 400);
  if (u.gate === 'approved') return json({ ok: true, me: await profile(env, u) });
  await env.DB.prepare(`UPDATE users SET broker_id = ?, gate = 'pending', gate_at = ? WHERE id = ?`).bind(acc, Date.now(), u.id).run();
  await toSales(env, ['🔐 <b>Запрос доступа к курсам</b>', userLine(u), `Счёт у брокера: <code>${esc(acc)}</code>`, 'Проверь в партнёрском кабинете, что счёт открыт по нашей ссылке.'].join('\n'),
    { reply_markup: { inline_keyboard: [[{ text: '✅ Подтвердить', callback_data: `gate:approved:${u.id}` }, { text: '❌ Отклонить', callback_data: `gate:rejected:${u.id}` }], [{ text: '💰 Депозит внесён → выдать VIP', callback_data: `vip:${u.id}` }]] } });
  if (u.gate !== 'pending') await capiByUser(env, u.id, 'SubmitApplication');
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
const supportMsgs = async (env, uid) => ((await env.DB.prepare('SELECT id, sender, text, by, at FROM support WHERE user_id = ? ORDER BY id DESC LIMIT 100').bind(uid).all()).results || []).reverse();
async function handleSupport(req, env) {
  const { body, u, error } = await authed(req, env); if (error) return error;
  const text = String(body.text || '').trim().slice(0, 1000);
  if (text) {
    const hour = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM support WHERE user_id = ? AND sender = 'user' AND at > ?`).bind(u.id, Date.now() - HOUR).first())?.n || 0;
    if (hour >= 30) return json({ error: 'rate', msgs: await supportMsgs(env, u.id) }, 429);
    await env.DB.prepare(`INSERT INTO support (user_id, sender, text, at) VALUES (?, 'user', ?, ?)`).bind(u.id, text, Date.now()).run();
    const gate = { none: 'счёт не отправлен', pending: `счёт ${esc(u.broker_id || '')} на проверке`, approved: 'доступ открыт', rejected: 'счёт отклонён' }[u.gate || 'none'] || '';
    const r = await toSales(env, ['🆘 <b>Поддержка</b>', userLine(u), gate ? 'Статус: ' + gate : '', '', esc(text), '', '↩️ <i>Ответьте реплаем на это сообщение — ответ придёт ученику в приложение и в бот.</i>'].filter((x, i) => x || i === 3 || i === 5).join('\n'));
    if (r && r.ok) await env.DB.prepare('INSERT OR REPLACE INTO support_map (chat_id, msg_id, user_id) VALUES (?, ?, ?)').bind(String(r.result.chat.id), r.result.message_id, u.id).run();
  }
  const msgs = await supportMsgs(env, u.id);
  const lastMgr = msgs.filter(m => m.sender === 'manager').pop();
  if (lastMgr && lastMgr.id > (u.support_seen || 0)) await env.DB.prepare('UPDATE users SET support_seen = ? WHERE id = ?').bind(lastMgr.id, u.id).run();
  return json({ ok: true, msgs, online: !!(await setting(env, 'sales_chat')) });
}
async function supportReply(env, uid, text, by) {
  const u = await getUser(env, uid); if (!u) return { ok: false, error: 'no user' };
  text = String(text || '').trim().slice(0, 2000); if (!text) return { ok: false, error: 'empty' };
  await env.DB.prepare(`INSERT INTO support (user_id, sender, text, by, at) VALUES (?, 'manager', ?, ?, ?)`).bind(uid, text, String(by || '').slice(0, 64), Date.now()).run();
  const lang = pickLang(u.lang);
  const r = await tg(env, 'sendMessage', { chat_id: uid, text: tt('supportReply', lang, { t: text }), reply_markup: openButton(env, tt('supportOpen', lang)) });
  return { ok: true, delivered: !!(r && r.ok) };
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
  await env.DB.prepare('UPDATE users SET vip_at = ? WHERE id = ?').bind(Date.now(), id).run();
  await toSales(env, `💎 VIP-доступ выдан: ${userLine(u)} (выдал: ${esc(by || '—')})`);
  return { ok: true };
}
async function sendSubGate(env, chatId, userId, lang) {
  // one gate message per chat: a repeated /start replaces the old one instead of stacking duplicates
  const prev = await env.DB.prepare('SELECT gate_msg FROM users WHERE id = ?').bind(userId).first();
  if (prev && prev.gate_msg) await tg(env, 'deleteMessage', { chat_id: chatId, message_id: prev.gate_msg });
  const link = (await clubInvite(env, userId)) || env.CHANNEL_LINK;
  const row = link ? [[{ text: tt('subBtn', lang), url: link }]] : [];
  const r = await tg(env, 'sendMessage', { chat_id: chatId, text: tt('subGate', lang), reply_markup: { inline_keyboard: [...row, [{ text: tt('checkBtn', lang), callback_data: 'subchk' }]] } });
  if (r && r.ok) await env.DB.prepare('UPDATE users SET gate_msg = ? WHERE id = ?').bind(r.result.message_id, userId).run();
  return r;
}
// Turn the subscription-gate message into the "You're in" message in place (keeps the chat clean).
// Falls back to a new message if the gate message is gone or can't be edited.
async function showClubWelcome(env, chatId, userId, lang, msgId) {
  const text = tt('clubWelcome', lang), reply_markup = openButton(env, tt('openBtn', lang));
  let r = msgId ? await tg(env, 'editMessageText', { chat_id: chatId, message_id: msgId, text, reply_markup }) : null;
  if (!r || !r.ok) r = await tg(env, 'sendMessage', { chat_id: chatId, text, reply_markup });
  await env.DB.prepare('UPDATE users SET gate_msg = NULL WHERE id = ?').bind(userId).run();
  return r;
}

async function handleWebhook(req, env) {
  const upd = await req.json().catch(() => ({}));
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
      await upsertUser(env, jr.from);
      await tg(env, 'approveChatJoinRequest', { chat_id: jr.chat.id, user_id: jr.from.id });
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
  if (!m || !m.text) return new Response('ok');
  const text = m.text.trim();
  if (m.reply_to_message && m.chat.type !== 'private' && String(m.chat.id) === String(await setting(env, 'sales_chat'))) {
    const link = await env.DB.prepare('SELECT user_id FROM support_map WHERE chat_id = ? AND msg_id = ?').bind(String(m.chat.id), m.reply_to_message.message_id).first();
    if (link && !text.startsWith('/')) {
      const r = await supportReply(env, link.user_id, text, m.from.username ? '@' + m.from.username : m.from.first_name);
      await tg(env, 'setMessageReaction', { chat_id: m.chat.id, message_id: m.message_id, reaction: [{ type: 'emoji', emoji: r.delivered ? '👍' : '👀' }] });
      return new Response('ok');
    }
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
      await tg(env, 'sendMessage', { chat_id: m.chat.id, text: tt('start', lang), reply_markup: openButton(env, tt('openBtn', lang)) });
    }
  }
  return new Response('ok');
}

/* ---------------- cron ---------------- */
async function cron(env) {
  await ensureSchema(env);
  const now = Date.now();
  const users = (await env.DB.prepare('SELECT * FROM users WHERE chat_ok = 1').all()).results || [];
  for (const u of users) {
    const lang = pickLang(u.lang);
    const localHour = (new Date().getUTCHours() + Math.round(u.tz || 0) + 48) % 24;
    const daytime = localHour >= 10 && localHour <= 20;
    let sent = null;
    if (env.MANAGER && u.handoff_at && !u.handoff_catch && now - u.handoff_at > HOUR) {
      sent = await tg(env, 'sendMessage', { chat_id: u.id, text: tt('catchHandoff', lang, { m: env.MANAGER }), reply_markup: mgrButton(env, lang) });
      await env.DB.prepare('UPDATE users SET handoff_catch = 1 WHERE id = ?').bind(u.id).run();
    } else if (daytime && u.onboarded_at && (u.gate === 'none' || !u.gate) && !u.gate_catch && now - u.onboarded_at > 6 * HOUR) {
      const kb = { inline_keyboard: [[{ text: tt('openBtn', lang), web_app: { url: env.APP_URL } }], ...(env.MANAGER ? [[{ text: tt('mgrBtn', lang), url: `https://t.me/${env.MANAGER}` }]] : [])] };
      sent = await tg(env, 'sendMessage', { chat_id: u.id, text: tt('catchGate', lang, { m: env.MANAGER || '' }), reply_markup: kb });
      await env.DB.prepare('UPDATE users SET gate_catch = 1 WHERE id = ?').bind(u.id).run();
    } else if (daytime) {
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
  if (u.vip_at) return 'депозит';
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
  'support-threads': 'crm', 'support-thread': 'crm', 'support-reply': 'crm',
  tasks: 'tasks',
  videos: 'content', topics: 'content', rewards: 'content', reward: 'content',
  staff: 'team',
  'setup-webhook': 'settings', 'sales-reset': 'settings', settings: 'settings'
};

async function crmLog(env, uid, who, what) {
  await env.DB.prepare('INSERT INTO crm_log (user_id, who, what, at) VALUES (?, ?, ?, ?)').bind(uid, String(who || '?').slice(0, 60), String(what).slice(0, 300), Date.now()).run();
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
    const us = await all(`SELECT u.id, u.first_seen, u.src, u.ref_by, u.sub, u.club_joined, u.opens, u.onboarded_at, u.gate, u.vip_at, u.vip_joined, u.tier,
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
        u.gate, u.gate_at, u.broker_id, u.tier, u.vip_at, u.vip_joined, u.goal_text,
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
    const r = await tg(env, 'setWebhook', { url: url.origin + '/webhook', allowed_updates: ['message', 'callback_query', 'my_chat_member', 'chat_member', 'chat_join_request'] });
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
        if (url.pathname === '/webhook') return await handleWebhook(req, env);
        if (url.pathname === '/track') return await handleTrack(req, env, ctx);
      }
      if (url.pathname.startsWith('/admin/')) return await admin(req, env, url);
      if (url.pathname === '/status') {
        const wi = await tg(env, 'getWebhookInfo', {});
        const w = wi.result || {};
        return json({ version: 'v2.8', clubConnected: !!(await setting(env, 'club_chat')), clubTitle: await setting(env, 'club_title'), vipConnected: !!(await setting(env, 'vip_chat')), vipTitle: await setting(env, 'vip_title'), salesChat: !!(await setting(env, 'sales_chat')),
          webhook: { ok: !!w.url, pending: w.pending_update_count, lastError: w.last_error_message || null, lastErrorAgoMin: w.last_error_date ? Math.round((Date.now() / 1000 - w.last_error_date) / 60) : null, allowed: w.allowed_updates || null } });
      }
    } catch (e) { return json({ error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
    return new Response('Jason Academy API v2', { status: 200, headers: CORS });
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(cron(env)); }
};
