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
     GET  /          on the custom domain → ad landing (landingHtml, inlined below), auto-opens the bot with start=fb_<cid>
     POST /track     click from the landing → fb_clicks; funnel steps go to Meta Conversions API
   Admin (header x-admin-key: ADMIN_KEY):
     GET  /admin/stats, /admin/users, /admin/user?id=, /admin/topics?days=, /admin/messages?topic=&q=
     POST /admin/gate {id,status}, /admin/videos {videos}, /admin/reward {id,tier}, /admin/sales-reset
   Cron (hourly): study reminders, hand-off catch-ups, onboarding catch-ups.

   Bindings: DB (D1), AI (Workers AI, optional)
   Meta CAPI (optional): PIXEL_ID (var), CAPI_TOKEN (secret), TEST_EVENT_CODE (var, only while testing)
   Vars/secrets: BOT_TOKEN, APP_URL, ADMIN_KEY, MANAGER (username without @), CHANNEL_ID, CHANNEL_LINK, ANTHROPIC_API_KEY (optional)
*/


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
    en: '✅ Your broker account is confirmed — all courses are now unlocked. Welcome in!',
    ru: '✅ Твой брокерский счёт подтверждён — все курсы открыты. Добро пожаловать!',
    fr: '✅ Ton compte broker est confirmé — tous les cours sont débloqués. Bienvenue !',
    de: '✅ Dein Brokerkonto ist bestätigt — alle Kurse sind freigeschaltet. Willkommen!'
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
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
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
  `CREATE INDEX IF NOT EXISTS idx_fb_clicks_tg ON fb_clicks(tg_id, ts)`
];
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  for (const q of SCHEMA) await env.DB.prepare(q).run();
  for (const col of ['club_joined INTEGER', 'src TEXT', 'invite TEXT', 'invite_exp INTEGER', 'vip_at INTEGER', 'vip_joined INTEGER', 'gate_msg INTEGER']) { try { await env.DB.prepare('ALTER TABLE users ADD COLUMN ' + col).run(); } catch (e) {} }
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
    if (srcM && !existed) await env.DB.prepare('UPDATE users SET src = ? WHERE id = ?').bind(srcM[1], u.id).run();
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
async function admin(req, env, url) {
  // brute-force guard: max 10 wrong keys per IP per 15 minutes
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_fails (ip TEXT, at INTEGER)').run();
  const since = Date.now() - 15 * 60e3;
  const fails = (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_fails WHERE ip = ? AND at > ?').bind(ip, since).first())?.n || 0;
  if (fails >= 10) return json({ error: 'too many attempts, wait 15 minutes' }, 429);
  if (!env.ADMIN_KEY || req.headers.get('x-admin-key') !== env.ADMIN_KEY) {
    await env.DB.prepare('INSERT INTO admin_fails (ip, at) VALUES (?, ?)').bind(ip, Date.now()).run();
    return json({ error: 'unauthorized' }, 401);
  }
  const p = url.pathname.replace('/admin/', '');
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const all = async (q, ...b) => (await env.DB.prepare(q).bind(...b).all()).results || [];
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
  if (p === 'vip') { const r = await grantVip(env, Number(body.id), 'админка'); return json(r); }
  if (p === 'gate') { const r = await setGate(env, Number(body.id), String(body.status), 'admin'); return json({ ok: !!r }); }
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

/* ---------------- ad landing (inlined so a single-file deploy can never drop it) ---------------- */
/* Ad landing served by this worker on the custom domain (GET /).
   Branded page so Meta review sees real content; auto-opens the bot after ~1.2 s.
   PIXEL_ID and the bot username are injected from env at request time. */
function landingHtml({ pixelId = '', bot = 'JasonProTreid_bot' } = {}) {
  const px = /^\d+$/.test(String(pixelId)) ? String(pixelId) : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jason Trade Academy</title>
<meta name="description" content="Learn to trade gold — risk first. 10 short courses, quizzes, streaks and a position-size calculator.">
<meta property="og:title" content="Jason Trade Academy">
<meta property="og:description" content="Learn to trade gold — risk first. Free short courses in Telegram.">
<script>
const CONFIG = { PIXEL_ID: '${px}', BOT: '${bot}', TRACK: '/track', DELAY: 1200 };
</script>
<script>
if (CONFIG.PIXEL_ID) {
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', CONFIG.PIXEL_ID); fbq('track', 'PageView');
}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Unbounded:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#08080A;--card:#16161A;--line:#2A2A30;--text:#F2EFE6;--muted:#A6A193;--accent:#4F7DFF}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:var(--bg)}
  body{color:var(--text);font:15px/1.55 Inter,system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:40px 16px 20px}
  main{width:100%;max-width:420px;text-align:center;margin:auto 0}
  .brand{font:500 12px/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:22px}
  h1{font:700 26px/1.2 Unbounded,sans-serif;margin-bottom:12px}
  .sub{color:var(--muted);margin-bottom:26px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:28px}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 6px}
  .stat b{display:block;font:500 20px/1.2 "JetBrains Mono",monospace}
  .stat span{font-size:12px;color:var(--muted)}
  .status{display:flex;align-items:center;justify-content:center;gap:10px;color:var(--muted);font-size:14px;margin-bottom:16px}
  .spin{width:18px;height:18px;border:2px solid rgba(79,125,255,.25);border-top-color:var(--accent);border-radius:50%;animation:r .8s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  .btn{display:block;padding:17px;border-radius:14px;background:var(--accent);color:#fff;font-weight:600;font-size:16px;text-decoration:none}
  .hint{font-size:13px;color:var(--muted);margin-top:12px}
  footer{max-width:420px;font-size:11px;line-height:1.5;color:#6f6b62;text-align:center;margin-top:32px}
</style>
</head>
<body>
<main>
  <div class="brand">Jason Trade Academy</div>
  <h1>Learn to trade like a pro — risk first</h1>
  <p class="sub">Short lessons, a quiz after every course, and tools you'll actually use on a live chart.</p>
  <div class="stats">
    <div class="stat"><b>10</b><span>courses</span></div>
    <div class="stat"><b>30</b><span>lessons</span></div>
    <div class="stat"><b>3</b><span>calculators</span></div>
  </div>
  <div class="status" id="status"><div class="spin"></div>Opening Telegram…</div>
  <a id="go" class="btn" href="https://t.me/${bot}">Start learning free</a>
  <p class="hint">Tap <b>Start</b> when the chat opens.</p>
</main>
<footer>Educational content, not financial advice. Trading CFDs and forex with leverage carries a high risk of losing money. Past results don't guarantee future returns. Never trade money you can't afford to lose.</footer>
<script>
(function(){
  var qs = new URLSearchParams(location.search);
  function getCookie(n){ var m = document.cookie.match('(?:^|; )'+n+'=([^;]*)'); return m ? decodeURIComponent(m[1]) : null; }
  var fbclid = qs.get('fbclid');
  if (fbclid && !getCookie('_fbc')) document.cookie = '_fbc=' + encodeURIComponent('fb.1.' + Date.now() + '.' + fbclid) + ';max-age=7776000;path=/;SameSite=Lax';
  var cid; try { cid = sessionStorage.getItem('cid'); } catch(e) {}
  if (!cid) { cid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); try { sessionStorage.setItem('cid', cid); } catch(e) {} }
  var p = 'fb_' + cid;
  var webLink = 'https://t.me/' + CONFIG.BOT + '?start=' + p;
  var appLink = 'tg://resolve?domain=' + CONFIG.BOT + '&start=' + p;
  var btn = document.getElementById('go'); btn.href = webLink;
  if (window.fbq) fbq('track', 'ViewContent', {}, { eventID: cid });
  var sent = false;
  function track(){
    if (sent) return; sent = true;
    var utm = {}; ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){ if (qs.get(k)) utm[k] = qs.get(k); });
    var data = JSON.stringify({ cid: cid, fbc: getCookie('_fbc'), fbp: getCookie('_fbp'), url: location.href, ua: navigator.userAgent, utm: utm });
    try { navigator.sendBeacon(CONFIG.TRACK, data); } catch(e) { fetch(CONFIG.TRACK, { method:'POST', body:data, keepalive:true }); }
  }
  btn.addEventListener('click', track);
  var mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  setTimeout(function(){
    track();
    location.href = mobile ? appLink : webLink;
    setTimeout(function(){ if (!document.hidden) { document.getElementById('status').textContent = 'Didn\\u2019t open? Tap the button below.'; location.href = webLink; } }, 1500);
  }, CONFIG.DELAY);
})();
</script>
</body>
</html>`;
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
        if (url.pathname === '/webhook') return await handleWebhook(req, env);
        if (url.pathname === '/track') return await handleTrack(req, env, ctx);
      }
      if (url.pathname.startsWith('/admin/')) return await admin(req, env, url);
      if (url.pathname === '/status') {
        const wi = await tg(env, 'getWebhookInfo', {});
        const w = wi.result || {};
        return json({ version: 'v2.6', clubConnected: !!(await setting(env, 'club_chat')), clubTitle: await setting(env, 'club_title'), vipConnected: !!(await setting(env, 'vip_chat')), vipTitle: await setting(env, 'vip_title'), salesChat: !!(await setting(env, 'sales_chat')),
          webhook: { ok: !!w.url, pending: w.pending_update_count, lastError: w.last_error_message || null, lastErrorAgoMin: w.last_error_date ? Math.round((Date.now() / 1000 - w.last_error_date) / 60) : null, allowed: w.allowed_updates || null } });
      }
    } catch (e) { return json({ error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
    return new Response('Jason Academy API v2', { status: 200, headers: CORS });
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(cron(env)); }
};
