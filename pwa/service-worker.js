/* Simple Service Worker for Smart POS */
const CACHE_NAME = 'smartpos-v1';
const FILES_TO_CACHE = [
  '../index.html',
  '../assets/css/theme.css',
  '../assets/js/app.js',
  '../assets/icons/green-192.png',
  '../assets/icons/green-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => { if(k !== CACHE_NAME) return caches.delete(k); })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).catch(()=> cached);
    })
  );
});
