const CACHE = 'gym-tracker-v17';
const ASSETS = [
  './',
  './index.html',
  './legacy.html',
  './layout-v17-css-0.txt',
  './layout-v17-css-1.txt',
  './layout-v17-css-2.txt',
  './layout-v17-js-0.txt',
  './layout-v17-js-1.txt',
  './layout-v17-js-2.txt',
  './layout-v17-js-3.txt',
  './layout-v17-js-4.txt',
  './layout-v17-js-5.txt',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, {ignoreSearch:true})
      .then(hit => hit || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      }).catch(() => caches.match('./index.html')))
  );
});