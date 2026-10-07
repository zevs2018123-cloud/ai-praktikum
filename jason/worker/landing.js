/* Ad landing served by this worker on the custom domain (GET /).
   Branded page so Meta review sees real content; auto-opens the bot after ~1.2 s.
   PIXEL_ID and the bot username are injected from env at request time. */
export function landingHtml({ pixelId = '', bot = 'JasonProTreid_bot' } = {}) {
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
