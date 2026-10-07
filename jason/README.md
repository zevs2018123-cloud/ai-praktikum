# Jason Trade Academy — Telegram Mini App

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

## Deploying the worker (keep the landing alive)
The worker is **two files** — always deploy both, from an up-to-date `master` (`git pull` first):
- `worker/worker.js` — bot, API, `GET /` on jetsjaisontraider.com → `landingHtml`, Meta CAPI (`/track`, `sendCapi`).
- `worker/landing.js` — the ad landing (`export function landingHtml`), imported by worker.js.

Before deploying, check that worker.js still has `import { landingHtml } from './landing.js'`, `landingHtml(` and `sendCapi`.
- **Terminal:** `cd jason/worker && npx wrangler deploy` (wrangler bundles landing.js automatically).
- **Dashboard editor:** update **both** files (add `landing.js` next to `worker.js`), then Deploy.
- **After every deploy:** `https://jetsjaisontraider.com/status` → `version` matches worker.js; `https://jetsjaisontraider.com/` shows the landing, not "Jason Academy API".

## CRM / admin panel (`admin.html` + `admin.js`, Oct 2026)
Based on LeadCenter (funnel · CRM · team tasks · users), rebuilt on the worker + D1 — no extra server.
- **First login:** open `…/jason/admin.html` → «Первый вход»: ADMIN_KEY + login + password → you are the main administrator.
- **Team:** «Команда» → add a person, tick tabs (CRM, Задачи, Контент; Воронка is always visible) → send them the invite link. Team and Settings are owner-only.
- **Funnel:** start → subscribed → opened academy → questionnaire → account sent → approved → deposit → VIP, by channel (fb/ig/th/x/yt/ref/direct from `?start=` tags) and by tag; ad spend per day → cost per start / per approved account.
- **CRM:** stages are automatic up to «счёт подтверждён»; «депозит» and «отказ» are set by a manager. Card: approve/reject account, VIP link, deposit amount, labels, next-touch task, notes, history, support chat (replies go to the app + bot).
- API: `/admin/*` with header `x-session` (staff) or legacy `x-admin-key`.

## v3 — entry flow (Oct 2026)
- **Bot:** /start → one message (subscribe to the channel); «I've subscribed» turns that same message into «Academy open». A repeated /start replaces the old gate message.
- **App:** questionnaire on first open → intro lesson «Who is Jason» (`intro.js`: draft text EN/RU, put the video id in `INTRO.video`) → broker step (account number, review «usually within 1 hour») → bot message when a manager approves.
- **Step-by-step lessons:** lesson N opens after N−1 is read, the quiz after all lessons, the next course after the quiz. Change the path in `unlockOrder()` (app.js).
- **Support chat:** 🆘 in the top bar / «I have a problem». Messages go to the managers' chat (`/setsales`); a manager **replies to that message** and the answer appears in the app + bot. Admin API for the future panel: `/admin/support-threads`, `/admin/support-thread?id=`, `/admin/support-reply {id,text}`.

## v2 — funnel (onboarding → broker gate → goal → referrals)
- **Onboarding** (6 questions + starting deposit $250/$1k/$10k + material goal & target) → saved in D1, posted to the managers' Telegram group.
- **Broker gate**: courses unlock after the student sends a broker account number and a manager taps ✅ in the group (or in the admin panel). Set `REF_LINK` in `config.js` to turn it on.
- **Goal widget** pinned on Home; progress = current balance ÷ target. The student logs deposits / withdrawals / balance.
- **Referrals**: personal link `t.me/<bot>?start=ref_<id>` in Profile; prizes per tier in `config.js → PRIZES`; managers get a message when a tier is reached.
- **Jason AI**: every question is tagged with a topic (admin → «Вопросы → идеи для видео»), matches 8 prepared problem guides, and hands off to `MANAGER` when someone is stuck on the platform (+ a catch-up message after 1 hour).
- **Admin panel**: `/admin.html` (key = `ADMIN_KEY` from result.txt): funnel stats, access approvals, users & CSV, question topics, lesson videos (unlisted YouTube), referral prizes.
- **Managers group**: add the bot to the group and send `/setsales` once.
- **Palettes**: `config.js → THEME` = royal | emerald | violet (preview any with `?pal=emerald`).
- **Calculator** uses `config.js → VOLUMES` (project lot per deposit).
