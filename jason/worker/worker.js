/* Jason Trading Academy — Cloudflare Worker backend
   Routes:
     POST /open     activity ping from the app → stores progress, returns { access, channel }
     POST /chat     Jason AI assistant (Anthropic API)
     POST /webhook  Telegram bot updates (/start → button that opens the app)
     GET  /stats?key=ADMIN_KEY   quick numbers for you
   Cron: nudges students who haven't studied for 2+ days (max once per 3 days).

   Env vars / secrets (wrangler.toml + `wrangler secret put`):
     BOT_TOKEN          Telegram bot token from @BotFather
     APP_URL            GitHub Pages URL of the mini app
     CHANNEL_ID         numeric channel id (-100…) — bot must be an admin there. Empty = no lock
     CHANNEL_LINK       invite link shown on the lock screen
     ANTHROPIC_API_KEY  for Jason AI (optional — without it Workers AI binding `AI` is used)
     ADMIN_KEY          any long random string for /stats
   KV binding: USERS
*/

const MODEL = 'claude-haiku-4-5-20251001';
const CHAT_LIMIT_PER_DAY = 40;

const SYSTEM = `You are "Jason AI", the assistant inside Jason Trading Academy — a Telegram mini app that teaches trading (forex/CFDs, with a focus on gold, XAUUSD).
Voice: confident, friendly, direct, like an experienced trader mentoring a newer one. Short answers (under 120 words unless asked for detail), plain English, no hype.
You help with: explaining concepts from the courses (pips, lots, leverage, margin, support/resistance, structure, EMA/RSI/ATR, position sizing, R:R, drawdown, sessions, NFP/CPI/FOMC, trading plans, journaling, psychology, copy trading), how to use the app's Tools tab (position size, drawdown, compounding calculators), and where to find lessons.
Courses: Trading 101, Your First Chart, Support Resistance & Trend, Indicators Without the Noise, Risk First, Trading Gold (XAUUSD), Gold Setups Playbook, Your Trading Plan, Trader Psychology, Copy Trading & Signals.
Rules:
- Never give personalised buy/sell calls, price predictions or "what should I trade now". Explain how to analyse instead.
- Never promise or imply guaranteed returns. Always favour risk management (0.5–2% risk per trade, stop loss on every trade).
- If someone describes big losses, borrowing money to trade, or distress, respond with care, suggest pausing trading, and don't push the club.
- If asked whether you are a human or Jason himself, say clearly you are an AI assistant.
- You may mention Jason's private club (live trades with reasoning) when someone asks how to see trades applied live — once, without pressure.
- This is education, not financial advice.`;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }
});

/* Telegram initData signature check — proves the request came from your bot's mini app */
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
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return r.json().catch(() => ({}));
}

async function isSubscribed(env, userId) {
  if (!env.CHANNEL_ID) return true;
  const r = await tg(env, 'getChatMember', { chat_id: env.CHANNEL_ID, user_id: userId });
  if (!r.ok) return true; // fail open: a Telegram hiccup must not lock students out
  return ['creator', 'administrator', 'member', 'restricted'].includes(r.result.status);
}

const today = () => new Date().toISOString().slice(0, 10);

async function handleOpen(req, env) {
  const body = await req.json().catch(() => ({}));
  const user = await verifyInitData(body.initData, env.BOT_TOKEN);
  if (!user) return json({ error: 'bad initData' }, 401);
  const key = 'u:' + user.id;
  const u = (await env.USERS.get(key, 'json')) || { id: user.id, first: Date.now(), opens: 0 };
  u.name = user.first_name || user.username || u.name;
  u.username = user.username || u.username;
  u.last = Date.now();
  if (!body.progressOnly) u.opens = (u.opens || 0) + 1;
  if (body.studied) u.lastStudied = Date.now();
  if (body.progress) u.progress = body.progress;
  if (typeof body.tz === 'number') u.tz = body.tz;
  // subscription check is cached for 10 min unless the user taps "I've subscribed"
  if (body.recheck || !u.subAt || Date.now() - u.subAt > 600000) {
    u.sub = await isSubscribed(env, user.id); u.subAt = Date.now();
  }
  await env.USERS.put(key, JSON.stringify(u));
  return json({ access: u.sub !== false, channel: env.CHANNEL_LINK || null });
}

