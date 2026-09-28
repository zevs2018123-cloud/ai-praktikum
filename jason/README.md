# Jason Trading Academy — Telegram Mini App

English trading-education mini app for Jason's channel. Same engine as AI Практикум: courses → lessons → course quiz, XP/levels, 12 achievements, daily streak with freezes, subscription lock, AI assistant, club upsell. Plus a trading **Tools** tab (position size, drawdown, compounding calculators).

**Content:** 6 blocks · 10 courses · 30 lessons · 66 quiz questions. Focus: risk management + gold (XAUUSD).

## Files
| File | What |
|---|---|
| `config.js` | **Edit this**: club link, price, channel, broker link, backend URL |
| `data1.js` `data2.js` `data3.js` | Courses, lessons, quizzes; `data3.js` also has `BLOCKS`, `COURSES` order and daily `TIPS` |
| `app.js`, `tg.js` | App logic and Telegram glue |
| `src/*` + `build.py` | index.html is assembled from these. After ANY change run `python3 build.py` (stamps a new build id so Telegram drops its cache) |
| `worker/` | Cloudflare Worker: subscription lock, Jason AI chat, /start reply, reminders, /stats |

Lesson body blocks: `'text'`, `{h}`, `{step,t,d}`, `{list:[]}`, `{note}`, `{warn}`, `{task}`, `{formula,label,copy}`, `{table:{head,rows}}`, `{links:[{n,u,d}]}`, `{tool:'size'|'dd'|'comp', t}`. Optional `video:'YouTubeID'` on a lesson. Put the correct answer first in quizzes — options are shuffled deterministically.

## Launch (≈30 min)
1. **GitHub Pages** — new repo (e.g. `jason-academy`), upload everything except `worker/`, Settings → Pages → deploy from `main`. You get `https://<user>.github.io/jason-academy/`.
2. **Bot** — @BotFather → `/newbot` → then `/newapp` (or Bot Settings → Menu Button) with the Pages URL.
3. The app already works at this point (offline mode: no lock, chat shows a "switching on" notice).
4. **Backend (optional, enables lock + Jason AI + reminders)**
   ```
   cd worker
   npx wrangler kv namespace create USERS      # paste id into wrangler.toml
   npx wrangler secret put BOT_TOKEN
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put ADMIN_KEY
   npx wrangler deploy
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://jason-academy-bot.<you>.workers.dev/webhook"
   ```
   Then set `API_BASE` in `config.js`, `APP_URL` in `wrangler.toml`, run `python3 build.py`, push.
5. **Subscription lock** — add the bot as admin of the channel, put the channel's numeric id (`-100…`) in `CHANNEL_ID`, redeploy the worker. Empty = no lock.

Stats: `https://…workers.dev/stats?key=<ADMIN_KEY>`.

Notes: reminders go only to people who pressed /start in the bot, 10:00–20:00 their local time, max once per 3 days. Jason AI uses Claude Haiku, 40 messages/user/day, never gives buy/sell calls, and says it's an AI if asked.
