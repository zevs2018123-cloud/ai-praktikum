/* ============================================================
   Jason Trading Academy — settings you actually edit.
   Everything else reads from here.
   ============================================================ */
var CONFIG = {
  /* Private club / VIP: where every "join the club" button leads */
  CLUB_LINK: 'https://t.me/+lKjn6jFBql41ZThi',
  CLUB_TITLE: "Trade alongside Jason",
  CLUB_TEXT: "In the private club Jason posts every trade live — entry, stop, target and the reasoning — so you can see the lessons applied on a real account.",
  CLUB_PRICE: '',            // e.g. '$99 / month' — leave empty to hide the price line

  /* Public channel: shown on the subscription lock screen */
  CHANNEL_LINK: 'https://t.me/+lKjn6jFBql41ZThi',

  /* Broker card (demo account / partner link). Leave BROKER_LINK empty to hide it everywhere. */
  BROKER_NAME: 'FxPro',
  BROKER_LINK: '',
  BROKER_TEXT: 'Open a free demo account and practise every lesson with virtual money before you risk a cent.',

  /* Backend (Cloudflare Worker from /worker). Empty = app runs fully offline:
     no subscription lock, no Jason AI chat (a friendly notice is shown instead). */
  API_BASE: 'https://jason-academy-bot.zevs2018123.workers.dev'               // e.g. 'https://jason-academy-bot.<you>.workers.dev'
};
