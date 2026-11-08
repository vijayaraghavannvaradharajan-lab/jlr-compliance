/* JLR Tracker service worker: makes the app installable and opens fast.
   Pages and scripts: network first, always re-checked with the server (no stale copy after an upload);
   the cached copy is used only when offline. Data (Supabase) is never cached. */
const CACHE = 'jlr-shell-v29';
const SHELL = ['./', './style.css', './theme.js', './supabase.js', './config.js', './app.js', './manifest.webmanifest', './icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;     // Supabase, fonts, Zoho: straight to network
  const fresh = new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' });   // ask the server every time (cheap 304 when unchanged)
  e.respondWith(fetch(fresh).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(m => m || caches.match('./'))));
});
