self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('kisan-netra-v1').then(cache => cache.addAll([
      '/',
      '/static/css/styles.css',
      '/static/js/app.js'
    ]))
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
