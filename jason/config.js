/* ============================================================
   Jason Trading Academy — settings you actually edit.
   Everything else reads from here.
   ============================================================ */
var CONFIG = {
  /* Brand palette: 'royal' (electric blue), 'emerald' (green), 'violet' */
  THEME: 'royal',

  /* Broker referral link — the courses unlock only after the student registers through it
     and a manager confirms the account number. Empty = no gate. */
  REF_LINK: '',   // TODO: paste your partner link — empty keeps the gate off

  /* Manager username (without @) for hand-offs — also set MANAGER in the worker */
  MANAGER: '',

  /* Project lot sizes per deposit (XAUUSD). Other amounts scale from the nearest lower tier. */
  VOLUMES: { 250: 0.01, 1000: 0.03, 10000: 0.3 },   // TODO: confirm with the team

  /* Referral prizes per number of confirmed friends ({en, ru, fr, de} or one string) */
  PRIZES: {
    1:  { en:'Checklist PDF “Gold setups”', ru:'Чек-лист PDF «Сетапы по золоту»', fr:'Checklist PDF « Setups sur l’or »', de:'Checkliste PDF „Gold-Setups“' },
    3:  { en:'1 week in the private club', ru:'Неделя в закрытом клубе', fr:'1 semaine dans le club privé', de:'1 Woche im privaten Club' },
    5:  { en:'Personal trade review with the team', ru:'Личный разбор сделок с командой', fr:'Analyse personnelle de tes trades', de:'Persönliche Trade-Analyse mit dem Team' },
    10: { en:'1 month in the private club', ru:'Месяц в закрытом клубе', fr:'1 mois dans le club privé', de:'1 Monat im privaten Club' }
  },   // TODO: confirm prizes

  /* Private club / VIP: where every "join the club" button leads (texts are in i18n.js / lang/*.js) */
  CLUB_LINK: 'https://t.me/+lKjn6jFBql41ZThi',
  CLUB_PRICE: '',            // e.g. '$99 / month' — leave empty to hide the price line

  /* Public channel: shown on the subscription lock screen */
  CHANNEL_LINK: 'https://t.me/+lKjn6jFBql41ZThi',

  /* Broker card (demo account / partner link). Leave BROKER_LINK empty to hide it everywhere. */
  BROKER_NAME: 'FxPro',
  BROKER_LINK: '',

  /* Backend (Cloudflare Worker from /worker). Empty = app runs fully offline:
     no subscription lock, no Jason AI chat (a friendly notice is shown instead). */
  API_BASE: 'https://jason-academy-bot.zevs2018123.workers.dev'               // e.g. 'https://jason-academy-bot.<you>.workers.dev'
};
