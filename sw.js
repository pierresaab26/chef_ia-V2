// v295: minimal service worker so that phones offer « Install / Add to home screen ».
// It caches NOTHING (every version is always fetched fresh); it only shows a short message when a page cannot load offline.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return; // API calls, images…: the browser handles them as usual
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chef IA</title><body style="font:16px system-ui;padding:40px 24px;text-align:center;background:#fffaf2;color:#16121a"><p style="font-size:40px">🍳</p><p>Pas de connexion internet.<br>No internet connection.</p><button onclick="location.reload()" style="font:inherit;padding:10px 20px;border-radius:999px;border:1px solid rgba(229,25,95,.22);background:#fde6ee;color:#e5195f">↻</button></body>',
    { headers: { 'content-type': 'text/html; charset=utf-8' } })));
});
