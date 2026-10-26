/* CX GAME – service worker : coquille de l'appli en cache, données toujours rafraîchies. */
const CACHE = 'cxgame-v2';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/names.js', 'js/game.js', 'js/athletes.js', 'js/results.js', 'js/config.js', 'js/store.js', 'js/dataroom.js', 'js/app.js', 'manifest.webmanifest', 'img/icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/data/')) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); return; }   // données : réseau d'abord
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