async function handleChat(req, env) {
  const body = await req.json().catch(() => ({}));
  const user = await verifyInitData(body.initData, env.BOT_TOKEN);
  if (!user) return json({ reply: 'Open the academy from Telegram to chat with me.' });
  const msg = String(body.message || '').slice(0, 1500);
  if (!msg) return json({ reply: 'Ask me anything from the lessons.' });
  const quotaKey = `q:${user.id}:${today()}`;
  const used = Number(await env.USERS.get(quotaKey)) || 0;
  if (used >= CHAT_LIMIT_PER_DAY) return json({ reply: "That's my limit for today — back tomorrow. Meanwhile, the lessons in the Courses tab cover most questions." });
  await env.USERS.put(quotaKey, String(used + 1), { expirationTtl: 172800 });

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8).map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (history.length && history[0].role !== 'user') history.shift();
  const messages = [...history, { role: 'user', content: msg }];

  const system = SYSTEM + (user.first_name ? `\nThe student's name is ${user.first_name}.` : '');
  let reply = null;
  if (env.ANTHROPIC_API_KEY) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, system, messages })
    });
    const data = await r.json().catch(() => null);
    reply = data && data.content && data.content[0] && data.content[0].text;
  } else if (env.AI) {
    // free fallback: Cloudflare Workers AI
    const out = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'system', content: system }, ...messages], max_tokens: 450 });
    reply = out && out.response;
  }
  return json({ reply: reply || "Couldn't answer that one — try rephrasing." });
}

function openButton(env, text) {
  return { inline_keyboard: [[{ text, web_app: { url: env.APP_URL } }]] };
}

async function handleWebhook(req, env) {
  const upd = await req.json().catch(() => ({}));
  const m = upd.message;
  if (m && m.text && m.text.startsWith('/start')) {
    await tg(env, 'sendMessage', {
      chat_id: m.chat.id,
      text: `Welcome to Jason Trading Academy 📈\n\n10 short courses — from your first chart to trading gold — with quizzes, streaks and a position-size calculator.\n\nRisk first. Tap below to start.`,
      reply_markup: openButton(env, 'Open the Academy')
    });
    const key = 'u:' + m.from.id;
    const u = (await env.USERS.get(key, 'json')) || { id: m.from.id, first: Date.now(), opens: 0 };
    u.chatOk = true; u.name = m.from.first_name || u.name;
    await env.USERS.put(key, JSON.stringify(u));
  }
  return new Response('ok');
}

const NUDGES = [
  "Your streak is waiting 🔥 One 4-minute lesson keeps it alive.",
  "Gold didn't stop moving while you were away. Pick up where you left off — next lesson is ready.",
  "Rule of the day: risk is decided before entry. Want to see why? Your next lesson covers it.",
  "Quick one: can you size a gold trade with a $6 stop on a $1,000 account? The calculator's in the app 👇"
];

async function nudge(env) {
  let cursor;
  const now = Date.now();
  do {
    const list = await env.USERS.list({ prefix: 'u:', cursor });
    for (const k of list.keys) {
      const u = await env.USERS.get(k.name, 'json');
      if (!u || !u.chatOk) continue;                                  // only users who started the bot
      const lastActive = u.lastStudied || u.last || u.first;
      if (now - lastActive < 2 * 864e5) continue;                     // studied recently
      if (u.nudgedAt && now - u.nudgedAt < 3 * 864e5) continue;       // max once per 3 days
      if (u.nudges >= 6 && now - lastActive > 30 * 864e5) continue;   // stop pestering the long-gone
      const localHour = (new Date().getUTCHours() + (u.tz || 0) + 24) % 24;
      if (localHour < 10 || localHour > 20) continue;                 // daytime only
      const r = await tg(env, 'sendMessage', { chat_id: u.id, text: NUDGES[(u.nudges || 0) % NUDGES.length], reply_markup: openButton(env, 'Continue learning') });
      if (!r.ok && r.error_code === 403) u.chatOk = false;            // user blocked the bot
      u.nudgedAt = now; u.nudges = (u.nudges || 0) + 1;
      await env.USERS.put(k.name, JSON.stringify(u));
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
}

async function stats(env) {
  let cursor, total = 0, active7 = 0, studied7 = 0, lessons = 0, courses = 0;
  const week = Date.now() - 7 * 864e5;
  do {
    const list = await env.USERS.list({ prefix: 'u:', cursor });
    for (const k of list.keys) {
      const u = await env.USERS.get(k.name, 'json'); if (!u) continue;
      total++; if (u.last > week) active7++; if (u.lastStudied > week) studied7++;
      if (u.progress) { lessons += u.progress.lessons || 0; courses += u.progress.coursesDone || 0; }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  return json({ users: total, activeLast7d: active7, studiedLast7d: studied7, lessonsReadTotal: lessons, coursesCompletedTotal: courses });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return json({});
    const url = new URL(req.url);
    try {
      if (url.pathname === '/open' && req.method === 'POST') return await handleOpen(req, env);
      if (url.pathname === '/chat' && req.method === 'POST') return await handleChat(req, env);
      if (url.pathname === '/webhook' && req.method === 'POST') return await handleWebhook(req, env);
      if (url.pathname === '/stats' && env.ADMIN_KEY && url.searchParams.get('key') === env.ADMIN_KEY) return await stats(env);
    } catch (e) { return json({ error: 'server' }, 500); }
    return new Response('Jason Academy API', { status: 200 });
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(nudge(env)); }
};
