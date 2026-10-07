# Repo rules

## Jason worker (`jason/worker/`) — deploy rules
- Before any change or deploy of the Jason worker: `git pull` from `master`.
- The worker is two files and both always ship together: `worker.js` and `landing.js`. Do not inline or delete `landing.js`.
- `master` already has the ad landing (`landing.js`, served by `GET /` on jetsjaisontraider.com) and Meta CAPI (`/track`, `sendCapi`). Before committing or deploying, verify worker.js still contains `import { landingHtml } from './landing.js'`, `landingHtml(` and `sendCapi` — a rewrite that drops them breaks the ad funnel.
- After deploy: `https://jetsjaisontraider.com/status` shows the current `version`, and `/` serves the landing.
