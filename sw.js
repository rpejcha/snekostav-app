const CACHE_NAME = 'snekostav-v1.01';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => {
    return Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) return caches.delete(key);
    }));
  }));
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('firestore') || e.request.url.includes('googleapis')) { return; }
  e.respondWith(caches.match(e.request).then((response) => { return response || fetch(e.request); }));
});