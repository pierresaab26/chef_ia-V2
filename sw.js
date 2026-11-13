// v353: service worker with an offline copy of the app.
// Pages: NETWORK FIRST (a connected user always gets the newest version; after 6 s without answer, or when offline, the last good copy is used).
// Icons / manifest: stale-while-revalidate. /api/* and every non-GET request: never touched, never cached (data is always live).
const CACHE = 'chef-ia-shell';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];
const STATIC = /^\/(icons\/|manifest\.webmanifest$)/;
const TIMEOUT = 6000;
const OFFLINE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chef IA</title><body style="font:16px system-ui;padding:40px 24px;text-align:center;background:#fffaf2;color:#16121a"><p style="font-size:40px">🍳</p><p>Pas de connexion internet.<br>No internet connection.</p><button onclick="location.reload()" style="font:inherit;padding:10px 20px;border-radius:999px;border:1px solid rgba(229,25,95,.22);background:#fde6ee;color:#e5195f">↻</button></body>';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const offlinePage = () => new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } });

// The app is one page: every address of it (/, /?c=<invite>, /?r=<recipe>…) is the same HTML, kept under « / ».
async function page(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), TIMEOUT))]);
    if (res.ok && res.type === 'basic' && !res.redirected) cache.put('/', res.clone());
    return res;
  } catch (x) {
    return (await cache.match('/')) || offlinePage();
  }
}

async function asset(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit || Response.error());
  return hit || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return; // the browser handles them as usual
  if (req.mode === 'navigate') {
    e.respondWith(url.pathname === '/' ? page(req) : fetch(req).catch(() => offlinePage()));
    return;
  }
  if (STATIC.test(url.pathname)) e.respondWith(asset(req));
});
